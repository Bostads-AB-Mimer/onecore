import {
  getCounterPartCustomers,
  findCounterPartCustomer,
} from './adapters/invoice-data-db-adapter'
import {
  getRoundOffInformation,
  enrichInvoiceWithAccounting,
  getActiveRentalBlocksWithAccounting,
} from './adapters/xpand-db-adapter'
import {
  InvoiceWithAccounting,
  ExportedInvoiceRow,
  TOTAL_ACCOUNT,
  CUSTOMER_LEDGER_ACCOUNT,
  AggregatedRow,
  LedgerRow,
  xledgerDateString,
  RentalLoss,
  RentalLossRow,
  RentalBlockWithAccounting,
} from '../../common/types/typesv2'
import {
  getPeriodInformationFromDateStrings,
  setInvoiceRowsTaxRule,
  uploadFile,
} from '../common/adapters/xledger-adapter'
import { logger } from '@onecore/utilities'
import {
  getInvoicesNotExported,
  getRentalLosses,
} from '@src/common/adapters/tenfast/tenfast-adapter'
import config from '@src/common/config'

export { markInvoicesAsExported } from '@src/common/adapters/tenfast/tenfast-adapter'

//#region Rental Invoice Accounting
/*
 *
 */
export const exportRentalInvoicesAccounting = async (
  companyId: string,
  numberOfChunks: number = 1
): Promise<{
  exportedInvoices: InvoiceWithAccounting[]
  skippedInvoices: InvoiceWithAccounting[]
  errors: { invoiceNumber: string; error: string }[]
}> => {
  try {
    const errors: { invoiceNumber: string; error: string }[] = []
    const CHUNK_SIZE = 100 // 100
    const invoices: InvoiceWithAccounting[] = []
    const skippedInvoices: InvoiceWithAccounting[] = []

    const company = config.companies.find(
      (company) => company.xpandId.localeCompare(companyId) === 0
    )

    if (!company) {
      throw new Error('Could not find company ' + companyId)
    }

    for (let i = 0; i < numberOfChunks; i++) {
      const invoicesResult = await getInvoicesNotExported(CHUNK_SIZE, company)
      if (!invoicesResult.ok) {
        logger.error(
          { error: invoicesResult.err },
          'Could not get rental invoices for export'
        )
        throw new Error(invoicesResult.err)
      } else {
        logger.info(
          { invoicesToImport: invoicesResult.data.invoices.length },
          'Importing invoices'
        )
      }

      // TODO: add logic for internal customers instead of filtering them out.
      let chunkInvoices = invoicesResult.data.invoices.filter((invoice) => {
        return !invoice.recipientContactCode?.startsWith('I')
      })

      let skipped = invoicesResult.data.invoices.filter((invoice) => {
        return invoice.recipientContactCode?.startsWith('I')
      })

      skippedInvoices.push(...skipped)

      if (invoicesResult.data.errors) {
        errors.push(...invoicesResult.data.errors)
      }

      if (
        !invoicesResult.data.invoices ||
        invoicesResult.data.invoices.length === 0
      ) {
        return {
          exportedInvoices: [],
          skippedInvoices,
          errors,
        }
      }

      const counterPartCustomers = await getCounterPartCustomers()

      for (const invoice of chunkInvoices) {
        if (company.roundOffCostCode) {
          invoice.roundOffCostCode = company.roundOffCostCode
        }

        try {
          await enrichInvoiceWithAccounting(invoice)
          await setInvoiceRowsTaxRule(invoice)
        } catch (error) {
          let message
          if (error instanceof Error) {
            message = error.message
          } else {
            message = String(error)
          }
          errors.push({ invoiceNumber: invoice.invoiceId, error: message })
          continue
        }

        const counterPartCustomer = findCounterPartCustomer(
          counterPartCustomers.customers,
          invoice.recipientName
        )

        if (counterPartCustomer) {
          invoice.totalAccount = counterPartCustomer.totalAccount
          invoice.ledgerAccount = counterPartCustomer.ledgerAccount
          invoice.counterPartCode = counterPartCustomer.counterPartCode
        } else {
          invoice.totalAccount = TOTAL_ACCOUNT
          invoice.ledgerAccount = CUSTOMER_LEDGER_ACCOUNT
        }
      }

      // Remove invoices with errors
      if (errors && errors.length) {
        const errorInvoiceNumbers = new Set(errors.map((e) => e.invoiceNumber))
        chunkInvoices = chunkInvoices.filter(
          (invoice) => !errorInvoiceNumbers.has(invoice.invoiceId)
        )
      }

      chunkInvoices.sort(
        (a: InvoiceWithAccounting, b: InvoiceWithAccounting) => {
          return (
            a.ledgerAccount?.localeCompare(b.ledgerAccount ?? '') ||
            a.totalAccount?.localeCompare(b.totalAccount ?? '') ||
            dateString(a.fromDate)?.localeCompare(
              dateString(b.fromDate) ?? ''
            ) ||
            dateString(a.toDate)?.localeCompare(dateString(b.toDate) ?? '') ||
            0
          )
        }
      )

      invoices.push(...chunkInvoices)
    }

    return {
      exportedInvoices: invoices,
      skippedInvoices,
      errors,
    }
  } catch (error: any) {
    logger.error(error, 'Error importing invoices')

    throw error
  }
}

