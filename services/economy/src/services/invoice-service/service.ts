import {
  addAccountInformation,
  getAggregatedInvoiceRows,
  getContracts,
  getCounterPartCustomers,
  getInvoiceRows,
  getInvoices,
  saveInvoiceRows,
} from './adapters/invoice-data-db-adapter'
import {
  enrichInvoiceRows,
  getInvoices as getXpandInvoices,
  getRoundOffInformation,
} from './adapters/xpand-db-adapter'
import {
  LedgerInvoice,
  InvoiceContract,
  InvoiceDataRow,
  Invoice,
  xledgerDateString,
} from '../../common/types'
import {
  createCustomerLedgerRow,
  transformAggregatedInvoiceRow,
} from './adapters/xledger-adapter'

const createRoundOffRow = async (invoice: Invoice): Promise<InvoiceDataRow> => {
  const fromDateString = xledgerDateString(invoice.fromdate as Date)
  const year = fromDateString.substring(0, 4)
  const roundOffInformation = await getRoundOffInformation(year)

  return {
    account: roundOffInformation.account,
    costCode: roundOffInformation.costCode,
    amount: invoice.roundoff as number,
    totalAmount: invoice.roundoff as number,
    invoiceDate: xledgerDateString(invoice.invdate as Date),
    invoiceNumber: (invoice.invoice as string).trimEnd(),
    invoiceRowText: 'Öresutjämning',
    fromDate: fromDateString,
    toDate: xledgerDateString(invoice.todate as Date),
    contractCode: (invoice.reference as string).trimEnd(),
    totalAccount: 2970,
    ledgerAccount: 1530,
    contactCode: (invoice.cmctckod as string).trimEnd(),
    tenantName: (invoice.cmctcben as string).trimEnd(),
  }
}

/**
 * Enriches each invoice row of a batch with accounting data from Xpand. Saves each
 * enriched row to invoice_data in economy db. Also adds a roundoff row for each
 * unique invoice that has a roundoff.
 *
 * @param invoiceDataRows Array of invoice rows from Xpand
 * @param batchId Batch ID previously created
 * @param invoiceDate Invoice date
 * @param invoiceDueDate Invoice due date
 * @returns Array of all contact codes referred to in invoice data rows
 */
