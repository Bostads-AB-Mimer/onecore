import {
  createBatch,
  addAccountInformation,
  getAggregatedInvoiceRows,
  getCounterPartCustomers,
  saveInvoiceRows,
  saveContacts,
  getContacts as getInvoiceContacts,
  markInvoicesAsImported,
  closeDb as closeInvoiceDb,
  getInvoicesByChunks,
  getImportedInvoiceNumbers,
  getAllInvoiceRows,
  verifyImport,
  getBatchAccountTotals,
} from './adapters/invoice-data-db-adapter'
import {
  enrichInvoiceRows,
  getRoundOffInformation,
  getContacts as getXpandContacts,
  closeDb as closeXpandDb,
  getRentalInvoices,
  getInvoiceRows as getXpandInvoiceRows,
  getBatchTotalAmount as getXpandBatchTotalAmount,
} from './adapters/xpand-db-adapter'
import {
  CounterPartCustomers,
  LedgerInvoice,
  InvoiceContract,
  InvoiceDataRow,
  Invoice,
} from '../../common/types/legacyTypes'
import {
  createCustomerLedgerRow,
  transformAggregatedInvoiceRow,
  transformContact,
  uploadFile as uploadFileToXledger,
} from './adapters/xledger-adapter'
import { Contact } from '@onecore/types'
import { logger } from '@onecore/utilities'

const createRoundOffRow = async (
  invoice: Invoice,
  counterPartCustomers: CounterPartCustomers
): Promise<InvoiceDataRow> => {
  const fromDateString = invoice.fromdate as string
  const year = fromDateString.substring(0, 4)
  const roundOffInformation = await getRoundOffInformation(year)
  let totalAccount = '2970'
  let ledgerAccount = '1530'
  const tenantName = (invoice.cmctcben as string).trimEnd()

  const counterPartCustomer = counterPartCustomers.find(
    counterPartCustomers.customers,
    tenantName
  )

  if (counterPartCustomer) {
    totalAccount = counterPartCustomer.totalAccount
    ledgerAccount = counterPartCustomer.ledgerAccount
  }

  return {
    account: roundOffInformation.account,
    costCode: roundOffInformation.costCode,
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

  const rowsByInvoiceNumber: Record<string, InvoiceDataRow[]> = {}
  invoiceDataRows.forEach((invoiceDataRow) => {
    if (rowsByInvoiceNumber[invoiceDataRow.invoiceNumber] === undefined) {
      rowsByInvoiceNumber[invoiceDataRow.invoiceNumber] = []
    }

    rowsByInvoiceNumber[invoiceDataRow.invoiceNumber].push(invoiceDataRow)
  })

  const invoices = Object.keys(rowsByInvoiceNumber).map((invoiceNumber) => {
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
  })

  const counterPartCustomers = await getCounterPartCustomers()

  for (const invoice of invoices) {
    if ((invoice.roundoff as number) !== 0) {
      const roundOffRow = await createRoundOffRow(invoice, counterPartCustomers)
      invoiceDataRows.push(roundOffRow)
    }
  }

  const invoiceTable: Record<string, Invoice> = {}
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
    noOfPeriods: ledgerRows[0].noOfPeriods,
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
    const currentInvoices: LedgerInvoice[] = []
    const invoice = rowsByInvoiceNumber[invoiceNumbers[currentStart]][0]
    const ledgerAccount = invoice.LedgerAccount
    const invoiceDate = invoice.InvoiceDate
    const chunkInvoiceRows: InvoiceDataRow[] = []
    const startTime = Date.now()

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
        currentInvoice.InvoiceDate === invoiceDate
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
        elapsed: Date.now() - startTime,
      },
      'Creating ledger chunk'
    )

    currentStart += currentInvoices.length

    for (const invoice of currentInvoices) {
      const invoiceRows = rowsByInvoiceNumber[invoice.invoiceNumber]

      const counterPart = counterPartCustomers.find(
        counterPartCustomers.customers,
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
          { customerLedgerRow, invoice: invoiceRows[0].invoiceNumber },
          'Invoice total does not match ledger total'
        )
        throw new Error('Invoice total does not match ledger total')
      }
      chunkInvoiceRows.push(customerLedgerRow)
    }

    transactionRows.push(...chunkInvoiceRows)

    const totalRow = createLedgerTotalRow(chunkInvoiceRows)
    transactionRows.push(totalRow)

    let ledgerChunkRowsTotal = chunkInvoiceRows.reduce((sum: number, row) => {
      sum += row.amount as number
      return sum
    }, 0)

    ledgerChunkRowsTotal =
      Math.round(((ledgerChunkRowsTotal as number) + Number.EPSILON) * 100) /
      100

    logger.info(
      {
        difference: ledgerChunkRowsTotal + (totalRow.amount as number),
      },
      'Ledger chunk created'
    )

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

  if (!totalRow.account || totalRow.account == 'null') {
    console.log(aggregatedRows[0])
    throw new Error('Account is missing in aggregation')
  }

  return totalRow
}

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
        currentInvoice.totalAccount == totalAccount
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

    const chunkTotalRow = createAggregateTotalRow(aggregatedRows)

    transactionRows.push(chunkTotalRow)

    let aggregatedRowsTotal = aggregatedRows.reduce((sum: number, row) => {
      sum += row.amount as number
      return sum
    }, 0)

    aggregatedRowsTotal =
      Math.round(((aggregatedRowsTotal as number) + Number.EPSILON) * 100) / 100

    logger.info(
      { difference: aggregatedRowsTotal + (chunkTotalRow.amount as number) },
      'Aggregate chunk created'
    )

    chunkNum++
  }

  const accountTotals = calculateAccountTotals(transactionRows)
  const batchAccountTotals = await getBatchAccountTotals(batchId)

  try {
    verifyAccountTotals(accountTotals, batchAccountTotals)
  } catch {
    return null
  }

  return transactionRows
}

