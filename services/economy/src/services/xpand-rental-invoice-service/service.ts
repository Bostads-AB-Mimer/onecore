/**
 * Legacy export of accounting for rental invoices created in Xpand to Xledger,
 * run by the import-rental-invoices script. Invoices are imported from Xpand
 * into a batch in invoice_data, enriched with accounting and written as
 * contact, aggregate and ledger CSV files for Xledger.
 *
 * Rental invoices created in Tenfast are exported by
 * invoice-service/exportRentalInvoicesAccounting, which does not use
 * invoice_data or invoice_import_status.
 */
import { logger } from '@onecore/utilities'

import {
  CounterPartCustomer,
  Invoice as InvoiceData,
  InvoiceDataRow,
} from '@src/common/types'
import {
  createBatch,
  saveContacts,
  getCounterPartCustomers,
  findCounterPartCustomer,
  closeDb as closeInvoiceDb,
} from '@src/services/invoice-service/adapters/invoice-data-db-adapter'
import {
  getContacts as getXpandContacts,
  getRoundOffInformation,
  closeDb as closeXpandDb,
} from '@src/services/invoice-service/adapters/xpand-db-adapter'
import {
  createCustomerLedgerRow,
  getPeriodInformationFromDateStrings,
} from '@src/services/common/adapters/xledger-adapter'
import {
  addAccountInformation,
  getAggregatedInvoiceRows,
  getAllInvoiceRows,
  getBatchAccountTotals,
  getImportedInvoiceNumbers,
  getInvoicesByChunks,
  markInvoicesAsImported,
  saveInvoiceRows,
  verifyImport,
  closeDb as closeXpandInvoiceDb,
} from './adapters/invoice-data-db-adapter'
import {
  enrichInvoiceRows,
  getBatchTotalAmount as getXpandBatchTotalAmount,
  getInvoiceRows as getXpandInvoiceRows,
  getRentalInvoices,
  closeDb as closeXpandInvoiceRowsDb,
} from './adapters/xpand-db-adapter'
import { InvoiceContract, InvoiceImportError, LedgerInvoice } from './types'

const CSV_HEADER =
  'Voucher Type;Voucher No;Voucher Date;Account;Posting 1;Posting 2;Posting 3;Posting 4;Posting 5;Period Start;No of Periods;Subledger No;Invoice Date;Invoice No;OCR;Due Date;Text;TaxRule;Amount'

const roundToCents = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100

const createRoundOffRow = async (
  invoice: InvoiceData,
  counterPartCustomers: CounterPartCustomer[]
): Promise<InvoiceDataRow> => {
  const fromDateString = invoice.fromdate as string
  const year = fromDateString.substring(0, 4)
  const roundOffInformation = await getRoundOffInformation(year)
  let totalAccount = '2970'
  let ledgerAccount = '1530'
  const tenantName = (invoice.cmctcben as string).trimEnd()

  const counterPartCustomer = findCounterPartCustomer(
    counterPartCustomers,
    tenantName
  )

  if (counterPartCustomer) {
    totalAccount = counterPartCustomer.totalAccount
    ledgerAccount = counterPartCustomer.ledgerAccount
  }

  const roundOffRow: InvoiceDataRow = {
    account: roundOffInformation.account,
    ...(roundOffInformation.costCode && {
      costCode: roundOffInformation.costCode,
    }),
    amount: invoice.roundoff as number,
    totalAmount: invoice.roundoff as number,
    invoiceDate: invoice.invdate as string,
    invoiceNumber: (invoice.invoice as string).trimEnd(),
    invoiceRowText: 'Öresutjämning',
    fromDate: fromDateString,
    toDate: invoice.todate as string,
    contractCode: (invoice.reference as string).trimEnd(),
    totalAccount,
    ledgerAccount,
    contactCode: (invoice.cmctckod as string).trimEnd(),
    tenantName,
    invoiceTotalAmount: invoice.invoicetotal as number,
  }

  if (counterPartCustomer) {
    roundOffRow['counterPart'] = counterPartCustomer.counterPartCode
  }

  return roundOffRow
}

/**
 * Enriches each invoice row of a batch with accounting data from Xpand. Saves each
 * enriched row to invoice_data in economy db. Also adds a roundoff row for each
 * unique invoice that has a roundoff.
 *
 * @param invoiceDataRows Array of invoice rows from Xpand
 * @param batchId Batch ID previously created
 * @returns All contact codes referred to in invoice data rows, and the
 * invoices that could not be enriched
 */
