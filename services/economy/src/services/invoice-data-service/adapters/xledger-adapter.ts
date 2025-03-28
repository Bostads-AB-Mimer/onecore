import config from '../../../common/config'
import { Invoice, InvoiceTransactionType, PaymentStatus } from 'onecore-types'
import { logger } from 'onecore-utilities'
import { loggedAxios as axios } from 'onecore-utilities'
import { AdapterResult, InvoiceDataRow } from '../types'
import { get } from 'http'

const TENANT_COMPANY_DB_ID = 44668660
const CUSTOMER_LEDGER_ACCOUNT = '1530'

const axiosOptions = {
  method: 'POST',
  headers: {
    'Content-type': 'application/json',
    Authorization: 'token ' + config.xledger.apiToken,
  },
}

interface XledgerResponse {
  status: 'ok' | 'retry' | 'error'
  data: any
  query?: string
}

const getCallerFromError = (error: Error) => {
  return error.stack
    ?.split('\n')[4]
    .trim()
    .replace('at async ', '')
    .split(' ')[0]
}

const makeXledgerRequest = async (query: { query: string }): Promise<any> => {
  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  const result = await makeXledgerHttpRequest(query)

  if (result.status === 'ok') {
    return result.data
  } else if (result.status === 'retry') {
    await sleep(3000)
    return await makeXledgerRequest(query)
  } else {
    const error = new Error(result.data)
    logger.error(
      result.data,
      `Error making Xledger request (${getCallerFromError(error)})`
    )
    throw error
  }
}

const makeXledgerHttpRequest = async (query: {
  query: string
}): Promise<XledgerResponse> => {
  const result = await axios(`${config.xledger.url}`, {
    data: query,
    ...axiosOptions,
  })

  if (result.status === 200) {
    if (result.data && result.data.errors) {
      if (
        result.data.errors[0].code === 'BAD_REQUEST.BURST_RATE_LIMIT_REACHED'
      ) {
        return { status: 'retry', data: {} }
      } else {
        return { status: 'error', data: result.data.errors, query: query.query }
      }
    } else {
      return { status: 'ok', data: result.data, query: query.query }
    }
  } else {
    return { status: 'error', data: result.data.errors, query: query.query }
  }
}

const dateFromString = (dateString: string): Date => {
  return new Date(Date.parse(dateString))
}

const transformToInvoice = (invoiceData: any[]): Invoice[] => {
  const invoices = invoiceData.map((invoiceData) => {
    const invoice = {
      invoiceId: invoiceData.node.invoiceNumber,
      leaseId: 'missing',
      amount: parseFloat(invoiceData.node.amount),
      invoiceDate: dateFromString(invoiceData.node.invoiceDate),
      fromDate: dateFromString(invoiceData.node.period.fromDate),
      toDate: dateFromString(invoiceData.node.period.toDate),
      expirationDate: dateFromString(invoiceData.node.dueDate),
      debitStatus: 0,
      paymentStatus: PaymentStatus.Unpaid,
      transactionType: InvoiceTransactionType.Rent,
      transactionTypeName: invoiceData.node.slTransactionType.name,
      paidAmount:
        parseFloat(invoiceData.node.amount) -
        parseFloat(invoiceData.node.invoiceRemaining),
    }

    if (invoice.paidAmount === invoice.amount) {
      invoice.paymentStatus = PaymentStatus.Paid
    }

    return invoice
  })

  return invoices
}

const getContact = async (contactCode: string) => {
  const query = {
    query: `{
      customers(first: 1, filter: { code: "${contactCode}" }) {
        edges {
          node {
            code
            description
            dbId
            companyDbId
            address {
              streetAddress
              streetNumber
              zipCode
              place
            }
            email
            modifiedAt
          }
        }
      }
    }`,
  }

  const result = await makeXledgerRequest(query)

  if (result.data.errors) {
    logger.error(result.data.errors[0], 'Error querying Xledger')
  }

  return result.data.customers.edges?.[0]?.node
}

const addContact = async (contact: any) => {
  const customerQuery = {
    query: `mutation AddCustomers {
      addCustomers(inputs:[
        {
          node: {
            company:{dbId: ${TENANT_COMPANY_DB_ID}},
            code:"${contact.ContactCode}",
            description:"${contact.FullName}",
            streetAddress:"${contact.StreetAddress}",
            zipCode:"${contact.PostalCode}",
            place:"${contact.City}"
          }
        }
      ]) {
        edges { node {dbId} }
      }
    }`,
  }

  const customerResult = await makeXledgerRequest(customerQuery)

  return customerResult.data.addCustomers.edges[0].node.dbId
}

