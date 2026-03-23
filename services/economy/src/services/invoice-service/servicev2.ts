import {
  getCounterPartCustomers,
  findCounterPartCustomer,
} from './adapters/invoice-data-db-adapter'
import {
  getRoundOffInformation,
  enrichInvoiceWithAccounting,
} from './adapters/xpand-db-adapter'
import {
  InvoiceWithAccounting,
  ExportedInvoiceRow,
  TOTAL_ACCOUNT,
  CUSTOMER_LEDGER_ACCOUNT,
  AggregatedRow,
  LedgerRow,
  xledgerDateString,
} from '../../common/types/typesv2'
import { getPeriodInformationFromDateStrings } from '../common/adapters/xledger-adapter'
import { logger } from '@onecore/utilities'
import { getInvoicesNotExported } from '@src/common/adapters/tenfast/tenfast-adapter'

/**
 *
 */
export const exportRentalInvoicesAccounting = async (companyId: string) => {
  try {
    const errors: { invoiceNumber: string; error: string }[] = []
    const CHUNK_SIZE = 20 //500

    const invoicesResult = await getInvoicesNotExported(CHUNK_SIZE)
    if (!invoicesResult.ok) {
      logger.error(
        { error: invoicesResult.err },
        'Could not get rental invoices for export'
      )
      throw new Error(invoicesResult.err)
    } else {
      logger.info(
        { invoicesToImport: invoicesResult.data.length },
        'Importing invoices'
      )
    }

    const invoices = invoicesResult.data
    const counterPartCustomers = await getCounterPartCustomers()

    for (const invoice of invoices) {
      await enrichInvoiceWithAccounting(invoice)

      const counterPartCustomer = findCounterPartCustomer(
        counterPartCustomers,
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

    invoices.sort((a: InvoiceWithAccounting, b: InvoiceWithAccounting) => {
      return (
        a.ledgerAccount?.localeCompare(b.ledgerAccount ?? '') ||
        a.totalAccount?.localeCompare(b.totalAccount ?? '') ||
        dateString(a.fromDate)?.localeCompare(dateString(b.fromDate) ?? '') ||
        dateString(a.toDate)?.localeCompare(dateString(b.toDate) ?? '') ||
        0
      )
    })

    return invoices
  } catch (error: any) {
    logger.error(error, 'Error importing invoices - batch could not be created')

    throw error
  }
}

export const createAggregateAccounting = async (
  invoices: InvoiceWithAccounting[]
) => {
  const invoiceRowsForExport = await getExportInvoiceRows(invoices)
  const aggregateAccountingCsv = await createAggregateCsv(invoiceRowsForExport)
  const ledgerAccountingCsv = await createLedgerCsv(invoices)
  //onst contactsCsv = await getContacts(invoices)

  console.log('--- AGGREGATE CSV ---')
  console.log(aggregateAccountingCsv.join('\n'))
  console.log('---------')

  console.log('\n--- LEDGER CSV ---')
  console.log(ledgerAccountingCsv.join('\n'))
  console.log('---------')

  /*console.log('\n--- CONTACT CSV ---')
  console.log(contactsCsv.join('\n'))
  console.log('---------')*/

  return invoiceRowsForExport
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
        deduction: invoiceRow.deduction,
        vat: invoiceRow.vat,
        invoiceDate: invoice.invoiceDate,
        invoiceDueDate: invoice.expirationDate,
        invoiceNumber: invoice.invoiceId,
        invoiceRowText: invoiceRow.invoiceRowText,
        fromDate: invoice.fromDate,
        toDate: invoice.toDate,
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
    costCode: roundOffInformation.costCode,
    amount: invoice.roundoff as number,
    rowTotalAmount: invoice.roundoff as number,
    invoiceDate: invoice.invoiceDate,
    invoiceNumber: invoice.invoiceId,
    invoiceRowText: 'Öresutjämning',
    fromDate: invoice.fromDate,
    toDate: invoice.toDate,
    contractCode: invoice.leaseId,
    totalAccount,
    ledgerAccount,
    counterPartCode: invoice.counterPartCode,
    contactCode: invoice.recipientContactCode,
    tenantName: invoice.recipientName,
  }
}

//#region Aggregate
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
      '2' +
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
  const groupedRows = [
    ...invoiceRows
      .reduce((r, o) => {
        const key =
          o.account +
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
          vat: 0,
        }

        aggregatedRow.amount = safeAdd(aggregatedRow.amount, o.amount)
        aggregatedRow.vat = safeAdd(aggregatedRow.vat, o.vat)

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
    vat: 0,
  }

  const totalRow = aggregatedRows.reduce((acc: AggregatedRow, row) => {
    acc.amount = (acc.amount as number) - (row.amount as number)
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
    const taxRule = '2'
    const periodInfo = getPeriodInformationFromDateStrings(
      row.voucherDate,
      row.fromDate,
      row.toDate
    )
    csvRows.push(
      `AR;${row.voucherNumber};${xledgerDateString(row.voucherDate)};${row.account};${row.costCode || ''};${row.projectCode || ''};${row.property || ''};${row.freeCode || ''};${row.counterPartCode || ''};${periodInfo.periodStart};${periodInfo.periodStart};${''};${''};${''};${''};${''};${''};${''};${taxRule};${row.amount}`
    )
  })

  return csvRows
}
//#endregion

//#region Ledger
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
      '2' +
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
