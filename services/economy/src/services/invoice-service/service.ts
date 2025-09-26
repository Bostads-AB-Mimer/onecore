import {
  createBatch,
  addAccountInformation,
  getAggregatedInvoiceRows,
  getCounterPartCustomers,
  getInvoiceRows,
  getInvoices,
  saveInvoiceRows,
  saveContacts,
  getContacts as getInvoiceContacts,
  markInvoicesAsImported,
  excludeExportedInvoices,
  closeDb as closeInvoiceDb,
  getInvoicesByChunks,
  getImportedInvoiceNumbers,
  getAllInvoiceRows,
} from './adapters/invoice-data-db-adapter'
import {
  enrichInvoiceRows,
  getInvoices as getXpandInvoices,
  getRoundOffInformation,
  getContacts as getXpandContacts,
  closeDb as closeXpandDb,
  getRentalInvoices,
  getInvoiceRows as getXpandInvoiceRows,
} from './adapters/xpand-db-adapter'
import {
  CounterPartCustomers,
  LedgerInvoice,
  InvoiceContract,
  InvoiceDataRow,
  Invoice,
  xledgerDateString,
} from '../../common/types'
import {
  createCustomerLedgerRow,
  transformAggregatedInvoiceRow,
  transformContact,
  uploadFile as uploadFileToXledger,
} from './adapters/xledger-adapter'
import { Contact } from '@onecore/types'
import { excelFileToInvoiceDataRows } from './adapters/excel-adapter'
import { logger } from '@onecore/utilities'