export const createAccounting = async (
  invoices: InvoiceWithAccounting[]
): Promise<{
  aggregateAccountingCsv: string[]
  ledgerAccountingCsv: string[]
  errors: { invoiceNumber: string; error: string }[]
}> => {
  const invoiceRowsForExport = await getExportInvoiceRows(invoices)
  const aggregateAccountingCsv = await createAggregateCsv(invoiceRowsForExport)
  const ledgerAccountingCsv = await createLedgerCsv(invoices)
  //c§onst contactsCsv = await getContacts(invoices)

  console.log('--- AGGREGATE CSV ---')
  console.log(aggregateAccountingCsv.join('\n'))
  console.log('---------')

  console.log('\n--- LEDGER CSV ---')
  console.log(ledgerAccountingCsv.join('\n'))
  console.log('---------')

  /*console.log('\n--- CONTACT CSV ---')
  console.log(contactsCsv.join('\n'))
  console.log('---------')*/

  return {
    aggregateAccountingCsv,
    ledgerAccountingCsv,
    errors: [],
  }
}

const getExportInvoiceRows = async (invoices: InvoiceWithAccounting[]) => {
  const exportInvoiceRows: ExportedInvoiceRow[] = []

  for (const invoice of invoices) {
    if (invoice.roundoff && invoice.roundoff !== 0) {
      exportInvoiceRows.push(
        await createRoundOffRow(
          invoice,
          invoice.totalAccount!!,
          invoice.ledgerAccount!!
        )
      )
    }

    for (const invoiceRow of invoice.invoiceRows) {
      exportInvoiceRows.push({
        amount: invoiceRow.amount,
        totalAmount: invoiceRow.totalAmount,
        deduction: invoiceRow.deduction,
        vat: invoiceRow.vat,
        invoiceDate: invoice.invoiceDate,
        invoiceDueDate: invoice.expirationDate,
        invoiceNumber: invoice.invoiceId,
        invoiceRowText: invoiceRow.invoiceRowText,
        fromDate: clampToCurrentMonth(invoice.fromDate, 'start'),
        toDate: clampToCurrentMonth(invoice.toDate, 'end'),
        contractCode: invoice.leaseId,
        rentArticleName: invoiceRow.rentArticleName,
        account: invoiceRow.account,
        costCode: invoiceRow.costCode,
        property: invoiceRow.property,
        freeCode: invoiceRow.freeCode,
        projectCode: invoiceRow.projectCode,
        totalAccount: invoice.totalAccount,
        ledgerAccount: invoice.ledgerAccount,
        counterPartCode: invoice.counterPartCode,
        contactCode: invoice.recipientContactCode,
        tenantName: invoice.recipientName,
        taxRule: invoiceRow.taxRule,
      })
    }
  }

  return exportInvoiceRows
}

