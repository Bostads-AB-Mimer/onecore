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
  enrichInvoiceWithAccounting,
} from './adapters/xpand-db-adapter'
import {
  CounterPartCustomers,
  InvoiceWithAccounting,
  ExportedInvoiceRow,
  TOTAL_ACCOUNT,
  CUSTOMER_LEDGER_ACCOUNT,
  AggregatedRow,
} from '../../common/types/typesv2'
import {
  createCustomerLedgerRow,
  transformAggregatedInvoiceRow,
  transformContact,
  uploadFile as uploadFileToXledger,
} from './adapters/xledger-adapter'
import { Contact } from '@onecore/types'
import { logger } from '@onecore/utilities'
import {
  convertToDate,
  getInvoicesNotExported,
} from '@src/common/adapters/tenfast/tenfast-adapter'

/**
 *
 */
export const exportRentalInvoicesAccounting = async (companyId: string) => {
  try {
    const errors: { invoiceNumber: string; error: string }[] = []
    const CHUNK_SIZE = 500

    //const batchId = await createBatch()
    //logger.info(`Created new batch: ${batchId}`)

    //do {
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

    for (const invoice of invoices) {
      await enrichInvoiceWithAccounting(invoice)
    }

    return invoices

    /*      const invoiceDataRows = convertToInvoiceDataRows(invoicesToImport)
      const contactCodes = await processInvoiceRows(invoiceDataRows, batchId)
      const contacts = await getXpandContacts(contactCodes.contacts)
      await saveContacts(contacts, batchId)*/
    //    } while (invoicesResult.data.length > 0)
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

  return invoiceRowsForExport
}

const getExportInvoiceRows = async (invoices: InvoiceWithAccounting[]) => {
  const exportInvoiceRows: ExportedInvoiceRow[] = []
  const counterPartCustomers = await getCounterPartCustomers()

  for (const invoice of invoices) {
    let totalAccount = TOTAL_ACCOUNT
    let ledgerAccount = CUSTOMER_LEDGER_ACCOUNT
    const tenantName = invoice.recipientName

    const counterPartCustomer = counterPartCustomers.find(
      counterPartCustomers.customers,
      tenantName
    )

    if (counterPartCustomer) {
      totalAccount = counterPartCustomer.totalAccount
      ledgerAccount = counterPartCustomer.ledgerAccount
    }

    if (invoice.roundoff && invoice.roundoff !== 0) {
      exportInvoiceRows.push(
        await createRoundOffRow(invoice, totalAccount, ledgerAccount)
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
        totalAccount,
        ledgerAccount,
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
    contactCode: invoice.recipientContactCode,
    tenantName: invoice.recipientName,
  }
}

const createAggregateCsv = async (invoiceRows: ExportedInvoiceRow[]) => {
  const aggregateRows = createAggregateRows(invoiceRows)
  //const aggregateTotal
}

const createAggregateRows = async (invoiceRows: ExportedInvoiceRow[]) => {
  let currentStartDate = dateString(invoiceRows[0].fromDate)
  let currentEndDate = dateString(invoiceRows[0].toDate)
  let currentTotalAccount = invoiceRows[0].totalAccount
  let currentRows: ExportedInvoiceRow[] = []
  let aggregatedRows: AggregatedRow[] = []
  let voucherIndex = 0

  // Sort rows to get fewer chunks.
  invoiceRows.sort((a, b) => {
    return (
      a.ledgerAccount?.localeCompare(b.ledgerAccount ?? '') ||
      a.totalAccount?.localeCompare(b.totalAccount ?? '') ||
      dateString(a.fromDate)?.localeCompare(dateString(b.fromDate) ?? '') ||
      dateString(a.toDate)?.localeCompare(dateString(b.toDate) ?? '') ||
      a.invoiceNumber?.localeCompare(b.invoiceNumber ?? '') ||
      0
    )
  })

  invoiceRows.forEach((invoiceRow) => {
    if (
      dateString(invoiceRow.fromDate) == currentStartDate &&
      dateString(invoiceRow.toDate) == currentEndDate &&
      invoiceRow.totalAccount == currentTotalAccount
    ) {
      // Add row to current batch
      currentRows.push(invoiceRow)
    } else {
      const voucherNumber =
        '1' +
        '123'.toString().padStart(5, '0') +
        voucherIndex.toString().padStart(3, '0')
      voucherIndex++
      // create aggregate rows, reset current values, add row as first new batch
      const chunkRows = aggregateRows(currentRows, voucherNumber)
      aggregatedRows.push(...chunkRows)
      const chunkTotalRow = createAggregatedTotalRow(chunkRows, voucherNumber)
      aggregatedRows.push(chunkTotalRow)

      currentStartDate = dateString(invoiceRow.fromDate)
      currentEndDate = dateString(invoiceRow.toDate)
      currentTotalAccount = invoiceRow.totalAccount
      currentRows = [invoiceRow]
    }
  })

  const voucherNumber =
    '1' +
    '123'.toString().padStart(5, '0') +
    voucherIndex.toString().padStart(3, '0')
  const chunkRows = aggregateRows(currentRows, voucherNumber)
  aggregatedRows.push(...chunkRows)
  const chunkTotalRow = createAggregatedTotalRow(chunkRows, voucherNumber)
  aggregatedRows.push(chunkTotalRow)

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
const aggregateRows = (
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

        console.log(key)

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

// export const createAggregateRows = async (batchId: string) => {
//   const transactionRows: InvoiceDataRow[] = []

//   // Do transaction rows in chunks of contracts to get different
//   // voucher numbers.
//   const invoices = await getInvoicesByChunks(batchId)
//   const CHUNK_SIZE = 500
//   let currentStart = 0
//   let chunkNum = 0

//   while (currentStart < invoices.length) {
//     // Create chunks of maximum CHUNK_SIZE invoices
//     // where all invoices invoices have the same start
//     // and end dates, and totalAccount.
//     const currentInvoices: InvoiceContract[] = []
//     const startDate = invoices[currentStart].invoiceFromDate
//     const endDate = invoices[currentStart].invoiceToDate
//     const totalAccount = invoices[currentStart].totalAccount

//     for (
//       let currentInvoicesIndex = currentStart;
//       currentInvoicesIndex < CHUNK_SIZE + currentStart &&
//       currentInvoicesIndex < invoices.length;
//       currentInvoicesIndex++
//     ) {
//       const currentInvoice = invoices[currentInvoicesIndex]

//       if (
//         currentInvoice.invoiceFromDate == startDate &&
//         currentInvoice.invoiceToDate == endDate &&
//         currentInvoice.totalAccount == totalAccount
//       ) {
//         currentInvoices.push(invoices[currentInvoicesIndex])
//       } else {
//         break
//       }
//     }
//     logger.info(
//       { start: currentStart, end: currentInvoices.length + currentStart - 1 },
//       'Aggregate chunk'
//     )
//     currentStart += currentInvoices.length

//     // Get aggregated rows for chunk
//     const aggregatedDbRows = await getAggregatedInvoiceRows(
//       batchId,
//       currentInvoices.map((invoice) => invoice.invoiceNumber)
//     )
//     const aggregatedRows = aggregatedDbRows.map((row) => {
//       return transformAggregatedInvoiceRow(row, chunkNum)
//     })
//     transactionRows.push(...aggregatedRows)

//     const chunkTotalRow = createAggregateTotalRow(aggregatedRows)

//     transactionRows.push(chunkTotalRow)

//     let aggregatedRowsTotal = aggregatedRows.reduce((sum: number, row) => {
//       sum += row.amount as number
//       return sum
//     }, 0)

//     aggregatedRowsTotal =
//       Math.round(((aggregatedRowsTotal as number) + Number.EPSILON) * 100) / 100

//     logger.info(
//       { difference: aggregatedRowsTotal + (chunkTotalRow.amount as number) },
//       'Aggregate chunk created'
//     )

//     chunkNum++
//   }

//   const accountTotals = calculateAccountTotals(transactionRows)
//   const batchAccountTotals = await getBatchAccountTotals(batchId)

//   try {
//     verifyAccountTotals(accountTotals, batchAccountTotals)
//   } catch {
//     return null
//   }

//   return transactionRows
// }

// export const uploadFile = async (filename: string, csvFile: string) => {
//   return await uploadFileToXledger(filename, csvFile)
// }

// /**
//  * Enriches each invoice row of a batch with accounting data from Xpand. Saves each
//  * enriched row to invoice_data in economy db. Also adds a roundoff row for each
//  * unique invoice that has a roundoff.
//  *
//  * @param invoiceDataRows Array of invoice rows from Xpand
//  * @param batchId Batch ID previously created
//  * @param invoiceDate Invoice date
//  * @param invoiceDueDate Invoice due date
//  * @returns Array of all contact codes referred to in invoice data rows
//  */
// export const processInvoiceRows = async (
//   invoiceDataRows: InvoiceDataRow[],
//   batchId: string
// ): Promise<{
//   contacts: string[]
//   errors: { invoiceNumber: string; error: string }[]
// }> => {
//   const addedContactCodes: Record<string, boolean> = {}

//   const rowsByInvoiceNumber: Record<string, InvoiceDataRow[]> = {}
//   invoiceDataRows.forEach((invoiceDataRow) => {
//     if (rowsByInvoiceNumber[invoiceDataRow.invoiceNumber] === undefined) {
//       rowsByInvoiceNumber[invoiceDataRow.invoiceNumber] = []
//     }

//     rowsByInvoiceNumber[invoiceDataRow.invoiceNumber].push(invoiceDataRow)
//   })

//   const invoices = Object.keys(rowsByInvoiceNumber).map((invoiceNumber) => {
//     const invoiceRow = rowsByInvoiceNumber[invoiceNumber][0]

//     return {
//       fromdate: invoiceRow.fromDate,
//       cmctcben: invoiceRow.tenantName,
//       roundoff: invoiceRow.roundoff,
//       invdate: invoiceRow.invoiceDate,
//       todate: invoiceRow.toDate,
//       reference: invoiceRow.contractCode,
//       cmctckod: invoiceRow.contactCode,
//       invoice: invoiceRow.invoiceNumber,
//       expdate: invoiceRow.invoiceDueDate,
//       invoicetotal: invoiceRow.invoiceTotalAmount,
//     }
//   })

//   const counterPartCustomers = await getCounterPartCustomers()

//   for (const invoice of invoices) {
//     if ((invoice.roundoff as number) !== 0) {
//       const roundOffRow = await createRoundOffRow(invoice, counterPartCustomers)
//       invoiceDataRows.push(roundOffRow)
//     }
//   }

//   const invoiceTable: Record<string, Invoice> = {}
//   invoices.forEach((invoice) => {
//     invoiceTable[(invoice.invoice as string).trimEnd()] = invoice
//   })

//   const enrichedInvoiceRows = await enrichInvoiceRows(
//     invoiceDataRows,
//     invoiceTable
//   )

//   const enrichedInvoiceRowsWithAccounts = await addAccountInformation(
//     enrichedInvoiceRows.rows
//   )

//   enrichedInvoiceRowsWithAccounts.forEach((row) => {
//     addedContactCodes[row.contactCode] = true
//   })

//   await saveInvoiceRows(enrichedInvoiceRowsWithAccounts, batchId)

//   return {
//     contacts: Object.keys(addedContactCodes),
//     errors: enrichedInvoiceRows.errors,
//   }
// }

// export const createLedgerTotalRow = (
//   ledgerRows: InvoiceDataRow[]
// ): InvoiceDataRow => {
//   const accumulator = {
//     voucherType: 'AR',
//     voucherNo: ledgerRows[0].voucherNo,
//     voucherDate: ledgerRows[0].voucherDate,
//     account: ledgerRows[0].totalAccount,
//     posting1: '',
//     posting2: '',
//     posting3: '',
//     posting4: '',
//     posting5: '',
//     periodStart: ledgerRows[0].periodStart,
//     noOfPeriods: ledgerRows[0].noOfPeriods,
//     subledgerNo: '',
//     invoiceDate: '',
//     invoiceNo: '',
//     ocr: '',
//     dueDate: '',
//     text: '',
//     taxRule: '',
//     amount: 0,
//   }

//   const totalRow = ledgerRows.reduce((acc: InvoiceDataRow, row) => {
//     acc.amount = (acc.amount as number) - (row.amount as number)
//     return acc
//   }, accumulator)

//   totalRow.amount =
//     Math.round(((totalRow.amount as number) + Number.EPSILON) * 100) / 100

//   return totalRow
// }

// export const createLedgerRows = async (
//   batchId: string
// ): Promise<InvoiceDataRow[]> => {
//   const transactionRows: InvoiceDataRow[] = []

//   const invoiceRows = await getAllInvoiceRows(batchId)

//   const rowsByInvoiceNumber: Record<string, InvoiceDataRow[]> = {}
//   invoiceRows.forEach((invoiceRow) => {
//     if (rowsByInvoiceNumber[invoiceRow.InvoiceNumber] === undefined) {
//       rowsByInvoiceNumber[invoiceRow.InvoiceNumber] = []
//     }

//     rowsByInvoiceNumber[invoiceRow.InvoiceNumber].push(invoiceRow)
//   })

//   const invoiceNumbers = Object.keys(rowsByInvoiceNumber)

//   const CHUNK_SIZE = 500
//   let currentStart = 0
//   let chunkNum = 0
//   const counterPartCustomers = await getCounterPartCustomers()

//   while (currentStart < invoiceNumbers.length) {
//     const currentInvoices: LedgerInvoice[] = []
//     const invoice = rowsByInvoiceNumber[invoiceNumbers[currentStart]][0]
//     const ledgerAccount = invoice.LedgerAccount
//     const invoiceDate = invoice.InvoiceDate
//     const chunkInvoiceRows: InvoiceDataRow[] = []
//     const startTime = Date.now()

//     for (
//       let currentInvoiceIndex = currentStart;
//       currentInvoiceIndex < CHUNK_SIZE + currentStart &&
//       currentInvoiceIndex < invoiceNumbers.length;
//       currentInvoiceIndex++
//     ) {
//       const currentInvoice =
//         rowsByInvoiceNumber[invoiceNumbers[currentInvoiceIndex]][0]

//       if (
//         currentInvoice.LedgerAccount === ledgerAccount &&
//         currentInvoice.InvoiceDate === invoiceDate
//       ) {
//         currentInvoices.push({
//           contractCode: currentInvoice.ContractCode as string,
//           invoiceNumber: currentInvoice.InvoiceNumber as string,
//           invoiceFromDate: currentInvoice.InvoiceFromDate as string,
//           invoiceToDate: currentInvoice.InvoiceToDate as string,
//           invoiceDate: currentInvoice.InvoiceDate as string,
//           ledgerAccount: currentInvoice.LedgerAccount as string,
//           totalAccount: currentInvoice.TotalAccount as string,
//           tenantName: currentInvoice.TenantName as string,
//         })
//       } else {
//         break
//       }
//     }

//     logger.info(
//       {
//         startNum: currentStart,
//         endNum: currentInvoices.length + currentStart - 1,
//         elapsed: Date.now() - startTime,
//       },
//       'Creating ledger chunk'
//     )

//     currentStart += currentInvoices.length

//     for (const invoice of currentInvoices) {
//       const invoiceRows = rowsByInvoiceNumber[invoice.invoiceNumber]

//       const counterPart = counterPartCustomers.find(
//         counterPartCustomers.customers,
//         invoiceRows[0].TenantName as string
//       )

//       const customerLedgerRow = createCustomerLedgerRow(
//         invoiceRows,
//         batchId,
//         chunkNum,
//         counterPart ? counterPart.counterPartCode : ''
//       )

//       if (
//         (customerLedgerRow.amount as number) -
//           (invoiceRows[0].InvoiceTotalAmount as number) >
//         1
//       ) {
//         logger.error(
//           { customerLedgerRow, invoice: invoiceRows[0].invoiceNumber },
//           'Invoice total does not match ledger total'
//         )
//         throw new Error('Invoice total does not match ledger total')
//       }
//       chunkInvoiceRows.push(customerLedgerRow)
//     }

//     transactionRows.push(...chunkInvoiceRows)

//     const totalRow = createLedgerTotalRow(chunkInvoiceRows)
//     transactionRows.push(totalRow)

//     let ledgerChunkRowsTotal = chunkInvoiceRows.reduce((sum: number, row) => {
//       sum += row.amount as number
//       return sum
//     }, 0)

//     ledgerChunkRowsTotal =
//       Math.round(((ledgerChunkRowsTotal as number) + Number.EPSILON) * 100) /
//       100

//     logger.info(
//       {
//         difference: ledgerChunkRowsTotal + (totalRow.amount as number),
//       },
//       'Ledger chunk created'
//     )

//     chunkNum++
//   }

//   return transactionRows
// }

// export const getContactFromInvoiceRows = (
//   contactCode: string,
//   invoiceDataRows: InvoiceDataRow[]
// ): Contact | null => {
//   const invoiceRow = invoiceDataRows.find((row) => {
//     return (row.contactCode as string) === contactCode
//   })

//   if (!invoiceRow) {
//     logger.error({ contactCode }, 'Could not find contact in invoiceDataRows')
//     return null
//   }

//   return {
//     contactCode: invoiceRow.contactCode as string,
//     address: {
//       street: invoiceRow.rentalObjectName as string,
//       city: 'Västerås',
//       postalCode: '',
//       number: '',
//     },
//     contactKey: '',
//     firstName: '',
//     lastName: '',
//     fullName: invoiceRow.tenantName as string,
//     nationalRegistrationNumber: '',
//     isTenant: true,
//     phoneNumbers: [],
//     birthDate: new Date(),
//   }
// }

// export const getBatchContactsCsv = async (batchId: string) => {
//   const invoiceContacts = await getInvoiceContacts(batchId)
//   const contacts = invoiceContacts.map(transformContact)

//   const csvContent: string[] = []

//   csvContent.push(
//     'Code;Description;Company No;Email;Street Address;Zip Code;City;Invoice Delivery Method;GL Object Value 5;Group;Collection Code'
//   )

//   contacts.forEach((contact) => {
//     csvContent.push(
//       `${contact.code};${contact.description};${contact.companyNo};${contact.email};${contact.streetAddress};${contact.zipCode};${contact.city};${contact.invoiceDeliveryMethod};${contact.counterPart};${contact.group};${contact.counterPart ? contact.group : ''}`
//     )
//   })

//   return csvContent.join('\n')
// }

// export const getBatchAggregatedRowsCsv = async (batchId: string) => {
//   const transactionRows = await createAggregateRows(batchId)
//   if (transactionRows) {
//     const csvContent: string[] = []

//     csvContent.push(
//       'Voucher Type;Voucher No;Voucher Date;Account;Posting 1;Posting 2;Posting 3;Posting 4;Posting 5;Period Start;No of Periods;Subledger No;Invoice Date;Invoice No;OCR;Due Date;Text;TaxRule;Amount'
//     )

//     transactionRows.forEach((transactionRow) => {
//       csvContent.push(
//         `${transactionRow.voucherType};${transactionRow.voucherNo};${transformDate(transactionRow.voucherDate)};${transactionRow.account};${transactionRow.posting1 || ''};${transactionRow.posting2 || ''};${transactionRow.posting3 || ''};${transactionRow.posting4 || ''};${transactionRow.posting5 || ''};${transformDate(transactionRow.periodStart)};${transactionRow.noOfPeriods};${transactionRow.subledgerNo};${transformDate(transactionRow.invoiceDate)};${transactionRow.invoiceNo};${transactionRow.ocr};${transformDate(transactionRow.dueDate)};${transactionRow.text};${transactionRow.taxRule};${transactionRow.amount}`
//       )
//     })

//     return csvContent.join('\n')
//   }
// }

// export const getBatchLedgerRowsCsv = async (batchId: string) => {
//   const transactionRows = await createLedgerRows(batchId)

//   const csvContent: string[] = []

//   csvContent.push(
//     'Voucher Type;Voucher No;Voucher Date;Account;Posting 1;Posting 2;Posting 3;Posting 4;Posting 5;Period Start;No of Periods;Subledger No;Invoice Date;Invoice No;OCR;Due Date;Text;TaxRule;Amount'
//   )

//   transactionRows.forEach((transactionRow) => {
//     csvContent.push(
//       `${transactionRow.voucherType};${transactionRow.voucherNo};${transformDate(transactionRow.voucherDate)};${transactionRow.account};${transactionRow.posting1};${transactionRow.posting2};${transactionRow.posting3};${transactionRow.posting4};${transactionRow.posting5};${transformDate(transactionRow.periodStart)};${transactionRow.noOfPeriods};${transactionRow.subledgerNo};${transformDate(transactionRow.invoiceDate)};${transactionRow.invoiceNo};${transactionRow.ocr};${transformDate(transactionRow.dueDate)};${transactionRow.text};${transactionRow.taxRule};${transactionRow.amount}`
//     )
//   })

//   return csvContent.join('\n')
// }

// export const transformDate = (value: string | number) => {
//   if (value == undefined || typeof value === 'number' || value === '') {
//     return ''
//   }
//   return (value as string).replaceAll('-', '')
// }

// export const uploadInvoiceFile = async (
//   filename: string,
//   csvContent: string
// ) => {
//   await uploadFileToXledger(filename, csvContent)
// }

// export const markBatchAsProcessed = async (batchId: number) => {
//   await markInvoicesAsImported(batchId)
// }

// export const closeDatabases = () => {
//   closeXpandDb()
//   closeInvoiceDb()
// }

// const getContractCode = (invoiceRow: InvoiceDataRow) => {
//   if ((invoiceRow.rowType as number) !== 3) {
//     logger.error(
//       { invoiceRow },
//       'Wrong type of invoice row for getting contract code'
//     )
//     throw new Error('Wrong type of invoice row for getting contract code')
//   }

//   if ((invoiceRow.invoiceRowText as string).split(',').length > 1) {
//     return (invoiceRow.invoiceRowText as string).split(',')[0]
//   } else {
//     return (invoiceRow.invoiceRowText as string).split(' ')[0]
//   }
// }

// const convertToExportedInvoiceRows = async (
//   invoices: TenfastInvoice[]
// ): Promise<ExportedInvoiceRow[]> => {
//   const exportedInvoiceRows: ExportedInvoiceRow[] = []
//   const counterPartCustomers = await getCounterPartCustomers()

//   for (const invoice of invoices) {
//     const tenantName = 'Test' // TODO: await getTenant();
//     let totalAccount = TOTAL_ACCOUNT
//     let ledgerAccount = CUSTOMER_LEDGER_ACCOUNT

//     const counterPartCustomerInfo = counterPartCustomers.find(
//       counterPartCustomers.customers,
//       tenantName
//     )
//     if (counterPartCustomerInfo) {
//       totalAccount = counterPartCustomerInfo.totalAccount
//       ledgerAccount = counterPartCustomerInfo.ledgerAccount
//     }

//     for (const row of invoice.hyror) {
//       // TODO: Get rent article for row
//       const rentArticle = {
//         name: 'HYRABS',
//         account: '1122',
//         costCode: '550',
//       }

//       exportedInvoiceRows.push({
//         amount: row.amount,
//         deduction: 0, // TODO
//         vat: row.vat,
//         rowTotalAmount: row.amount + /*row.deduction +*/ row.vat,
//         invoiceTotalAmount: invoice.amount,
//         invoiceDate: convertToDate(invoice.activatedAt ?? ''), // TODO: ta reda på vad som faktiskt är fakturadatum
//         invoiceDueDate: convertToDate(invoice.due),
//         invoiceNumber: invoice.ocrNumber,
//         invoiceRowText: row.label,
//         fromDate: convertToDate(invoice.interval.from),
//         toDate: convertToDate(invoice.interval.to),
//         //contractCode: TODO
//         //contactCode: TODO
//         rentArticle: rentArticle.name,
//         account: rentArticle.account,
//         costCode: rentArticle.costCode,
//         //property: string TODO
//         //freeCode: string TODO
//         totalAccount,
//         ledgerAccount,
//         tenantName,
//         //company: string - Needed?
//       })
//     }

//     exportedInvoiceRows.push(createRoundOffRow(invoice))
//   }

//   return exportedInvoiceRows
// }

// const cleanInvoiceRows = (invoiceRows: InvoiceDataRow[]) => {
//   const cleanedInvoiceRows: InvoiceDataRow[] = []
//   let currentContractCode = ''

//   invoiceRows.forEach((invoiceRow) => {
//     if (
//       (invoiceRow.rowType as number) === 3 &&
//       /^\d/.test(invoiceRow.invoiceRowText as string)
//     ) {
//       currentContractCode = getContractCode(invoiceRow)
//     } else {
//       invoiceRow.contractCode = currentContractCode
//       cleanedInvoiceRows.push(invoiceRow)
//     }
//   })

//   return cleanedInvoiceRows
// }

// const calculateAccountTotals = (aggregateRows: InvoiceDataRow[]) => {
//   const accountTotals: Record<string, number> = {}

//   aggregateRows.forEach((aggregateRow) => {
//     const accountTotal = accountTotals[aggregateRow.account] || 0
//     accountTotals[aggregateRow.account] =
//       accountTotal + (aggregateRow.amount as number)
//   })

//   const accounts = Object.keys(accountTotals)

//   accounts.forEach((account) => {
//     accountTotals[account] =
//       Math.round((accountTotals[account] + Number.EPSILON) * 100) / 100
//   })

//   return accountTotals
// }

// const verifyAccountTotals = (
//   accountTotals: Record<string, number>,
//   batchAccountTotals: Record<string, number>
// ) => {
//   let debtAccountTotal = 0

//   Object.keys(accountTotals).forEach((account) => {
//     if (account.startsWith('29')) {
//       debtAccountTotal += accountTotals[account]
//     } else {
//       if (
//         Math.abs(accountTotals[account] + batchAccountTotals[account]) > 0.01
//       ) {
//         logger.error(
//           {
//             account,
//             difference: accountTotals[account] + batchAccountTotals[account],
//           },
//           'Account amount not matching'
//         )
//         throw new Error('Account amount not matching: ' + account)
//       }
//     }
//   })

//   const batchTotal = Object.keys(batchAccountTotals).reduce((sum, account) => {
//     return (sum += batchAccountTotals[account])
//   }, 0)

//   if (Math.abs(batchTotal - debtAccountTotal) > 1) {
//     logger.error(
//       {
//         batchTotal,
//         debtAccountTotal,
//         difference: Math.abs(batchTotal - debtAccountTotal),
//       },
//       'Debt account total not matching batch account totals'
//     )
//     throw new Error(
//       'Debt account total ${debAccountTotal} not matching batch account totals ${batchTotal}'
//     )
//   }

//   return true
// }