const createRoundOffRow = async (
  invoice: Invoice,
  counterPartCustomers: CounterPartCustomers
): Promise<InvoiceDataRow> => {
  const fromDateString = invoice.fromdate as string //xledgerDateString(invoice.fromdate as Date)
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
    invoiceDate: invoice.invdate as string, //xledgerDateString(invoice.invdate as Date),
    invoiceNumber: (invoice.invoice as string).trimEnd(),
    invoiceRowText: 'Öresutjämning',
    fromDate: fromDateString,
    toDate: invoice.todate as string, //xledgerDateString(invoice.todate as Date),
    contractCode: (invoice.reference as string).trimEnd(),
    totalAccount,
    ledgerAccount,
    contactCode: (invoice.cmctckod as string).trimEnd(),
    tenantName,
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

  //const invoices = await getXpandInvoices(invoiceDataRows)

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

export const createLedgerRowsNew = async (
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
      //const invoiceRows = await getInvoiceRows(invoice.invoiceNumber, batchId)
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

export const createLedgerRows = async (
  batchId: string
): Promise<InvoiceDataRow[]> => {
  const transactionRows: InvoiceDataRow[] = []

  // Do transaction rows in chunks of invoices to get different
  // voucher numbers.
  const invoices = await getInvoices(batchId)
  const CHUNK_SIZE = 500
  let currentStart = 0
  let chunkNum = 0
  const counterPartCustomers = await getCounterPartCustomers()

  while (currentStart < invoices.length) {
    const currentInvoices: LedgerInvoice[] = []
    const ledgerAccount = invoices[currentStart].ledgerAccount
    const invoiceDate = invoices[currentStart].invoiceDate
    const chunkInvoiceRows: InvoiceDataRow[] = []
    const startTime = Date.now()

    for (
      let currentInvoiceIndex = currentStart;
      currentInvoiceIndex < CHUNK_SIZE + currentStart &&
      currentInvoiceIndex < invoices.length;
      currentInvoiceIndex++
    ) {
      const currentInvoice = invoices[currentInvoiceIndex]

      if (
        currentInvoice.ledgerAccount === ledgerAccount &&
        currentInvoice.invoiceDate === invoiceDate
      ) {
        currentInvoices.push(invoices[currentInvoiceIndex])
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
      const invoiceRows = await getInvoiceRows(invoice.invoiceNumber, batchId)

      const counterPart = counterPartCustomers.find(
        counterPartCustomers.customers,
        invoiceRows[0].TenantName as string
      )

      const customerLedgerRow = await createCustomerLedgerRow(
        invoiceRows,
        batchId,
        chunkNum,
        counterPart ? counterPart.counterPartCode : ''
      )

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

export const processInvoiceDataFile = async (
  invoiceDataFileName: string,
  companyId: string
): Promise<{
  batchId: string
  errors: { invoiceNumber: string; error: string }[]
}> => {
  try {
    const errors: { invoiceNumber: string; error: string }[] = []
    const CHUNK_SIZE = 500

    const fileInvoiceDataRows = (
      await excelFileToInvoiceDataRows(invoiceDataFileName)
    ).filter((row) => (row.company as string) === companyId)

    const invoiceDataRows = await excludeExportedInvoices(fileInvoiceDataRows)

    console.log(
      'Read',
      fileInvoiceDataRows.length,
      'rows, importing',
      invoiceDataRows.length,
      'for company',
      companyId
    )

    let chunkNum = 0
    const batchId = await createBatch()
    logger.info(`Created new batch: ${batchId}`)

    while (CHUNK_SIZE * chunkNum < invoiceDataRows.length) {
      const startNum = chunkNum * CHUNK_SIZE
      const endNum = Math.min(
        (chunkNum + 1) * CHUNK_SIZE,
        invoiceDataRows.length
      )
      const currentInvoiceDataRows = invoiceDataRows.slice(startNum, endNum)
      logger.info(
        {
          chunkStart: startNum,
          chunkEnd: endNum,
          totalRows: invoiceDataRows.length,
        },
        'Processing rows'
      )
      const contactCodes = await processInvoiceRows(
        currentInvoiceDataRows,
        batchId
      )
      const contacts = await getXpandContacts(contactCodes.contacts)
      const result = await saveContacts(contacts, batchId)

      /*if (contactCodes.errors && contactCodes.errors.length > 0) {
        errors.push(contactCodes.err  ors)
      }*/

      chunkNum++
    }

    return {
      batchId,
      errors,
    }
  } catch (error: any) {
    logger.error(
      error,
      'Error processing invoice data file - batch could not be created'
    )

    throw error
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

export const getBatchLedgerRowsCsv = async (batchId: string) => {
  const transactionRows = await createLedgerRowsNew(batchId)

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

export const missingInvoices = async (batchId: string) => {
  const invoiceDbInvoices = (await getInvoices(batchId))
    .filter((invoice) => invoice.invoiceFromDate.localeCompare('20251001') >= 0)
    .map((invoice) => invoice.invoiceNumber)
  const xpandInvoices: string[] = (
    await getRentalInvoices(new Date(2025, 9, 1), '001')
  ).map((invoice: any): string => (invoice.invoice as string).trimEnd())

  const onlyInInvoiceDb = invoiceDbInvoices.filter((dbInvoice) => {
    return !xpandInvoices.includes(dbInvoice)
  })

  const onlyInXpandDb = xpandInvoices.filter((xpandInvoice) => {
    return !invoiceDbInvoices.includes(xpandInvoice)
  })

  console.log(
    'Invoice db',
    invoiceDbInvoices.length,
    'Xpand',
    xpandInvoices.length
  )

  console.log('Only in invoice db', onlyInInvoiceDb)
  console.log('Only in xpand db', onlyInXpandDb)
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
        console.log('Error getting invoice number', invoice, err)
      }
    })

    const invoicesToImport = rentalInvoiceNumbers.filter(
      (rentalInvoiceNumber: string) =>
        !importedInvoiceNumbers.includes(rentalInvoiceNumber)
    )

    logger.info(
      {
        invoicesInXpand: rentalInvoiceNumbers.length,
        invoicesToImport: invoicesToImport.length,
      },
      'Importing invoices'
    )

    const invoiceRows = await getXpandInvoiceRows(
      fromDate,
      toDate,
      companyId,
      invoicesToImport
    )
    const invoiceDataRows = invoiceRows
    //const invoiceDataRows = await excludeExportedInvoices(invoiceRows)

    logger.info(
      {
        readRows: invoiceRows.length,
        rowsToProcess: invoiceDataRows.length,
        companyId,
      },
      'Got invoice rows from xpand db'
    )

    let chunkNum = 0
    const batchId = await createBatch()
    logger.info(`Created new batch: ${batchId}`)

    while (CHUNK_SIZE * chunkNum < invoiceDataRows.length) {
      const startNum = chunkNum * CHUNK_SIZE
      const endNum = Math.min(
        (chunkNum + 1) * CHUNK_SIZE,
        invoiceDataRows.length
      )
      logger.info(
        {
          chunkStart: startNum,
          chunkEnd: endNum,
          totalRows: invoiceDataRows.length,
        },
        'Processing rows'
      )
      const currentInvoiceDataRows = invoiceDataRows.slice(startNum, endNum)
      const contactCodes = await processInvoiceRows(
        currentInvoiceDataRows,
        batchId
      )
      const contacts = await getXpandContacts(contactCodes.contacts)
      const result = await saveContacts(contacts, batchId)
      /*if (contactCodes.errors && contactCodes.errors.length > 0) {
        errors.push(contactCodes.err  ors)
      }*/
      chunkNum++
    }

    return {
      batchId,
      errors,
    }
  } catch (error: any) {
    logger.error(error, 'Error importing invoices - batch could not be created')

    throw error
  }
}