export const uploadFile = async (filename: string, csvFile: string) => {
  return await uploadFileToXledger(filename, csvFile)
}

export const getContactFromInvoiceRows = (
  contactCode: string,
  invoiceDataRows: InvoiceDataRow[]
): Contact | null => {
  const invoiceRow = invoiceDataRows.find((row) => {
    return (row.contactCode as string) === contactCode
  })

  if (!invoiceRow) {
    logger.error({ contactCode }, 'Could not find contact in invoiceDataRows')
    return null
  }

  return {
    contactCode: invoiceRow.contactCode as string,
    address: {
      street: invoiceRow.rentalObjectName as string,
      city: 'Västerås',
      postalCode: '',
      number: '',
    },
    contactKey: '',
    firstName: '',
    lastName: '',
    fullName: invoiceRow.tenantName as string,
    nationalRegistrationNumber: '',
    isTenant: true,
    phoneNumbers: [],
    birthDate: new Date(),
  }
}

export const getBatchContactsCsv = async (batchId: string) => {
  const invoiceContacts = await getInvoiceContacts(batchId)
  const contacts = invoiceContacts.map(transformContact)

  const csvContent: string[] = []

  csvContent.push(
    'Code;Description;Company No;Email;Street Address;Zip Code;City;Invoice Delivery Method;GL Object Value 5;Group;Collection Code'
  )

  contacts.forEach((contact) => {
    csvContent.push(
      `${contact.code};${contact.description};${contact.companyNo};${contact.email};${contact.streetAddress};${contact.zipCode};${contact.city};${contact.invoiceDeliveryMethod};${contact.counterPart};${contact.group};${contact.counterPart ? contact.group : ''}`
    )
  })

  return csvContent.join('\n')
}

export const getBatchAggregatedRowsCsv = async (batchId: string) => {
  const transactionRows = await createAggregateRows(batchId)
  if (transactionRows) {
    const csvContent: string[] = []

    csvContent.push(
      'Voucher Type;Voucher No;Voucher Date;Account;Posting 1;Posting 2;Posting 3;Posting 4;Posting 5;Period Start;No of Periods;Subledger No;Invoice Date;Invoice No;OCR;Due Date;Text;TaxRule;Amount'
    )

    transactionRows.forEach((transactionRow) => {
      csvContent.push(
        `${transactionRow.voucherType};${transactionRow.voucherNo};${transformDate(transactionRow.voucherDate)};${transactionRow.account};${transactionRow.posting1 || ''};${transactionRow.posting2 || ''};${transactionRow.posting3 || ''};${transactionRow.posting4 || ''};${transactionRow.posting5 || ''};${transformDate(transactionRow.periodStart)};${transactionRow.noOfPeriods};${transactionRow.subledgerNo};${transformDate(transactionRow.invoiceDate)};${transactionRow.invoiceNo};${transactionRow.ocr};${transformDate(transactionRow.dueDate)};${transactionRow.text};${transactionRow.taxRule};${transactionRow.amount}`
      )
    })

    return csvContent.join('\n')
  }
}