const createRoundOffRow = async (
  invoice: InvoiceWithAccounting,
  totalAccount: string,
  ledgerAccount: string
): Promise<ExportedInvoiceRow> => {
  const year = invoice.fromDate.getFullYear()
  const roundOffInformation = await getRoundOffInformation(year.toString())

  return {
    account: roundOffInformation.account,
    costCode: invoice.roundOffCostCode ?? roundOffInformation.costCode,
    amount: invoice.roundoff as number,
    totalAmount: invoice.roundoff as number,
    rowTotalAmount: invoice.roundoff as number,
    invoiceDate: invoice.invoiceDate,
    invoiceNumber: invoice.invoiceId,
    invoiceRowText: 'Öresutjämning',
    fromDate: clampToCurrentMonth(invoice.fromDate, 'start'),
    toDate: clampToCurrentMonth(invoice.toDate, 'end'),
    contractCode: invoice.leaseId,
    totalAccount,
    ledgerAccount,
    counterPartCode: invoice.counterPartCode,
    contactCode: invoice.recipientContactCode,
    tenantName: invoice.recipientName,
  }
}

//#region Rental Aggregate Accounting
const createAggregateCsv = async (invoiceRows: ExportedInvoiceRow[]) => {
  const aggregateRows = await createAggregateRows(invoiceRows)
  const aggregateRowsCsv = convertToAggregateCsvRows(aggregateRows)

  return aggregateRowsCsv
}

const createAggregateRows = async (invoiceRows: ExportedInvoiceRow[]) => {
  const rowChunks: Record<string, ExportedInvoiceRow[]> = {}

  invoiceRows.forEach((invoiceRow) => {
    const key =
      invoiceRow.totalAccount +
      ':' +
      invoiceRow.taxRule +
      ':' +
      dateString(invoiceRow.fromDate) +
      ':' +
      dateString(invoiceRow.toDate)

    if (!rowChunks[key]) {
      rowChunks[key] = []
    }

    rowChunks[key].push(invoiceRow)
  })

  let aggregatedRows: AggregatedRow[] = []
  let voucherIndex = 0

  Object.values(rowChunks).forEach((chunkInvoiceRows) => {
    const voucherNumber =
      Date.now().toString().substring(6, 12) +
      voucherIndex.toString().padStart(3, '0')
    voucherIndex++

    const chunkAggregatedRows = groupAggregateRows(
      chunkInvoiceRows,
      voucherNumber
    )
    aggregatedRows.push(...chunkAggregatedRows)
    const chunkTotalRow = createAggregatedTotalRow(
      chunkAggregatedRows,
      voucherNumber
    )
    aggregatedRows.push(chunkTotalRow)
  })

  console.table(aggregatedRows)

  return aggregatedRows
}

const dateString = (date: Date | undefined) => {
  return date ? date.toISOString().split('T')[0] : undefined
}

// Uses UTC throughout to stay consistent with dateString() which calls toISOString().
// Replacement dates are built with Date.UTC so toISOString() always returns the
// intended calendar date regardless of the server's local timezone offset.
const clampToCurrentMonth = (
  date: Date | undefined,
  position: 'start' | 'end'
): Date | undefined => {
  if (!date) return undefined

  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const currentMonth = now.getUTCMonth()

  if (
    date.getUTCFullYear() < currentYear ||
    (date.getUTCFullYear() === currentYear && date.getUTCMonth() < currentMonth)
  ) {
    return position === 'start'
      ? new Date(Date.UTC(currentYear, currentMonth, 1))
      : new Date(Date.UTC(currentYear, currentMonth + 1, 0))
  }

  return date
}

const safeAdd = (
  term1: number | undefined,
  term2: number | undefined
): number => {
  return Math.round(((term1 ?? 0) + (term2 ?? 0) + Number.EPSILON) * 100) / 100
}

/**
 * Aggregates invoice rows into groups based on the following fields (i.e. into
 * rows that can exist in the same voucher):
 *
 * 'Account', 'CostCode', 'Property', 'ProjectCode', 'FreeCode', 'InvoiceDate', 'InvoiceFromDate',
 * 'InvoiceToDate', 'TotalAccount'
 *
 * @param invoiceRows
 */