const contactHasChanged = (xledgerContact: any, dbContact: any) => {
  if (
    xledgerContact.description != dbContact.FullName ||
    xledgerContact.email != dbContact.Email ||
    xledgerContact.address.streetAddress != dbContact.Street ||
    xledgerContact.address.zipCode != dbContact.PostalCode ||
    xledgerContact.address.place != dbContact.City
  ) {
    return true
  } else {
    return false
  }
}

const updateContact = async (xledgerContact: any, dbContact: any) => {
  if (contactHasChanged(xledgerContact, dbContact)) {
    // Todo lookup/make sure tenant company exists.
    const customerQuery = {
      query: `mutation UpdateContact {
        updateCustomer(dbId: "${xledgerContact.dbId}", description: "${dbContact.FullName}", streetAddress: "${dbContact.Street}", zipCode: "${dbContact.PostalCode}", place: "${dbContact.City}") {
          dbId
        }
      }`,
    }

    const customerResult = await makeXledgerRequest(customerQuery)

    const customerDbId = customerResult.data.updateCustomer.dbId
    return customerDbId
  } else {
    logger.info({}, `Contact ${dbContact.ContactCode} not changed, skipping`)
  }
}

const getContactDbId = async (contactCode: string): Promise<string> => {
  const query = {
    query: `{customers (first: 10000, filter: { code: "${contactCode}" }) { edges { node { code description dbId }}}}`,
  }

  const result = await makeXledgerRequest(query)

  return result.data.customers.edges[0].node.dbId
}

export const getInvoicesByContactCode = async (contactCode: string) => {
  const xledgerId = await getContactDbId(contactCode)

  const query = {
    query: `{arTransactions(first: 10000, filter: { subledgerDbId: ${xledgerId} }) { edges { node { invoiceNumber invoiceRemaining invoiceAmount dueDate amount invoiceDate subledger { code description } period { fromDate toDate } slTransactionType { name } invoiceFile { url } } } }}`,
  }

  const result = await makeXledgerRequest(query)

  return transformToInvoice(result.data.arTransactions.edges)
}

export const syncContact = async (
  dbContact: any
): Promise<AdapterResult<any, string>> => {
  const xledgerContact = await getContact(dbContact.ContactCode)

  try {
    if (!xledgerContact) {
      await addContact(dbContact)
    } else {
      await updateContact(xledgerContact, dbContact)
    }

    return { ok: true, data: xledgerContact }
  } catch (error) {
    return { ok: false, err: (error as any).message }
  }
}

const accountJobIds: Record<string, string> = {}

const getAccountDbId = async (account: string) => {
  if (accountJobIds[account]) {
    return accountJobIds[account]
  } else {
    const accountQuery = {
      query: `query {
        accounts(last: 10000, filter: { chartOfAccountDbId: 3 }, objectStatus: OPEN) {
          edges {
            node {
              code
              dbId
            }
          }
        }
      }`,
    }

    const result = await makeXledgerRequest(accountQuery)

    result.data.accounts.edges.forEach((edge: any) => {
      accountJobIds[edge.node.code] = edge.node.dbId
    })

    return accountJobIds[account]
  }
}

/*const createLedgerTransactionQuery = (
  invoiceDataRow: InvoiceDataRow,
  accountJobId: string,
  batchNum: string
): string => {
  return `{
    node: {
      postedDate: "${invoiceDataRow.invoiceFromDate}"
      dueDate: "${invoiceDataRow.invoiceFromDate}"
      account: { dbId: ${accountJobId} }
      transactionSource: { code: "AR" }
      invoiceAmount: ${invoiceDataRow.totalAmount}
      subledger: { code: "${invoiceDataRow.contactCode}" }
      extIdentifier: "OCR-numret"
      invoiceNumber: "OCR-numret"
      jobLevel: { dbId: 14502 }
      trRegNumber: ${batchNum}
    }
  }`
}*/