export const processInvoiceRows = async (
  invoiceDataRows: InvoiceDataRow[],
  batchId: string
): Promise<{
  contacts: string[]
  errors: InvoiceImportError[]
}> => {
  const addedContactCodes: Record<string, boolean> = {}

  const counterPartCustomers = await getCounterPartCustomers()

  const rowsByInvoiceNumber: Record<string, InvoiceDataRow[]> = {}
  invoiceDataRows.forEach((invoiceDataRow) => {
    if (rowsByInvoiceNumber[invoiceDataRow.invoiceNumber] === undefined) {
      rowsByInvoiceNumber[invoiceDataRow.invoiceNumber] = []
    }

    if (invoiceDataRow.tenantName) {
      const counterPartCustomer = findCounterPartCustomer(
        counterPartCustomers,
        invoiceDataRow.tenantName.toString()
      )

      if (counterPartCustomer) {
        invoiceDataRow.counterPart = counterPartCustomer.counterPartCode
      }
    }

    rowsByInvoiceNumber[invoiceDataRow.invoiceNumber].push(invoiceDataRow)
  })

  const invoices: InvoiceData[] = Object.keys(rowsByInvoiceNumber).map(
    (invoiceNumber) => {
      const invoiceRow = rowsByInvoiceNumber[invoiceNumber][0]

      return {
        fromdate: invoiceRow.fromDate,
        cmctcben: invoiceRow.tenantName,
        roundoff: invoiceRow.roundoff,
        invdate: invoiceRow.invoiceDate,
        todate: invoiceRow.toDate,
        reference: invoiceRow.contractCode,
        cmctckod: invoiceRow.contactCode,
        invoice: invoiceRow.invoiceNumber,
        expdate: invoiceRow.invoiceDueDate,
        invoicetotal: invoiceRow.invoiceTotalAmount,
      }
    }
  )

  for (const invoice of invoices) {
    if ((invoice.roundoff as number) !== 0) {
      const roundOffRow = await createRoundOffRow(invoice, counterPartCustomers)
      invoiceDataRows.push(roundOffRow)
    }
  }

  const invoiceTable: Record<string, InvoiceData> = {}
  invoices.forEach((invoice) => {
    invoiceTable[(invoice.invoice as string).trimEnd()] = invoice
  })

  const enrichedInvoiceRows = await enrichInvoiceRows(
    invoiceDataRows,
    invoiceTable
  )

  const enrichedInvoiceRowsWithAccounts = await addAccountInformation(
    enrichedInvoiceRows.rows
  )

  enrichedInvoiceRowsWithAccounts.forEach((row) => {
    addedContactCodes[row.contactCode] = true
  })

  await saveInvoiceRows(enrichedInvoiceRowsWithAccounts, batchId)

  return {
    contacts: Object.keys(addedContactCodes),
    errors: enrichedInvoiceRows.errors,
  }
}

/**
 * Creates the balancing row of a voucher, on the total account of the first
 * row, with the negated sum of the rows.
 */
export const createTotalRow = (rows: InvoiceDataRow[]): InvoiceDataRow => {
  const amount = rows.reduce((acc, row) => acc - (row.amount as number), 0)

  return {
    voucherType: 'AR',
    voucherNo: rows[0].voucherNo,
    voucherDate: rows[0].voucherDate,
    account: rows[0].totalAccount,
    posting1: '',
    posting2: '',
    posting3: '',
    posting4: '',
    posting5: rows[0].posting5,
    periodStart: rows[0].periodStart,
    noOfPeriods: rows[0].noOfPeriods,
    subledgerNo: '',
    invoiceDate: '',
    invoiceNo: '',
    ocr: '',
    dueDate: '',
    text: '',
    taxRule: '',
    amount: roundToCents(amount),
    counterPart: rows[0].counterPart,
  }
}