const groupAggregateRows = (
  invoiceRows: ExportedInvoiceRow[],
  voucherNumber: string
): AggregatedRow[] => {
  console.log('groupAggregateRows')
  console.table(invoiceRows)

  const groupedRows = [
    ...invoiceRows
      .reduce((r, o) => {
        const key =
          o.account +
          '||' +
          o.taxRule +
          '||' +
          o.costCode +
          '||' +
          o.property +
          '||' +
          o.projectCode +
          '||' +
          o.freeCode +
          '||' +
          dateString(o.invoiceDate) +
          '||' +
          dateString(o.fromDate) +
          '||' +
          dateString(o.toDate) +
          '||' +
          o.totalAccount

        const aggregatedRow = r.get(key) || {
          account: o.account,
          costCode: o.costCode,
          projectCode: o.projectCode,
          freeCode: o.freeCode,
          property: o.property,
          voucherDate: dateString(o.fromDate) ?? '',
          fromDate: dateString(o.fromDate) ?? '',
          toDate: dateString(o.toDate) ?? '',
          totalAccount: o.totalAccount,
          counterPartCode: o.counterPartCode,
          voucherNumber,
          amount: 0,
          totalAmount: 0,
          vat: 0,
          taxRule: o.taxRule,
        }

        aggregatedRow.amount = safeAdd(
          aggregatedRow.amount,
          o.amount ? -1 * o.amount : 0
        )
        aggregatedRow.totalAmount = safeAdd(
          aggregatedRow.totalAmount,
          o.totalAmount ? -1 * o.totalAmount : 0
        )

        return r.set(key, aggregatedRow)
      }, new Map())
      .values(),
  ]

  return groupedRows
}

export const createAggregatedTotalRow = (
  aggregatedRows: AggregatedRow[],
  voucherNumber: string
): AggregatedRow => {
  const accumulator: AggregatedRow = {
    voucherDate: aggregatedRows[0].fromDate,
    account: aggregatedRows[0].totalAccount,
    fromDate: aggregatedRows[0].fromDate,
    toDate: aggregatedRows[0].toDate,
    totalAccount: aggregatedRows[0].totalAccount,
    counterPartCode: aggregatedRows[0].counterPartCode,
    voucherNumber,
    amount: 0,
    totalAmount: 0,
    vat: 0,
  }

  console.log('AGGREGATED TOTAL')
  console.table(aggregatedRows)

  const totalRow = aggregatedRows.reduce((acc: AggregatedRow, row) => {
    acc.amount = (acc.amount as number) - (row.totalAmount as number)
    return acc
  }, accumulator)

  totalRow.amount =
    Math.round(((totalRow.amount as number) + Number.EPSILON) * 100) / 100

  return totalRow
}

const convertToAggregateCsvRows = (aggregateRows: AggregatedRow[]) => {
  const csvRows: string[] = []

  csvRows.push(
    'Voucher Type;Voucher No;Voucher Date;Account;Posting 1;Posting 2;Posting 3;Posting 4;Posting 5;Period Start;No of Periods;Subledger No;Invoice Date;Invoice No;OCR;Due Date;Text;TaxRule;Amount'
  )

  aggregateRows.forEach((row) => {
    const periodInfo = getPeriodInformationFromDateStrings(
      row.voucherDate,
      row.fromDate,
      row.toDate
    )
    csvRows.push(
      `AR;${row.voucherNumber};${xledgerDateString(row.voucherDate)};${row.account};${row.costCode || ''};${row.projectCode || ''};${row.property || ''};${row.freeCode || ''};${row.counterPartCode || ''};${periodInfo.periodStart};${periodInfo.periodStart};${''};${''};${''};${''};${''};${''};${row.taxRule ?? ''};${row.amount}`
    )
  })

  return csvRows
}
//#endregion

//#region Rental Ledger Accounting
const createLedgerCsv = async (invoices: InvoiceWithAccounting[]) => {
  const ledgerRows = await createLedgerRows(invoices)
  const ledgerCsvRows = convertToLedgerCsvRows(ledgerRows)

  return ledgerCsvRows
}