export const getBatchLedgerRowsCsv = async (batchId: string) => {
  const transactionRows = await createLedgerRows(batchId)

  const csvContent: string[] = []

  csvContent.push(
    'Voucher Type;Voucher No;Voucher Date;Account;Posting 1;Posting 2;Posting 3;Posting 4;Posting 5;Period Start;No of Periods;Subledger No;Invoice Date;Invoice No;OCR;Due Date;Text;TaxRule;Amount'
  )

  transactionRows.forEach((transactionRow) => {
    csvContent.push(
      `${transactionRow.voucherType};${transactionRow.voucherNo};${transformDate(transactionRow.voucherDate)};${transactionRow.account};${transactionRow.posting1};${transactionRow.posting2};${transactionRow.posting3};${transactionRow.posting4};${transactionRow.posting5};${transformDate(transactionRow.periodStart)};${transactionRow.noOfPeriods};${transactionRow.subledgerNo};${transformDate(transactionRow.invoiceDate)};${transactionRow.invoiceNo};${transactionRow.ocr};${transformDate(transactionRow.dueDate)};${transactionRow.text};${transactionRow.taxRule};${transactionRow.amount}`
    )
  })

  return csvContent.join('\n')
}

export const transformDate = (value: string | number) => {
  if (value == undefined || typeof value === 'number' || value === '') {
    return ''
  }
  return (value as string).replaceAll('-', '')
}

export const uploadInvoiceFile = async (
  filename: string,
  csvContent: string
) => {
  await uploadFileToXledger(filename, csvContent)
}

export const markBatchAsProcessed = async (batchId: number) => {
  await markInvoicesAsImported(batchId)
}

export const closeDatabases = () => {
  closeXpandDb()
  closeInvoiceDb()
}

const getContractCode = (invoiceRow: InvoiceDataRow) => {
  if ((invoiceRow.rowType as number) !== 3) {
    logger.error(
      { invoiceRow },
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

const cleanInvoiceRows = (invoiceRows: InvoiceDataRow[]) => {
  const cleanedInvoiceRows: InvoiceDataRow[] = []
  let currentContractCode = ''

  invoiceRows.forEach((invoiceRow) => {
    if ((invoiceRow.rowType as number) === 3) {
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

export const importInvoiceRows = async (
  fromDate: Date,
  toDate: Date,
  companyId: string
) => {
  try {
    const errors: { invoiceNumber: string; error: string }[] = []
    const CHUNK_SIZE = 500

    const importedInvoiceNumbers = await getImportedInvoiceNumbers()
    const rentalInvoiceNumbers = (
      await getRentalInvoices(fromDate, toDate, companyId)
    ).map((invoice: any) => {
      try {
        const invoiceNumber = invoice.invoice.trimEnd()
        return invoiceNumber
      } catch (err) {
        logger.error({ invoice, err }, 'Error getting invoice number')
      }
    })

    const invoicesToImport = rentalInvoiceNumbers.filter(
      (rentalInvoiceNumber: string) =>
        !importedInvoiceNumbers.includes(rentalInvoiceNumber)
    )

    /*const rentalInvoiceNumbers = []
    const invoicesToImport = ['552511356128155K']*/

    if (!invoicesToImport || invoicesToImport.length === 0) {
      return {
        batchId: null,
        processedInvoices: 0,
        errorInvoices: null,
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

    const invoiceRows = await getXpandInvoiceRows(
      fromDate.getFullYear(),
      companyId,
      invoicesToImport
    )
    const invoiceDataRows = cleanInvoiceRows(invoiceRows as any)

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
    logger.info(`Created new batch: ${batchId}`)

    let chunkStart = 0

    while (chunkStart < invoiceDataRows.length) {
      // Find first row with a new invoice number past the max chunk size
      let chunkEnd = Math.min(
        chunkStart + CHUNK_SIZE,
        invoiceDataRows.length - 1
      )

      let endInvoiceNumber = invoiceDataRows[chunkEnd].invoiceNumber

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
      const contacts = await getXpandContacts(contactCodes.contacts)
      await saveContacts(contacts, batchId)
    }

    await verifyImport(invoicesToImport, batchId, batchTotal)

    return {
      batchId,
      errors,
      processedInvoices: invoicesToImport.length,
    }
  } catch (error: any) {
    logger.error(error, 'Error importing invoices - batch could not be created')

    throw error
  }
}

const calculateAccountTotals = (aggregateRows: InvoiceDataRow[]) => {
  const accountTotals: Record<string, number> = {}

  aggregateRows.forEach((aggregateRow) => {
    const accountTotal = accountTotals[aggregateRow.account] || 0
    accountTotals[aggregateRow.account] =
      accountTotal + (aggregateRow.amount as number)
  })

  const accounts = Object.keys(accountTotals)

  accounts.forEach((account) => {
    accountTotals[account] =
      Math.round((accountTotals[account] + Number.EPSILON) * 100) / 100
  })

  return accountTotals
}

const verifyAccountTotals = (
  accountTotals: Record<string, number>,
  batchAccountTotals: Record<string, number>
) => {
  let debtAccountTotal = 0

  Object.keys(accountTotals).forEach((account) => {
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
      'Debt account total ${debAccountTotal} not matching batch account totals ${batchTotal}'
    )
  }

  return true
}