export const processInvoiceRows = async (
  invoiceDataRows: InvoiceDataRow[],
  batchId: string
): Promise<{
  contacts: string[]
  errors: { invoiceNumber: string; error: string }[]
}> => {
  const addedContactCodes: Record<string, boolean> = {}

  const invoices = await getXpandInvoices(invoiceDataRows)

  for (const invoice of invoices) {
    if ((invoice.roundoff as number) !== 0) {
      const roundOffRow = await createRoundOffRow(invoice)
      invoiceDataRows.push(roundOffRow)
    }
  }

  const enrichedInvoiceRows = await enrichInvoiceRows(invoiceDataRows, invoices)

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

export const createLedgerTotalRow = (
  ledgerRows: InvoiceDataRow[]
): InvoiceDataRow => {
  const accumulator = {
    voucherType: 'AR',
    voucherNo: ledgerRows[0].voucherNo,
    voucherDate: ledgerRows[0].voucherDate,
    account: ledgerRows[0].totalAccount,
    posting1: '',
    posting2: '',
    posting3: '',
    posting4: '',
    posting5: '',
    periodStart: ledgerRows[0].periodStart,
    noOfPeriods: '',
    subledgerNo: '',
    invoiceDate: '',
    invoiceNo: '',
    ocr: '',
    dueDate: '',
    text: '',
    taxRule: '',
    amount: 0,
  }

  const totalRow = ledgerRows.reduce((acc: InvoiceDataRow, row) => {
    acc.amount = (acc.amount as number) - (row.amount as number)
    return acc
  }, accumulator)

  totalRow.amount =
    Math.round(((totalRow.amount as number) + Number.EPSILON) * 100) / 100

  return totalRow
}

export const createLedgerRows = async (
  batchId: string
): Promise<InvoiceDataRow[]> => {
  const transactionRows: InvoiceDataRow[] = []

  // Do transaction rows in chunks of invoices to get different
  // voucher numbers.
  const invoices = await getInvoices(batchId)
  //  const contracts = await getContracts(batchId)
  const CHUNK_SIZE = 500
  let currentStart = 0
  let chunkNum = 0

  while (currentStart < invoices.length) {
    const currentInvoices: LedgerInvoice[] = []
    const ledgerAccount = invoices[currentStart].ledgerAccount
    const invoiceDate = invoices[currentStart].invoiceDate
    const chunkInvoiceRows: InvoiceDataRow[] = []
    const counterPartCustomers = await getCounterPartCustomers()

    for (
      let currentInvoiceIndex = currentStart;
      currentInvoiceIndex < CHUNK_SIZE + currentStart &&
      currentInvoiceIndex < invoices.length;
      currentInvoiceIndex++
    ) {
      const currentInvoice = invoices[currentInvoiceIndex]

      if (
        currentInvoice.ledgerAccount == ledgerAccount &&
        currentInvoice.invoiceDate === invoiceDate
      ) {
        currentInvoices.push(invoices[currentInvoiceIndex])
      } else {
        break
      }
    }
    console.log(
      'Ledger chunk',
      currentStart,
      currentInvoices.length + currentStart - 1
    )
    currentStart += currentInvoices.length

    for (const invoice of currentInvoices) {
      const invoiceRows = await getInvoiceRows(invoice.invoiceNumber, batchId)

      const counterPart = counterPartCustomers.find((counterPart) =>
        (invoiceRows[0].TenantName as string).startsWith(
          counterPart.CustomerName
        )
      )

      const customerLedgerRow = await createCustomerLedgerRow(
        invoiceRows,
        batchId,
        chunkNum,
        counterPart ? counterPart.CounterpartCode : ''
      )

      chunkInvoiceRows.push(customerLedgerRow)
    }

    transactionRows.push(...chunkInvoiceRows)

    const totalRow = createLedgerTotalRow(chunkInvoiceRows)
    transactionRows.push(totalRow)

    chunkNum++
  }

  return transactionRows
}

export const createAggregateTotalRow = (
  aggregatedRows: InvoiceDataRow[]
): InvoiceDataRow => {
  const accumulator = {
    voucherType: 'AR',
    voucherNo: aggregatedRows[0].voucherNo,
    voucherDate: aggregatedRows[0].voucherDate,
    account: aggregatedRows[0].totalAccount,
    posting1: '',
    posting2: '',
    posting3: '',
    posting4: '',
    posting5: '',
    periodStart: aggregatedRows[0].periodStart,
    noOfPeriods: aggregatedRows[0].noOfPeriods,
    subledgerNo: '',
    invoiceDate: '',
    invoiceNo: '',
    ocr: '',
    dueDate: '',
    text: '',
    taxRule: '',
    amount: 0,
  }

  const totalRow = aggregatedRows.reduce((acc: InvoiceDataRow, row) => {
    acc.amount = (acc.amount as number) - (row.amount as number)
    return acc
  }, accumulator)

  totalRow.amount =
    Math.round(((totalRow.amount as number) + Number.EPSILON) * 100) / 100

  return totalRow
}

export const createAggregateRows = async (batchId: string) => {
  const transactionRows: InvoiceDataRow[] = []

  // Do transaction rows in chunks of contracts to get different
  // voucher numbers.
  const contracts = await getContracts(batchId)
  const CHUNK_SIZE = 500
  let currentStart = 0
  let chunkNum = 0

  while (currentStart < contracts.length) {
    // Create chunks of maximum CHUNK_SIZE contracts
    // where all contracts invoices have the same start
    // and end dates, and totalAccount.
    const currentContracts: InvoiceContract[] = []
    const startDate = contracts[currentStart].invoiceFromDate
    const endDate = contracts[currentStart].invoiceToDate
    const totalAccount = contracts[currentStart].totalAccount

    for (
      let currentContractIndex = currentStart;
      currentContractIndex < CHUNK_SIZE + currentStart &&
      currentContractIndex < contracts.length;
      currentContractIndex++
    ) {
      const currentContract = contracts[currentContractIndex]

      if (
        currentContract.invoiceFromDate == startDate &&
        currentContract.invoiceToDate == endDate &&
        currentContract.totalAccount == totalAccount
      ) {
        currentContracts.push(contracts[currentContractIndex])
      } else {
        break
      }
    }
    console.log(
      'Aggregate chunk',
      currentStart,
      currentContracts.length + currentStart - 1
    )
    currentStart += currentContracts.length

    // Get aggregated rows for chunk
    const aggregatedDbRows = await getAggregatedInvoiceRows(
      batchId,
      currentContracts.map((contract) => contract.contractCode)
    )
    const aggregatedRows = aggregatedDbRows.map((row) => {
      return transformAggregatedInvoiceRow(row, chunkNum)
    })
    transactionRows.push(...aggregatedRows)

    const chunkTotalRow = createAggregateTotalRow(aggregatedRows)

    transactionRows.push(chunkTotalRow)

    chunkNum++
  }

  return transactionRows
}