export const createLedgerRows = async (
  invoices: InvoiceWithAccounting[]
): Promise<LedgerRow[]> => {
  const invoiceChunks: Record<string, InvoiceWithAccounting[]> = {}

  invoices.forEach((invoice) => {
    const key = invoice.ledgerAccount + ':' + dateString(invoice.invoiceDate)
    if (!invoiceChunks[key]) {
      invoiceChunks[key] = []
    }

    invoiceChunks[key].push(invoice)
  })

  let voucherIndex = 0
  let ledgerRows: LedgerRow[] = []
  Object.values(invoiceChunks).forEach((chunkInvoices) => {
    const voucherNumber =
      Date.now().toString().substring(6, 12) +
      voucherIndex.toString().padStart(3, '0')
    voucherIndex++

    const chunkRows = convertToLedgerRows(chunkInvoices, voucherNumber)
    ledgerRows.push(...chunkRows)
    const chunkTotalRow = createLedgerTotalRow(chunkInvoices, voucherNumber)
    ledgerRows.push(chunkTotalRow)
  })

  console.table(ledgerRows)

  return ledgerRows
}

const convertToLedgerRows = (
  invoices: InvoiceWithAccounting[],
  voucherNumber: string
): LedgerRow[] => {
  return invoices.map((invoice) => {
    return {
      account: invoice.ledgerAccount,
      amount: invoice.amount,
      vat: invoice.totalVat ?? 0,
      voucherDate: dateString(invoice.invoiceDate) ?? '',
      voucherNumber,
      invoiceDate: dateString(invoice.invoiceDate),
      invoiceNumber: invoice.invoiceId,
      recipientContactCode: invoice.recipientContactCode,
      counterPartCode: invoice.counterPartCode,
    }
  })
}

const createLedgerTotalRow = (
  invoices: InvoiceWithAccounting[],
  voucherNumber: string
): LedgerRow => {
  const totalAmount = invoices
    .map((invoice) => invoice.amount)
    .reduce((accumulator: number, amount: number) => {
      accumulator += amount

      return accumulator
    }, 0)

  const totalVat = invoices
    .map((invoice) => invoice.totalVat)
    .reduce(
      (accumulator: number, amount: number | undefined) =>
        accumulator + (amount ?? 0),
      0
    )

  return {
    account: invoices[0].totalAccount,
    voucherDate: dateString(invoices[0].invoiceDate) ?? '',
    voucherNumber,
    vat: totalVat ?? 0,
    amount: -Math.round(((totalAmount as number) + Number.EPSILON) * 100) / 100,
  }
}

const convertToLedgerCsvRows = (ledgerRows: LedgerRow[]) => {
  const csvRows: string[] = []

  csvRows.push(
    'Voucher Type;Voucher No;Voucher Date;Account;Posting 1;Posting 2;Posting 3;Posting 4;Posting 5;Period Start;No of Periods;Subledger No;Invoice Date;Invoice No;OCR;Due Date;Text;TaxRule;Amount'
  )

  ledgerRows.forEach((row) => {
    csvRows.push(
      `AR;${row.voucherNumber};${xledgerDateString(row.voucherDate)};${row.account};${''};${''};${''};${''};${row.counterPartCode ?? ''};${''};${''};${row.recipientContactCode ?? ''};${xledgerDateString(row.invoiceDate)};${row.invoiceNumber ?? ''};${row.invoiceNumber ?? ''};${xledgerDateString(row.invoiceDueDate)};${''};${''};${row.amount}`
    )
  })

  return csvRows
}
//#endregion

//#endregion

//#region Rental Loss Accounting
export const exportRentalLosses = async (
  companyId: string
): Promise<RentalLoss[]> => {
  const company = config.companies.find(
    (company) => company.xpandId.localeCompare(companyId) === 0
  )

  if (!company) {
    throw new Error('Could not find company ' + companyId)
  }

  const rentalLossResults = await getRentalLosses(company)
  if (rentalLossResults.ok !== true) {
    logger.error(
      { error: rentalLossResults.err },
      'Could not retrieve rental loss information'
    )
    throw new Error(
      'Could not retrieve rental loss information: ' + rentalLossResults.err
    )
  }

  return rentalLossResults.data.rentalLosses
}