export const createLedgerRows = async (
  batchId: string
): Promise<InvoiceDataRow[]> => {
  const transactionRows: InvoiceDataRow[] = []

  const invoiceRows = await getAllInvoiceRows(batchId)

  const rowsByInvoiceNumber: Record<string, InvoiceDataRow[]> = {}
  invoiceRows.forEach((invoiceRow) => {
    if (rowsByInvoiceNumber[invoiceRow.InvoiceNumber] === undefined) {
      rowsByInvoiceNumber[invoiceRow.InvoiceNumber] = []
    }

    rowsByInvoiceNumber[invoiceRow.InvoiceNumber].push(invoiceRow)
  })

  const invoiceNumbers = Object.keys(rowsByInvoiceNumber)

  const CHUNK_SIZE = 500
  let currentStart = 0
  let chunkNum = 0
  const counterPartCustomers = await getCounterPartCustomers()

  while (currentStart < invoiceNumbers.length) {
    // Create chunks of maximum CHUNK_SIZE invoices with the same ledger
    // account, invoice date and counterpart, one voucher per chunk.
    const currentInvoices: LedgerInvoice[] = []
    const invoice = rowsByInvoiceNumber[invoiceNumbers[currentStart]][0]
    const ledgerAccount = invoice.LedgerAccount
    const invoiceDate = invoice.InvoiceDate
    const counterPart = invoice.CounterPart
    const chunkInvoiceRows: InvoiceDataRow[] = []

    for (
      let currentInvoiceIndex = currentStart;
      currentInvoiceIndex < CHUNK_SIZE + currentStart &&
      currentInvoiceIndex < invoiceNumbers.length;
      currentInvoiceIndex++
    ) {
      const currentInvoice =
        rowsByInvoiceNumber[invoiceNumbers[currentInvoiceIndex]][0]

      if (
        currentInvoice.LedgerAccount === ledgerAccount &&
        currentInvoice.InvoiceDate === invoiceDate &&
        currentInvoice.CounterPart === counterPart
      ) {
        currentInvoices.push({
          contractCode: currentInvoice.ContractCode as string,
          invoiceNumber: currentInvoice.InvoiceNumber as string,
          invoiceFromDate: currentInvoice.InvoiceFromDate as string,
          invoiceToDate: currentInvoice.InvoiceToDate as string,
          invoiceDate: currentInvoice.InvoiceDate as string,
          ledgerAccount: currentInvoice.LedgerAccount as string,
          totalAccount: currentInvoice.TotalAccount as string,
          tenantName: currentInvoice.TenantName as string,
        })
      } else {
        break
      }
    }

    logger.info(
      {
        startNum: currentStart,
        endNum: currentInvoices.length + currentStart - 1,
      },
      'Creating ledger chunk'
    )

    currentStart += currentInvoices.length

    for (const invoice of currentInvoices) {
      const invoiceRows = rowsByInvoiceNumber[invoice.invoiceNumber]

      const counterPart = findCounterPartCustomer(
        counterPartCustomers,
        invoiceRows[0].TenantName as string
      )

      const customerLedgerRow = createCustomerLedgerRow(
        invoiceRows,
        batchId,
        chunkNum,
        counterPart ? counterPart.counterPartCode : ''
      )

      if (
        (customerLedgerRow.amount as number) -
          (invoiceRows[0].InvoiceTotalAmount as number) >
        1
      ) {
        logger.error(
          { customerLedgerRow, invoice: invoiceRows[0].InvoiceNumber },
          'Invoice total does not match ledger total'
        )
        throw new Error('Invoice total does not match ledger total')
      }
      chunkInvoiceRows.push(customerLedgerRow)
    }

    transactionRows.push(...chunkInvoiceRows)

    const totalRow = createTotalRow(chunkInvoiceRows)
    transactionRows.push(totalRow)

    chunkNum++
  }

  return transactionRows
}

// Xpand rows are stored with dates as YYYYMMDD
const isoDateString = (xledgerDate: string) =>
  `${xledgerDate.substring(0, 4)}-${xledgerDate.substring(4, 6)}-${xledgerDate.substring(6, 8)}`

const getTaxRule = (totalAmount: number, totalVat: number, account: string) => {
  const vatRate = Math.round((totalVat * 100) / (totalAmount - totalVat))
  // Accounts with tax rule 208 instead of 2 for 25% VAT
  const accounts208 = ['3012', '3014', '3016']

  switch (vatRate) {
    case 25:
      return accounts208.includes(account) ? '208' : '2'
    case 12:
      return '21'
    case 6:
      return '22'
    default:
      return ''
  }
}

