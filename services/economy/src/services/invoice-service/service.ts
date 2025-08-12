import {
  addAccountInformation,
  getAggregatedInvoiceRows,
  getContracts,
  getCounterPartCustomers,
  getInvoiceRows,
  saveInvoiceRows,
} from './adapters/invoice-data-db-adapter'
import {
  enrichInvoiceRows,
  getInvoices,
  getRoundOffInformation,
} from './adapters/xpand-db-adapter'
import {
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
  console.log('invoice', invoice)
  const fromDateString = xledgerDateString(invoice.fromdate as Date)
  const year = fromDateString.substring(0, 4)
  const roundOffInformation = await getRoundOffInformation(year)

  return {
    account: roundOffInformation.account,
    costCode: roundOffInformation.costCode,
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
  batchId: string,
  invoiceDate: string,
  invoiceDueDate: string
): Promise<string[]> => {
  const addedContactCodes: Record<string, boolean> = {}

  const invoices = await getInvoices(invoiceDataRows)

  for (const invoice of invoices) {
    if ((invoice.roundoff as number) > 0) {
      const roundOffRow = await createRoundOffRow(invoice)
      invoiceDataRows.push(roundOffRow)
    }
  }

  const enrichedInvoiceRows = await enrichInvoiceRows(
    invoiceDataRows,
    invoiceDate,
    invoiceDueDate,
    invoices
  )

  const enrichedInvoiceRowsWithAccounts =
    await addAccountInformation(enrichedInvoiceRows)

  enrichedInvoiceRowsWithAccounts.forEach((row) => {
    addedContactCodes[row.contactCode] = true
  })

  await saveInvoiceRows(enrichedInvoiceRowsWithAccounts, batchId)

  return Object.keys(addedContactCodes)
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

  // Do transaction rows in chunks of contracts to get different
  // voucher numbers.
  const contracts = await getContracts(batchId)
  const CHUNK_SIZE = 500
  let currentStart = 0
  let chunkNum = 0

  while (currentStart < contracts.length) {
    const currentContracts: InvoiceContract[] = []
    const ledgerAccount = contracts[currentStart].ledgerAccount
    const chunkContractRows: InvoiceDataRow[] = []
    const counterPartCustomers = await getCounterPartCustomers()

    for (
      let currentContractIndex = currentStart;
      currentContractIndex < CHUNK_SIZE + currentStart &&
      currentContractIndex < contracts.length;
      currentContractIndex++
    ) {
      const currentContract = contracts[currentContractIndex]

      if (currentContract.ledgerAccount == ledgerAccount) {
        currentContracts.push(contracts[currentContractIndex])
      } else {
        break
      }
    }
    console.log(
      'Ledger chunk',
      currentStart,
      currentContracts.length + currentStart - 1
    )
    currentStart += currentContracts.length

    for (const contract of currentContracts) {
      const contractInvoiceRows = await getInvoiceRows(
        contract.contractCode,
        batchId
      )

      const counterPart = counterPartCustomers.find((counterPart) =>
        (contractInvoiceRows[0].TenantName as string).startsWith(
          counterPart.CustomerName
        )
      )

      const customerLedgerRow = await createCustomerLedgerRow(
        contractInvoiceRows,
        batchId,
        chunkNum,
        counterPart ? counterPart.CounterpartCode : ''
      )

      chunkContractRows.push(customerLedgerRow)
    }

    transactionRows.push(...chunkContractRows)

    const totalRow = createLedgerTotalRow(chunkContractRows)
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