export const createRentalLossAccounting = async (
  rentalLosses: RentalLoss[]
): Promise<{
  aggregateRentalLossAccountingCsv: string[]
  errors: { rentalObject: string; error: string }[]
}> => {
  const aggregateRows = await createRentalLossAggregateRows(rentalLosses)

  const rowChunks: Record<string, AggregatedRow[]> = {}

  aggregateRows.forEach((aggregatedRow) => {
    const key = aggregatedRow.fromDate + ':' + aggregatedRow.toDate

    if (!rowChunks[key]) {
      rowChunks[key] = []
    }

    rowChunks[key].push(aggregatedRow)
  })

  let voucherIndex = 0
  let voucherRowCount = 0
  let MAX_VOUCHER_ROWS = 500

  Object.values(rowChunks).forEach((chunkAggregatedRows) => {
    let voucherNumber =
      Date.now().toString().substring(6, 12) +
      voucherIndex.toString().padStart(3, '0')
    voucherIndex++
    voucherRowCount = 0

    chunkAggregatedRows.forEach((aggregatedRow) => {
      if (voucherRowCount > MAX_VOUCHER_ROWS) {
        voucherNumber =
          Date.now().toString().substring(6, 12) +
          voucherIndex.toString().padStart(3, '0')
        voucherIndex++
        voucherRowCount = 0
      }
      aggregatedRow.voucherNumber = voucherNumber
      voucherRowCount++
    })
  })

  const aggregateRowsCsv = convertToAggregateCsvRows(aggregateRows)

  console.table(aggregateRows)
  console.log(aggregateRowsCsv)

  return {
    aggregateRentalLossAccountingCsv: aggregateRowsCsv,
    errors: [],
  }
}

const createRentalLossAggregateRows = async (rentalLosses: RentalLoss[]) => {
  const exportedRows: AggregatedRow[] = []

  rentalLosses.forEach((rentalLoss) => {
    rentalLoss.rentalLossRows.forEach((rentalLossRow) => {
      const rowFrom =
        rentalLossRow.fromDate ?? rentalLoss.uncontractedInterval.from
      const rowTo = rentalLossRow.toDate ?? rentalLoss.uncontractedInterval.to

      const exportedRentalLossIncomeRow = {
        amount: rentalLossRow.amount,
        vat: rentalLossRow.vat,
        totalAmount: rentalLossRow.totalAmount,
        taxRule: rentalLossRow.taxRule,
        account: rentalLossRow.incomeAccount.toString(),
        projectCode: rentalLossRow.incomeProjectCode,
        freeCode: rentalLossRow.incomeFreeCode,
        costCode: rentalLossRow.incomeCostCode,
        property: rentalLossRow.incomeProperty,
        fromDate: dateString(rowFrom) ?? '',
        toDate: dateString(rowTo) ?? '',
        voucherDate: dateString(rowFrom) ?? '',
        totalAccount: '',
      }

      exportedRows.push(exportedRentalLossIncomeRow)

      const exportedRentalLossCostRow = {
        amount: -rentalLossRow.amount,
        vat: rentalLossRow.vat,
        totalAmount: -rentalLossRow.totalAmount,
        taxRule: rentalLossRow.taxRule,
        account: rentalLossRow.costAccount.toString(),
        projectCode: rentalLossRow.costProjectCode,
        freeCode: rentalLossRow.costFreeCode,
        costCode: rentalLossRow.costCostCode,
        property: rentalLossRow.costProperty,
        fromDate: dateString(rowFrom) ?? '',
        toDate: dateString(rowTo) ?? '',
        voucherDate: dateString(rowFrom) ?? '',
        totalAccount: '',
      }

      exportedRows.push(exportedRentalLossCostRow)
    })
  })

  return exportedRows
}