const createCustomerTransaction = async (
  accountJobId: string,
  batchId: string,
  customerCode: string,
  postedDate: string,
  dueDate: string,
  amount: number,
  ocr: string
) => {
  const customerTransactionQuery = {
    query: `mutation {
      addGLImportItems(
        inputs: [{
          node: {
            postedDate: "${postedDate}"
            dueDate: "${dueDate}"
            account: { dbId: ${accountJobId} }
            transactionSource: { code: "AR" }
            invoiceAmount: ${amount}
            subledger: { code: "${customerCode}" }
            extIdentifier: "${ocr}"
            invoiceNumber: "${ocr}"
            jobLevel: { dbId: 14502 }
            trRegNumber: ${batchId}
          }
        }]
      ) {
        edges {
          node {
            dbId
          }
        }
      }
    }`,
  }

  try {
    const result = await makeXledgerRequest(customerTransactionQuery)

    return result.data.addGLImportItems.edges
  } catch (error) {
    logger.error(
      error,
      `Error creating entry in customer ledger for contact ${customerCode}`
    )
    throw error
  }
}

const createAggregatedTransaction = async (
  account: string,
  postedDate: string,
  amount: number,
  vatPercent: number,
  batchId: string
) => {
  const accountJobId = await getAccountDbId(account)

  if (!accountJobId) {
    logger.error({ account }, 'Job id not found for account')
    return
  }
  const taxRule = vatPercent == 25 ? 'taxRule:{code:"2"},' : ''

  const transactionQuery = {
    query: `mutation {
      addGLImportItems(inputs: [
        {
          node: {
            postedDate: "${postedDate}",
            account: {dbId: ${accountJobId}},
            transactionSource: {code: "AR"},
            invoiceAmount: ${amount},
            ${taxRule}
            jobLevel: {dbId: 14502},
            trRegNumber: ${batchId}
          }
        }
      ]) {
        edges { node {dbId} }
      }
    }`,
  }

  try {
    const result = await makeXledgerRequest(transactionQuery)
    return result.data.addGLImportItems.edges
  } catch (error) {
    return
  }
}

export const createCustomerLedgerRow = async (
  invoiceDataRows: InvoiceDataRow[],
  batchId: string,
  chunkNumber: number
): Promise<AdapterResult<InvoiceDataRow, 'ledger-amount-zero'>> => {
  let customerInvoiceAmount = 0

  invoiceDataRows.forEach((row) => {
    customerInvoiceAmount += row.TotalAmount as number
  })

  customerInvoiceAmount = +customerInvoiceAmount.toFixed(2)

  return {
    ok: true,
    data: {
      voucherType: 'AR',
      voucherNo:
        '2' +
        batchId.toString().padStart(5, '0') +
        chunkNumber.toString().padStart(3, '0'),
      voucherDate: invoiceDataRows[0].InvoiceDate as string,
      account: CUSTOMER_LEDGER_ACCOUNT,
      posting1: '',
      posting2: '',
      posting3: '',
      posting4: '',
      posting5: '',
      periodStart: '',
      noOfPeriods: '',
      subledgerNo: invoiceDataRows[0].ContactCode as string,
      invoiceDate: invoiceDataRows[0].InvoiceDate as string,
      invoiceNo: `${invoiceDataRows[0].ContactCode}-${batchId}`,
      ocr: `${invoiceDataRows[0].ContactCode}-${batchId}`,
      dueDate: invoiceDataRows[0].InvoiceDueDate as string,
      text: '',
      taxRule: '',
      amount: customerInvoiceAmount,
    },
  }
}

export const updateCustomerLedger = async (
  invoiceDataRows: InvoiceDataRow[],
  batchId: string
): Promise<
  AdapterResult<
    number,
    'xledger-error' | 'account-not-found' | 'ledger-amount-zero'
  >