export const transformAggregatedInvoiceRow = (
  invoiceRow: InvoiceDataRow,
  chunkNumber: number
): InvoiceDataRow => {
  const periodInformation = getPeriodInformationFromDateStrings(
    null,
    isoDateString(invoiceRow.InvoiceFromDate as string),
    isoDateString(invoiceRow.InvoiceToDate as string)
  )

  return {
    voucherType: 'AR',
    // Aggregate vouchers start with 1, ledger vouchers with 2
    voucherNo:
      '1' +
      invoiceRow.BatchId.toString().padStart(5, '0') +
      chunkNumber.toString().padStart(3, '0'),
    voucherDate: invoiceRow.InvoiceFromDate,
    account: invoiceRow.Account,
    posting1: invoiceRow.CostCode,
    posting2: invoiceRow.ProjectCode,
    posting3: invoiceRow.Property,
    posting4: invoiceRow.FreeCode,
    posting5: invoiceRow.CounterPart,
    periodStart: periodInformation.periodStart,
    noOfPeriods: periodInformation.periods,
    subledgerNo: '',
    invoiceDate: '',
    invoiceNo: '',
    ocr: '',
    dueDate: '',
    text: '',
    taxRule: getTaxRule(
      invoiceRow.totalAmount as number,
      invoiceRow.totalVat as number,
      invoiceRow.Account as string
    ),
    amount: -invoiceRow.totalAmount,
    totalAccount: invoiceRow.TotalAccount,
  }
}

export const createAggregateTotalRow = (
  aggregatedRows: InvoiceDataRow[]
): InvoiceDataRow => {
  const totalRow = createTotalRow(aggregatedRows)

  if (!totalRow.account || totalRow.account == 'null') {
    logger.error(
      { aggregatedRow: aggregatedRows[0] },
      'Account is missing in aggregation'
    )
    throw new Error('Account is missing in aggregation')
  }

  return totalRow
}

/**
 * Creates the aggregated income rows of the batch, grouped on accounting, in
 * vouchers of invoices with the same period, total account and counterpart.
 * Returns null if the account totals do not match the batch.
 */
export const createAggregateRows = async (batchId: string) => {
  const transactionRows: InvoiceDataRow[] = []

  // Do transaction rows in chunks of contracts to get different
  // voucher numbers.
  const invoices = await getInvoicesByChunks(batchId)
  const CHUNK_SIZE = 500
  let currentStart = 0
  let chunkNum = 0

  while (currentStart < invoices.length) {
    // Create chunks of maximum CHUNK_SIZE invoices
    // where all invoices invoices have the same start
    // and end dates, and totalAccount.
    const currentInvoices: InvoiceContract[] = []
    const startDate = invoices[currentStart].invoiceFromDate
    const endDate = invoices[currentStart].invoiceToDate
    const totalAccount = invoices[currentStart].totalAccount
    const counterPart = invoices[currentStart].counterPart

    for (
      let currentInvoicesIndex = currentStart;
      currentInvoicesIndex < CHUNK_SIZE + currentStart &&
      currentInvoicesIndex < invoices.length;
      currentInvoicesIndex++
    ) {
      const currentInvoice = invoices[currentInvoicesIndex]

      if (
        currentInvoice.invoiceFromDate == startDate &&
        currentInvoice.invoiceToDate == endDate &&
        currentInvoice.totalAccount == totalAccount &&
        currentInvoice.counterPart == counterPart
      ) {
        currentInvoices.push(invoices[currentInvoicesIndex])
      } else {
        break
      }
    }
    logger.info(
      { start: currentStart, end: currentInvoices.length + currentStart - 1 },
      'Aggregate chunk'
    )
    currentStart += currentInvoices.length

    // Get aggregated rows for chunk
    const aggregatedDbRows = await getAggregatedInvoiceRows(
      batchId,
      currentInvoices.map((invoice) => invoice.invoiceNumber)
    )
    const aggregatedRows = aggregatedDbRows.map((row) => {
      return transformAggregatedInvoiceRow(row, chunkNum)
    })
    transactionRows.push(...aggregatedRows)

    transactionRows.push(createAggregateTotalRow(aggregatedRows))

    chunkNum++
  }

  const accountTotals = calculateAccountTotals(transactionRows)
  const batchAccountTotals = await getBatchAccountTotals(batchId)

  try {
    verifyAccountTotals(accountTotals, batchAccountTotals)
  } catch {
    // verifyAccountTotals logs the difference
    return null
  }

  return transactionRows
}