export const handleRentalBlocks = async (rentalLosses: RentalLoss[]) => {
  const rentalLossesWithBlocks: RentalLoss[] = []

  for (const rentalLoss of rentalLosses) {
    // 1. check for active block
    // 2. get accounting for active block - if exists, replace rental loss row (fully or partially based on date ranges) with block accounting
    const rentalBlocks = await getActiveRentalBlocksWithAccounting(
      rentalLoss.rentalObject,
      rentalLoss.uncontractedInterval.from,
      rentalLoss.uncontractedInterval.to
    )

    console.log('Blocks for', rentalLoss.rentalObject, rentalBlocks[0])

    if (!rentalBlocks || rentalBlocks.length === 0) {
      rentalLossesWithBlocks.push(rentalLoss)
      continue
    }

    // Earliest block wins on overlaps. Stable by fromDate, then description.
    const orderedBlocks = [...rentalBlocks].sort((a, b) => {
      const fromDelta = a.fromDate.getTime() - b.fromDate.getTime()
      return fromDelta !== 0
        ? fromDelta
        : a.description.localeCompare(b.description)
    })

    const lossInterval = rentalLoss.uncontractedInterval
    const lossTotalDays = daysInclusive(lossInterval.from, lossInterval.to)
    if (lossTotalDays <= 0) {
      rentalLossesWithBlocks.push(rentalLoss)
      continue
    }

    // Build the distinct sub-intervals. Iterate blocks in priority order; for each
    // as-yet-uncovered portion of [lossFrom, lossTo] that a block intersects,
    // emit a block-covered interval. Gaps between blocks remain as plain loss.
    //
    // All interval math is performed on start-of-day UTC timestamps so splits
    // land on midnight boundaries regardless of any time component on the
    // source dates.
    const startOfDay = (d: Date) => {
      const u = new Date(d.getTime())
      u.setUTCHours(0, 0, 0, 0)
      return u
    }
    const DAY_MS = 24 * 60 * 60 * 1000
    const lossStart = startOfDay(lossInterval.from).getTime()
    const lossEnd = startOfDay(lossInterval.to).getTime()

    const blockIntervals: {
      from: Date
      to: Date
      block: RentalBlockWithAccounting
    }[] = []
    const uncovered: { from: Date; to: Date }[] = [
      { from: new Date(lossStart), to: new Date(lossEnd) },
    ]

    for (const block of orderedBlocks) {
      if (uncovered.length === 0) break
      const blockFrom = startOfDay(block.fromDate).getTime()
      // Open-ended blocks (null toDate) extend to the end of the loss interval.
      const blockTo = startOfDay(block.toDate ?? lossInterval.to).getTime()
      if (blockTo < lossStart || blockFrom > lossEnd) continue

      const stillUncovered: { from: Date; to: Date }[] = []
      for (const piece of uncovered) {
        const pieceFrom = piece.from.getTime()
        const pieceTo = piece.to.getTime()
        if (blockTo < pieceFrom || blockFrom > pieceTo) {
          stillUncovered.push(piece)
          continue
        }
        const overlapFrom = Math.max(pieceFrom, blockFrom)
        const overlapTo = Math.min(pieceTo, blockTo)
        blockIntervals.push({
          from: new Date(overlapFrom),
          to: new Date(overlapTo),
          block,
        })
        if (pieceFrom < overlapFrom) {
          stillUncovered.push({
            from: piece.from,
            to: new Date(overlapFrom - DAY_MS),
          })
        }
        if (pieceTo > overlapTo) {
          stillUncovered.push({
            from: new Date(overlapTo + DAY_MS),
            to: piece.to,
          })
        }
      }
      uncovered.length = 0
      uncovered.push(...stillUncovered)
    }

    // Merge contiguous block intervals that share the same block, so we don't
    // produce redundant rows when one block covers a fragmented range.
    const mergedBlockIntervals = mergeContiguousBlockIntervals(blockIntervals)

    // The chronological segments the original rows are split across: block
    // intervals carry the block's cost-side accounting, gaps keep the original.
    const segments: {
      from: Date
      to: Date
      block?: RentalBlockWithAccounting
    }[] = [...mergedBlockIntervals, ...uncovered].sort(
      (a, b) => a.from.getTime() - b.from.getTime()
    )

    // Build the new set of rental loss rows, one per original row and segment.
    const newRows: RentalLossRow[] = []
    for (const row of rentalLoss.rentalLossRows) {
      // A single whole-period gap with no blocks just clones the original row
      // (no proration) so the no-op case is byte-identical to the input.
      if (mergedBlockIntervals.length === 0) {
        newRows.push({ ...row })
        continue
      }

      const splitRows = segments.map((segment): RentalLossRow => {
        const factor = daysInclusive(segment.from, segment.to) / lossTotalDays
        const splitRow: RentalLossRow = {
          ...row,
          amount: roundCurrency(row.amount * factor),
          totalAmount: roundCurrency(row.totalAmount * factor),
          fromDate: segment.from,
          toDate: segment.to,
        }

        if (!segment.block) return splitRow

        return {
          ...splitRow,
          costAccount: Number(segment.block.account),
          costProjectCode: segment.block.projectCode,
          costProperty: segment.block.property,
          costFreeCode: segment.block.freeCode,
          costCostCode: segment.block.costCode,
          isBlock: true,
        }
      })

      // Each segment is prorated and rounded independently, so the parts can
      // miss the original row by a few öre. The chronologically last segment
      // absorbs the residual, making the splits sum back to the original.
      const lastRow = splitRows[splitRows.length - 1]
      if (lastRow) {
        const amountSum = splitRows.reduce((sum, r) => sum + r.amount, 0)
        const totalAmountSum = splitRows.reduce(
          (sum, r) => sum + r.totalAmount,
          0
        )
        lastRow.amount = roundCurrency(
          lastRow.amount + (row.amount - amountSum)
        )
        lastRow.totalAmount = roundCurrency(
          lastRow.totalAmount + (row.totalAmount - totalAmountSum)
        )
      }

      newRows.push(...splitRows)
    }

    rentalLossesWithBlocks.push({
      ...rentalLoss,
      rentalLossRows: newRows,
    })
  }

  console.table(rentalLossesWithBlocks)

  return rentalLossesWithBlocks
}

