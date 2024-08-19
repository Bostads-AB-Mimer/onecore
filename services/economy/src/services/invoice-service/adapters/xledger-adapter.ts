import config from '../../../common/config'
import {
  Invoice,
  InvoiceTransactionType,
  invoiceTransactionTypeTranslation,
  PaymentStatus,
} from 'onecore-types'
import { logger } from 'onecore-utilities'
import { loggedAxios as axios } from 'onecore-utilities'

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

const getContactXledgerId = async (contactCode: string): Promise<string> => {
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
  const xledgerId = await getContactXledgerId(contactCode)

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

export const healthCheck = async () => {
  return {}
}