export const transformDate = (value: string | number) => {
  if (value == undefined || typeof value === 'number' || value === '') {
    return ''
  }
  return value.replaceAll('-', '')
}

const toCsvLine = (transactionRow: InvoiceDataRow) =>
  `${transactionRow.voucherType};${transactionRow.voucherNo};${transformDate(transactionRow.voucherDate)};${transactionRow.account};${transactionRow.posting1 || ''};${transactionRow.posting2 || ''};${transactionRow.posting3 || ''};${transactionRow.posting4 || ''};${transactionRow.posting5 || ''};${transformDate(transactionRow.periodStart)};${transactionRow.noOfPeriods};${transactionRow.subledgerNo};${transformDate(transactionRow.invoiceDate)};${transactionRow.invoiceNo};${transactionRow.ocr};${transformDate(transactionRow.dueDate)};${transactionRow.text};${transactionRow.taxRule};${transactionRow.amount}`

/**
 * Returns the aggregate CSV for the batch, or null if it has no rows or
 * its account totals do not match the batch.
 */
export const getBatchAggregatedRowsCsv = async (batchId: string) => {
  const transactionRows = await createAggregateRows(batchId)

  if (!transactionRows?.length) {
    return null
  }

  return [CSV_HEADER, ...transactionRows.map(toCsvLine)].join('\n')
}

export const getBatchLedgerRowsCsv = async (batchId: string) => {
  const transactionRows = await createLedgerRows(batchId)

  if (transactionRows.length === 0) {
    return null
  }

  return [CSV_HEADER, ...transactionRows.map(toCsvLine)].join('\n')
}

export const markBatchAsProcessed = async (batchId: number) => {
  await markInvoicesAsImported(batchId)
}

export const closeDatabases = () => {
  closeXpandDb()
  closeXpandInvoiceRowsDb()
  closeInvoiceDb()
  closeXpandInvoiceDb()
}

const getContractCode = (invoiceRow: InvoiceDataRow) => {
  if ((invoiceRow.rowType as number) !== 3) {
    logger.error(
      { invoiceNumber: invoiceRow.invoiceNumber },
      'Wrong type of invoice row for getting contract code'
    )
    throw new Error('Wrong type of invoice row for getting contract code')
  }

  if ((invoiceRow.invoiceRowText as string).split(',').length > 1) {
    return (invoiceRow.invoiceRowText as string).split(',')[0]
  } else {
    return (invoiceRow.invoiceRowText as string).split(' ')[0]
  }
}

/**
 * Removes the header rows (row type 3) of the invoices and sets the contract
 * code from the latest header row on the rows that follow it.
 */
export const cleanInvoiceRows = (invoiceRows: InvoiceDataRow[]) => {
  const cleanedInvoiceRows: InvoiceDataRow[] = []
  let currentContractCode = ''

  invoiceRows.forEach((invoiceRow) => {
    if ((invoiceRow.rowType as number) === 3) {
      // Header rows for a contract start with the contract code
      if (/^\d/.test(invoiceRow.invoiceRowText as string)) {
        currentContractCode = getContractCode(invoiceRow)
      }
    } else {
      invoiceRow.contractCode = currentContractCode
      cleanedInvoiceRows.push(invoiceRow)
    }
  })

  return cleanedInvoiceRows
}

/**
 * Imports the rental invoices of the company in Xpand, with a from date in the
 * interval, that are not yet imported into a new batch.
 */
