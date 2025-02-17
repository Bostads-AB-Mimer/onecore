import config from '../../../common/config'
import {
  Invoice,
  InvoiceTransactionType,
  invoiceTransactionTypeTranslation,
  PaymentStatus,
} from 'onecore-types'
import { logger } from 'onecore-utilities'
import { loggedAxios as axios } from 'onecore-utilities'
import { getContacts } from './invoice-data-db-adapter'
import { gql } from '@urql/core'

const axiosOptions = {
  method: 'POST',
  headers: {
    'Content-type': 'application/json',
    Authorization: 'token ' + config.xledger.apiToken,
  },
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

  console.log('getContact', query)

  const result = await axios(`${config.xledger.url}`, {
    data: query,
    ...axiosOptions,
  })

  if (result.data.errors) {
    logger.error(result.data.errors[0], 'Error querying Xledger')
  }
  console.log('result', result.data)

  return result.data.data.customers.edges?.[0]?.node
}

const addContact = async (contact: any) => {
  let address = ''

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

  const companyDbId = companyResult.data.data.addCompanies.edges[0].node.dbId

  const customerQuery = {
    query: `mutation AddCustomers {
      addCustomers(inputs:[
        {
          node: {
            company:{dbId: ${companyDbId}},
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
    const companyQuery = {
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

    const companyDbId = companyResult.data.data.updateCompany.dbId

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

export const healthCheck = async () => {
  return {}
}