> => {
  const accountJobId = await getAccountDbId(CUSTOMER_LEDGER_ACCOUNT)

  if (!accountJobId) {
    logger.error(
      { account: CUSTOMER_LEDGER_ACCOUNT },
      `Error updating customer ledger for contract ${invoiceDataRows[0]?.ContractCode}`
    )
    return { ok: false, err: 'account-not-found' }
  }

  let customerInvoiceAmount = 0

  invoiceDataRows.forEach((row) => {
    customerInvoiceAmount += row.TotalAmount as number
  })

  if (customerInvoiceAmount === 0) {
    logger.error(
      {},
      `Error updating customer ledger for contract ${invoiceDataRows[0]?.ContractCode}: customer invoice total is 0 for contract`
    )
    return { ok: false, err: 'ledger-amount-zero' }
  }

  try {
    const ledgerResult = await createCustomerTransaction(
      accountJobId,
      batchId,
      invoiceDataRows[0].ContactCode as string,
      invoiceDataRows[0].InvoiceFromDate as string,
      invoiceDataRows[0].InvoiceToDate as string,
      customerInvoiceAmount,
      'ocr'
    )

    return { ok: true, data: customerInvoiceAmount }

    /*    if (ledgerResult.ok) {
      return { ok: true, data: customerInvoiceAmount }
    } else {
      logger.error(
        { error: ledgerResult.err },
        `Error updating customer ledger for ${invoiceDataRows[0]?.ContactCode}`
      )
      return { ok: false, err: 'xledger-error' }
    }*/
  } catch (error) {
    logger.error(
      error,
      `Error updating customer ${invoiceDataRows[0]?.ContactCode} ledger for contract ${invoiceDataRows[0]?.ContractCode}`
    )
    return { ok: false, err: 'xledger-error' }
  }
}

export const updateAggregatedInvoiceData = async (
  invoiceDataRows: InvoiceDataRow[],
  batchId: string
): Promise<
  AdapterResult<
    { successfulRows: number; failedRows: number; errors: string[] },
    string
  >
> => {
  try {
    const errors: string[] = []
    let successfulRows = 0
    let failedRows = 0

    for (const row of invoiceDataRows) {
      if (row.account) {
        await createAggregatedTransaction(
          row.account as string,
          row.invoiceFromDate as string,
          row.totalAmount as number,
          row.vatPercent as number,
          batchId
        )
        successfulRows++
      } else {
        failedRows++
        logger.error(row, 'Account missing for aggregated row')
        errors.push(`Account for article ${row.rentArticle} missing in Xpand`)
      }
    }

    return {
      ok: true,
      data: {
        successfulRows,
        failedRows,
        errors: errors,
      },
    }
  } catch (error) {
    logger.error(error, 'Error updating aggregated invoice data')
    return {
      ok: false,
      err: 'aggregated-invoice-data-error',
    }
  }
}

export const transformContact = (contact: InvoiceDataRow): InvoiceDataRow => {
  return {
    code: contact.ContactCode,
    description: contact.FullName,
    companyNo: contact.NationalRegistrationNumber,
    email: contact.EmailAddress,
    streetAddress: contact.Street,
    zipCode: contact.PostalCode,
    city: contact.City,
    invoiceDeliveryMethod: '',
  }
}

const getTaxRule = (totalAmount: number, totalVat: number) => {
  const vatRate = Math.round((totalVat * 100) / (totalAmount - totalVat))

  switch (vatRate) {
    case 25:
      return '2'
    case 12:
      return '21'
    case 6:
      return '22'
    default:
      return ''
  }
}

const getPeriods = (fromDate: string, toDate: string): number => {
  const from = new Date(fromDate)
  const to = new Date(toDate)

  return to.getMonth() - from.getMonth() + 1
}

export const transformAggregatedInvoiceRow = (
  invoiceRow: InvoiceDataRow,
  chunkNumber: number
): InvoiceDataRow => {
  const transformedRow = {
    voucherType: 'AR',
    voucherNo:
      '1' +
      invoiceRow.BatchId.toString().padStart(5, '0') +
      chunkNumber.toString().padStart(3, '0'),
    voucherDate: invoiceRow.InvoiceFromDate,
    account: invoiceRow.Account,
    posting1: invoiceRow.CostCode,
    posting2: '',
    posting3: invoiceRow.Property,
    posting4: invoiceRow.FreeCode,
    posting5: '',
    periodStart: invoiceRow.InvoiceFromDate,
    noOfPeriods: getPeriods(
      invoiceRow.InvoiceFromDate as string,
      invoiceRow.InvoiceToDate as string
    ),
    subledgerNo: '',
    invoiceDate: '',
    invoiceNo: '',
    ocr: '',
    dueDate: '',
    text: '',
    taxRule: getTaxRule(
      invoiceRow.totalAmount as number,
      invoiceRow.totalVat as number
    ).toString(),
    amount: -invoiceRow.totalAmount,
  }

  return transformedRow
}

export const healthCheck = async () => {
  return {}
}