export const importInvoiceRows = async (
  fromDate: Date,
  toDate: Date,
  companyId: string
): Promise<{
  batchId: string | null
  processedInvoices: number
  errors: InvoiceImportError[] | null
}> => {
  try {
    const errors: InvoiceImportError[] = []
    const CHUNK_SIZE = 500

    const importedInvoiceNumbers = new Set(await getImportedInvoiceNumbers())
    const rentalInvoiceNumbers = await getRentalInvoices(
      fromDate,
      toDate,
      companyId
    )

    const invoicesToImport = rentalInvoiceNumbers.filter(
      (rentalInvoiceNumber) => !importedInvoiceNumbers.has(rentalInvoiceNumber)
    )

    if (invoicesToImport.length === 0) {
      return {
        batchId: null,
        processedInvoices: 0,
        errors: null,
      }
    }

    const batchTotal = await getXpandBatchTotalAmount(invoicesToImport)

    logger.info(
      {
        invoicesInXpand: rentalInvoiceNumbers.length,
        invoicesToImport: invoicesToImport.length,
      },
      'Importing invoices'
    )

    const invoiceRows = await getXpandInvoiceRows(companyId, invoicesToImport)
    const invoiceDataRows = cleanInvoiceRows(invoiceRows)

    logger.info(
      {
        readRows: invoiceRows.length,
        rowsToProcess: invoiceDataRows.length,
        companyId,
      },
      'Got invoice rows from xpand db'
    )

    if (invoiceRows.length === 0) {
      return {
        batchId: null,
        processedInvoices: 0,
        errors: null,
      }
    }

    const batchId = await createBatch(batchTotal)
    logger.info({ batchId }, 'Created new batch')

    let chunkStart = 0

    while (chunkStart < invoiceDataRows.length) {
      // Find first row with a new invoice number past the max chunk size
      let chunkEnd = Math.min(
        chunkStart + CHUNK_SIZE,
        invoiceDataRows.length - 1
      )

      const endInvoiceNumber = invoiceDataRows[chunkEnd].invoiceNumber

      while (
        chunkEnd < invoiceDataRows.length &&
        invoiceDataRows[chunkEnd].invoiceNumber === endInvoiceNumber
      ) {
        chunkEnd++
      }

      logger.info(
        {
          chunkStart: chunkStart,
          chunkEnd: chunkEnd - 1,
          totalRows: invoiceDataRows.length,
        },
        'Processing rows'
      )
      const chunkInvoiceDataRows = invoiceDataRows.slice(chunkStart, chunkEnd)
      chunkStart = chunkEnd

      const contactCodes = await processInvoiceRows(
        chunkInvoiceDataRows,
        batchId
      )

      errors.push(...contactCodes.errors)

      const contacts = await getXpandContacts(contactCodes.contacts)
      await saveContacts(contacts, batchId)
    }

    const errorInvoiceNumbers = new Set(
      errors.map((error) => error.invoiceNumber)
    )
    const importedInvoices = invoicesToImport.filter(
      (invoiceNumber) => !errorInvoiceNumbers.has(invoiceNumber)
    )

    await verifyImport(importedInvoices, batchId, batchTotal)

    return {
      batchId,
      errors,
      processedInvoices: importedInvoices.length,
    }
  } catch (err: unknown) {
    logger.error(
      { err },
      'Error importing invoices - batch could not be created'
    )

    throw err
  }
}

const calculateAccountTotals = (aggregateRows: InvoiceDataRow[]) => {
  const accountTotals: Record<string, number> = {}

  aggregateRows.forEach((aggregateRow) => {
    const accountTotal = accountTotals[aggregateRow.account] || 0
    accountTotals[aggregateRow.account] =
      accountTotal + (aggregateRow.amount as number)
  })

  Object.keys(accountTotals).forEach((account) => {
    accountTotals[account] = roundToCents(accountTotals[account])
  })

  return accountTotals
}

const verifyAccountTotals = (
  accountTotals: Record<string, number>,
  batchAccountTotals: Record<string, number>
) => {
  let debtAccountTotal = 0

  Object.keys(accountTotals).forEach((account) => {
    // 29xx are the total (debt) accounts of the vouchers
    if (account.startsWith('29')) {
      debtAccountTotal += accountTotals[account]
    } else {
      if (
        Math.abs(accountTotals[account] + batchAccountTotals[account]) > 0.01
      ) {
        logger.error(
          {
            account,
            difference: accountTotals[account] + batchAccountTotals[account],
          },
          'Account amount not matching'
        )
        throw new Error('Account amount not matching: ' + account)
      }
    }
  })

  const batchTotal = Object.keys(batchAccountTotals).reduce((sum, account) => {
    return (sum += batchAccountTotals[account])
  }, 0)

  if (Math.abs(batchTotal - debtAccountTotal) > 1) {
    logger.error(
      {
        batchTotal,
        debtAccountTotal,
        difference: Math.abs(batchTotal - debtAccountTotal),
      },
      'Debt account total not matching batch account totals'
    )
    throw new Error(
      `Debt account total ${debtAccountTotal} not matching batch account totals ${batchTotal}`
    )
  }

  return true
}