// Number of days in a closed date interval [from, to] (inclusive on both ends).
// Days are counted at the millisecond boundary, so [2026-07-01, 2026-07-31] = 31.
const daysInclusive = (from: Date, to: Date): number => {
  const ms = to.getTime() - from.getTime()
  if (ms < 0) return 0
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1
}

const roundCurrency = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100

const datesAreContiguous = (a: Date, b: Date): boolean => {
  // a ends the day before b starts: a.to = 2026-07-10 -> b.from = 2026-07-11
  return a.getTime() + 24 * 60 * 60 * 1000 === b.getTime()
}

const mergeContiguousBlockIntervals = (
  intervals: { from: Date; to: Date; block: RentalBlockWithAccounting }[]
): { from: Date; to: Date; block: RentalBlockWithAccounting }[] => {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort(
    (a, b) => a.from.getTime() - b.from.getTime()
  )
  const merged: { from: Date; to: Date; block: RentalBlockWithAccounting }[] = [
    sorted[0],
  ]
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1]
    const curr = sorted[i]
    if (
      curr.block === prev.block &&
      (datesAreContiguous(prev.to, curr.from) ||
        prev.to.getTime() === curr.from.getTime())
    ) {
      prev.to = new Date(Math.max(prev.to.getTime(), curr.to.getTime()))
    } else {
      merged.push(curr)
    }
  }
  return merged
}
//#endregion

export const uploadCsvFiles = async (
  companyId: string,
  aggregateAccountingCsv: string[],
  ledgerAccountingCsv: string[]
) => {
  const company = config.companies.find(
    (company) => company.xpandId.localeCompare(companyId) === 0
  )

  if (!company) {
    logger.error({ companyId }, 'Could not find company')
    throw new Error('Could not find company ' + companyId)
  }

  const aggregateFilename = `${company.xpandId}/${Date.now()}-${company.xpandId}-aggregated.gl.csv`
  await uploadFile(aggregateFilename, aggregateAccountingCsv.join('\n'))

  const ledgerFilename = `${company.xpandId}/${Date.now()}-${company.xpandId}-ledger.gl.csv`
  await uploadFile(ledgerFilename, ledgerAccountingCsv.join('\n'))
}

export const uploadRentalLossCsvFile = async (
  companyId: string,
  rentalLossAccountingCsv: string[]
) => {
  const company = config.companies.find(
    (company) => company.xpandId.localeCompare(companyId) === 0
  )

  if (!company) {
    logger.error({ companyId }, 'Could not find company')
    throw new Error('Could not find company ' + companyId)
  }

  const aggregateFilename = `${company.xpandId}/${Date.now()}-${company.xpandId}-rental-loss.gl.csv`
  await uploadFile(aggregateFilename, rentalLossAccountingCsv.join('\n'))
}
