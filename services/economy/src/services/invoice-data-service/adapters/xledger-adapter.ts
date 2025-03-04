import config from '../../../common/config'
import { Invoice, InvoiceTransactionType, PaymentStatus } from 'onecore-types'
import { logger } from 'onecore-utilities'
import { loggedAxios as axios } from 'onecore-utilities'
import { AdapterResult, InvoiceDataRow } from '../types'

const TENANT_COMPANY_DB_ID = 44668660

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
    logger.error(result.data, 'Error making Xledger request')
    throw new Error(result.data)
  }
}

const makeXledgerHttpRequest = async (query: {
  query: string
}): Promise<XledgerResponse> => {
  const result = await axios(`${config.xledger.url}`, {
    data: query,
    ...axiosOptions,
  })

  console.log('Full result', result.status, result.data)

  if (result.status === 200) {
    if (result.data && result.data.errors) {
      if (
        result.data.errors[0].code === 'BAD_REQUEST.BURST_RATE_LIMIT_REACHED'
      ) {
        return { status: 'retry', data: {} }
      } else {
        return { status: 'error', data: result.data.errors }
      }
    } else {
      return { status: 'ok', data: result.data }
    }
  } else {
    return { status: 'error', data: result.data.errors }
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

  const result = await axios(`${config.xledger.url}`, {
    data: query,
    ...axiosOptions,
  })

  if (result.data.errors) {
    logger.error(result.data.errors[0], 'Error querying Xledger')
  }

  return result.data.data.customers.edges?.[0]?.node
}

const addContact = async (contact: any) => {
  /*let address = ''

  if (contact.Street && contact.PostalCode && contact.City) {
    address = `address: {
      streetAddress: "${contact.Street}"
      zipCode: "${contact.PostalCode}"
      country: "Sweden"
      place: "${contact.City}"
    }`
  }

  const companyQuery = {
    query: `mutation AddCompanies {
      addCompanies(inputs: {
        node: { 
          description: "${contact.FullName}"
          ${address}
        } 
      }) {
        edges {
            node {
                dbId
            }
        }
      }
    }`,
  }

  console.log(companyQuery)

  const companyResult = await axios(`${config.xledger.url}`, {
    data: companyQuery,
    ...axiosOptions,
  })

  console.log(companyResult.data)

  const companyDbId = companyResult.data.data.addCompanies.edges[0].node.dbId*/

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

  const customerResult = await axios(`${config.xledger.url}`, {
    data: customerQuery,
    ...axiosOptions,
  })

  console.log(customerResult.data)

  return customerResult.data.data.addCustomers.edges[0].node.dbId
}

const contactHasChanged = (xledgerContact: any, dbContact: any) => {
  console.log(xledgerContact.description == dbContact.FullName)

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
    /*const companyQuery = {
      query: `mutation UpdateCompany {
        updateCompany(dbId: "${xledgerContact.companyDbId}", description: "${dbContact.FullName}") {
          description
        }
      }`,
    }

    const companyResult = await axios(`${config.xledger.url}`, {
      data: companyQuery,
      ...axiosOptions,
    })

    console.log(companyResult.data)

    const companyDbId = companyResult.data.data.updateCompany.dbId*/

    // Todo lookup/make sure tenant company exists.

    const customerQuery = {
      query: `mutation UpdateContact {
        updateCustomer(dbId: "${xledgerContact.dbId}", description: "${dbContact.FullName}", streetAddress: "${dbContact.Street}", zipCode: "${dbContact.PostalCode}", place: "${dbContact.City}") {
          dbId
        }
      }`,
    }

    const customerResult = await axios(`${config.xledger.url}`, {
      data: customerQuery,
      ...axiosOptions,
    })

    const customerDbId = customerResult.data.data.updateCustomer.dbId
  } else {
    logger.info({}, `Contact ${dbContact.ContactCode} not changed, skipping`)
  }
}

const getContactDbId = async (contactCode: string): Promise<string> => {
  const query = {
    query: `{customers (first: 10000, filter: { code: "${contactCode}" }) { edges { node { code description dbId }}}}`,
  }
  const result = await axios(`${config.xledger.url}`, {
    data: query,
    ...axiosOptions,
  })

  return result.data.data.customers.edges[0].node.dbId
}

export const getInvoicesByContactCode = async (contactCode: string) => {
  const xledgerId = await getContactDbId(contactCode)

  console.log('xledgerId', xledgerId)

  const query = {
    query: `{arTransactions(first: 10000, filter: { subledgerDbId: ${xledgerId} }) { edges { node { invoiceNumber invoiceRemaining invoiceAmount dueDate amount invoiceDate subledger { code description } period { fromDate toDate } slTransactionType { name } invoiceFile { url } } } }}`,
  }

  const result = await axios(`${config.xledger.url}`, {
    data: query,
    ...axiosOptions,
  })

  console.log(JSON.stringify(result.data.data.arTransactions.edges, null, 2))

  return transformToInvoice(result.data.data.arTransactions.edges)
}

export const syncContact = async (dbContact: any) => {
  console.log('updateContact', dbContact)

  const xledgerContact = await getContact(dbContact.ContactCode)

  console.log('xledgerContact', xledgerContact)

  if (!xledgerContact) {
    await addContact(dbContact)
  } else {
    await updateContact(xledgerContact, dbContact)
  }

  return xledgerContact
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

    const result = await axios(`${config.xledger.url}`, {
      data: accountQuery,
      ...axiosOptions,
    })

    result.data.data.accounts.edges.forEach((edge: any) => {
      accountJobIds[edge.node.code] = edge.node.dbId
    })

    return accountJobIds[account]
  }
}

const createLedgerTransactionQuery = (
  invoiceDataRow: InvoiceDataRow,
  accountJobId: string,
  batchNum: string
): string => {
  return `{
    node: {
      postedDate: "${invoiceDataRow.invoiceFromDate}"
      dueDate: "${invoiceDataRow.invoiceFromDate}"
      account: { code: "1510" }
      transactionSource: { code: "AR" }
      invoiceAmount: 6387
      subledger: { code: "P019430" }
      extIdentifier: "OCR-numret"
      invoiceNumber: "OCR-numret"
      jobLevel: { dbId: 14502 }
      trRegNumber: 20250201
    }
  }`
}

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

  console.log('Query', customerTransactionQuery)

  try {
    const result = await makeXledgerRequest(customerTransactionQuery)
    console.log(
      'Results from addGLImportItems',
      result.data?.addGLImportItems?.edges
    )
    return result.data.addGLImportItems.edges
  } catch (error) {
    return
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

  console.log('Query', transactionQuery)
  try {
    const result = await makeXledgerRequest(transactionQuery)
    console.log(
      'Results from addGLImportItems',
      result.data?.addGLImportItems?.edges
    )
    return result.data.addGLImportItems.edges
  } catch (error) {
    return
  }
}

export const updateCustomerInvoiceData = async (
  invoiceDataRows: InvoiceDataRow[],
  batchId: string
) => {
  const accountJobId = await getAccountDbId('1510')

  let customerInvoiceAmount = 0

  invoiceDataRows.forEach((row) => {
    customerInvoiceAmount += row.TotalAmount as number
  })

  console.log('Invoicerow', invoiceDataRows[0])

  await createCustomerTransaction(
    accountJobId,
    batchId,
    invoiceDataRows[0].ContactCode as string,
    invoiceDataRows[0].InvoiceFromDate as string,
    invoiceDataRows[0].InvoiceToDate as string,
    customerInvoiceAmount,
    'ocr'
  )
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

export const healthCheck = async () => {
  return {}
}
