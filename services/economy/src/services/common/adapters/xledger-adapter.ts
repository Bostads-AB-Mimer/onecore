import fs from 'node:fs'
import { randomUUID } from 'crypto'
import SftpClient from 'ssh2-sftp-client'
import { Readable } from 'stream'
import { gql } from 'graphql-request'
import {
  Invoice,
  InvoicePaymentEvent,
  InvoiceTransactionType,
  PaymentStatus,
} from '@onecore/types'
import { logger, loggedAxios as axios } from '@onecore/utilities'
import { match, P } from 'ts-pattern'

import config from '../../../common/config'
import { AdapterResult, InvoiceDataRow } from '../../../common/types'
import { InvoiceWithMatchId } from '@src/services/report-service/types'

const TENANT_COMPANY_DB_ID = 44668660

const XledgerAuthHeader = {
  Authorization: 'token ' + config.xledger.apiToken,
}

const axiosOptions = {
  method: 'POST',
  headers: {
    'Content-type': 'application/json',
    ...XledgerAuthHeader,
  },
}

const TransactionSourceDbId = {
  AR: 797,
  SO: 600,
  OS: 3536,
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

const makeXledgerRequest = async (
  query: {
    query: string
    variables?: Record<string, any>
  },
  attachment?: any // TODO formidable file PersistentFileStorage
): Promise<any> => {
  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  const result = await makeXledgerHttpRequest(query, attachment)

  if (result.status === 'ok') {
    return result.data
  } else if (result.status === 'retry') {
    logger.warn('Rate limit exceeded, waiting and retrying')
    await sleep(3000)
    return await makeXledgerRequest(query, attachment)
  } else {
    const error = new Error(
      result.data.map((error: any) => error.message).join('\n')
    )
    logger.error(
      result.data,
      `Error making Xledger request (${getCallerFromError(error)})`
    )
    throw error
  }
}

const makeXledgerHttpRequest = async (
  query: {
    query: string
    variables?: Record<string, any>
  },
  attachment?: any
): Promise<XledgerResponse> => {
  let result: axios.AxiosResponse

  if (attachment) {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const formData = new FormData()

    const fileBuffer = fs.readFileSync(attachment.filepath)
    formData.append(
      attachment.originalFilename,
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      new Blob([fileBuffer]),
      attachment.originalFilename
    )
    formData.append('content', JSON.stringify(query))

    result = await axios.postForm(`${config.xledger.url}`, formData, {
      headers: {
        ...XledgerAuthHeader,
      },
    })
  } else {
    result = await axios(`${config.xledger.url}`, {
      data: query,
      ...axiosOptions,
    })
  }

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

const dateToGraphQlDateString = (date: Date): string => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}-${month > 9 ? month : `0${month}`}-${day > 9 ? day : `0${day}`}`
}

const dateFromXledgerDateString = (xledgerDateString: string): Date => {
  const dateString =
    xledgerDateString.substring(0, 4) +
    '-' +
    xledgerDateString.substring(4, 6) +
    '-' +
    xledgerDateString.substring(6, 8)

  return dateFromString(dateString)
}

const dateToXledgerDateString = (date: Date): string => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}-${month > 9 ? month : `0${month}`}-${day > 9 ? day : `0${day}`}`
}

// Extract deferment date from description like "Anstånd till 2025-12-31"
const getDefermentDate = (
  description: string | undefined
): Date | undefined => {
  if (!description) return undefined
  const match = description.match(/Anstånd till (\d{4}-\d{2}-\d{2})/)
  if (match && match[1]) {
    return new Date(match[1])
  }
  return undefined
}

/*
 * If invoice is "ströfaktura", then the field "paymentReference"
 * will be present and point to the original invoice.
 * If invoice number ends with "K" we get the original invoice by simply
 * removing the "K" from the invoice number.
 */
function getInvoiceCredit(invoiceNode: any): Invoice['credit'] {
  return match(invoiceNode)
    .with({ paymentReference: P.string }, (data) => ({
      originalInvoiceId: data.paymentReference,
    }))
    .with({ invoiceNumber: P.string.endsWith('K') }, (v) => ({
      originalInvoiceId: v.invoiceNumber.replace('K', ''),
    }))
    .otherwise(() => null)
}

const transformToInvoice = (invoiceData: any): Invoice => {
  const InvoiceTypeMap: Record<number, Invoice['type']> = {
    600: 'Other',
    797: 'Regular',
    3536: 'Regular',
  }

  // Match "Sergel Inkasso" and optionally a space followed by an 8-digit date string
  const debtCollectionRegex = /Sergel Inkasso(?: (?<date>\d{8}))?/

  let sentToDebtCollection: Date | undefined

  if (typeof invoiceData.node.text === 'string') {
    const match = (invoiceData.node.text as string).match(debtCollectionRegex)

    if (match) {
      if (match.groups?.date) {
        const date = dateFromXledgerDateString(match.groups.date)

        if (date.toString() !== 'Invalid Date') {
          sentToDebtCollection = date
        } else {
          logger.warn(
            `Invalid debt collection date in invoice description: ${invoiceData.node.text}`
          )
        }
      } else {
        // Sent to inkasso from Xpand, set to expiration date
        sentToDebtCollection = dateFromString(invoiceData.node.dueDate)
      }
    }
  }

  const invoice: Omit<Invoice, 'paymentStatus'> = {
    invoiceId: invoiceData.node.invoiceNumber,
    leaseId: 'missing',
    reference: invoiceData.node.subledger.code,
    amount: parseFloat(invoiceData.node.amount),
    invoiceDate: dateFromString(invoiceData.node.invoiceDate),
    fromDate: dateFromString(invoiceData.node.period.fromDate),
    toDate: dateFromString(invoiceData.node.period.toDate),
    expirationDate: dateFromString(invoiceData.node.dueDate),
    defermentDate: getDefermentDate(invoiceData.node.text),
    debitStatus: 0,
    transactionType: InvoiceTransactionType.Rent,
    transactionTypeName: randomUUID(),
    paidAmount:
      parseFloat(invoiceData.node.amount) -
      parseFloat(invoiceData.node.invoiceRemaining),
    remainingAmount: parseFloat(invoiceData.node.invoiceRemaining),
    type: InvoiceTypeMap[invoiceData.node.headerTransactionSourceDbId],
    description: invoiceData.node.text ?? undefined,
    sentToDebtCollection,
    source: 'next',
    invoiceRows: [],
    invoiceFileUrl: invoiceData.node.invoiceFile?.url,
    credit: getInvoiceCredit(invoiceData.node),
    accountCode: invoiceData.node.account?.code,
  }

  // TODO? handle overpaid invoices (negative remainingAmount)?
  // TODO? DO we want a unique status for invoices paid after due date?
  function getPaymentStatus(invoice: Omit<Invoice, 'paymentStatus'>) {
    const now = new Date()
    const overdueDate = invoice.defermentDate ?? invoice.expirationDate

    //Can remainingAmount be negative? otherwise skip check
    if (!invoice.remainingAmount || invoice.remainingAmount <= 0)
      return PaymentStatus.Paid
    if (overdueDate != null && now > overdueDate) return PaymentStatus.Overdue
    if (invoice.remainingAmount < invoice.amount)
      return PaymentStatus.PartlyPaid
    return PaymentStatus.Unpaid
  }

  return { ...invoice, paymentStatus: getPaymentStatus(invoice) }
}

export interface XledgerContact {
  contactCode: string
  address: {
    street: string
    postalCode: string
    city: string
  }
  fullName: string
  nationalRegistrationNumber: string
  phoneNumber?: string
}

const transformToContact = (contactData: any): XledgerContact => {
  return {
    contactCode: contactData.code,
    address: {
      street: contactData.address.streetAddress,
      postalCode: contactData.address.zipCode,
      city: contactData.address.place,
    },
    fullName: contactData.description,
    nationalRegistrationNumber: contactData.company.companyNumber,
    phoneNumber: contactData.phone,
  }
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

  if (result.data?.errors) {
    logger.error(result.data.errors[0], 'Error querying Xledger')
  }

  return result.data?.customers?.edges?.[0]?.node ?? null
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

const getContactDbId = async (contactCode: string): Promise<string | null> => {
  const query = {
    query: `{
      customers (first: 1, filter: { code: "${contactCode}" }) {
        edges {
          node {
            code
            description
            dbId
          }
        }
      }
    }`,
  }

  const result = await makeXledgerRequest(query)

  return result.data?.customers?.edges?.[0].node.dbId ?? null
}

export const getContacts = async (
  contactCodes: string[],
  after?: string
): Promise<XledgerContact[]> => {
  const query = {
    query: gql`
      query ($first: Int!, $filter: Customer_Filter, $after: String) {
        customers(first: $first, filter: $filter, after: $after) {
          edges {
            cursor
            node {
              code
              description
              phone
              address {
                streetAddress
                zipCode
                place
              }
              company {
                companyNumber
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `,
    variables: {
      first: 100,
      filter: {
        code_in: contactCodes,
      },
      after: after,
    },
  }

  const result = await makeXledgerRequest(query)

  if (!result.data && result.data.errors) {
    logger.error(result.data.errors[0], 'Error querying Xledger')
  }

  const contacts = result.data.customers.edges.map((e: any) =>
    transformToContact(e.node)
  )

  if (result.data.customers.pageInfo.hasNextPage) {
    const lastEdge = result.data.customers.edges.at(-1)
    const nextContacts = await getContacts(contactCodes, lastEdge.cursor)
    contacts.push(...nextContacts)
  }

  return contacts
}

const invoiceNodeFragment = `
  invoiceNumber
  invoiceRemaining
  invoiceAmount
  dueDate
  amount
  invoiceDate
  text
  matchId
  headerTransactionSourceDbId
  paymentReference
  subledger {
    code
    description
  }
  period {
    fromDate
    toDate
  }
  account {
    code
  }
  slTransactionType {
    name
  }
  invoiceFile {
    url
  }
`

export async function getInvoicePaymentEvents(
  invoiceMatchId: string
): Promise<InvoicePaymentEvent[]> {
  const query = {
    query: `{
      arTransactions(first: 25, filter: { matchId: ${invoiceMatchId} }) {
        edges {
          node {
            matchId
            invoiceNumber
            amount
            text
            paymentDate
            transactionHeader {
              postedDate
              transactionSource {
                code
              }
            }
          }
        }
      }
     }`,
  }

  const result = await makeXledgerRequest(query)
  if (!result.data?.arTransactions?.edges) {
    return []
  }

  const filtered = result.data.arTransactions.edges.filter(
    (edge: any) =>
      edge.node.transactionHeader.transactionSource.code !== 'AR' &&
      edge.node.transactionHeader.transactionSource.code !== 'OS'
  )

  return filtered
    .map((edge: any) => mapToInvoicePaymentEvent(edge.node))
    .sort(
      (a: InvoicePaymentEvent, b: InvoicePaymentEvent) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    )
}

export async function getAllInvoicePaymentEvents(
  invoiceMatchIds: number[],
  after?: string
): Promise<InvoicePaymentEvent[]> {
  const query = {
    query: gql`
      query ($after: String, $matchIds: [Int!]) {
        arTransactions(
          first: 1000
          after: $after
          filter: { matchId_in: $matchIds }
        ) {
          edges {
            cursor
            node {
              matchId
              invoiceNumber
              amount
              text
              paymentDate
              transactionHeader {
                postedDate
                transactionSource {
                  code
                }
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `,
    variables: {
      matchIds: invoiceMatchIds,
      after: after ?? null,
    },
  }

  const result = await makeXledgerRequest(query)

  if (!result.data?.arTransactions) {
    return []
  }
  const filtered = result.data.arTransactions.edges.filter(
    (edge: any) =>
      edge.node.transactionHeader.transactionSource.code !== 'AR' &&
      edge.node.transactionHeader.transactionSource.code !== 'OS'
  )

  const events = filtered.map((e: any) => mapToInvoicePaymentEvent(e.node))

  if (result.data.arTransactions.pageInfo.hasNextPage) {
    const lastEdge = result.data.arTransactions.edges.at(-1)
    const nextEvents = await getAllInvoicePaymentEvents(
      invoiceMatchIds,
      lastEdge.cursor
    )
    events.push(...nextEvents)
  }

  return events
}

function mapToInvoicePaymentEvent(event: any): InvoicePaymentEvent {
  return {
    type: event.type,
    invoiceId: event.invoiceNumber,
    matchId: event.matchId,
    amount: parseFloat(event.amount),
    paymentDate: event.transactionHeader.postedDate
      ? new Date(event.transactionHeader.postedDate)
      : new Date(event.paymentDate),
    text: event.text,
    transactionSourceCode: event.transactionHeader.transactionSource.code,
  }
}

export const getInvoicesByContactCode = async (
  contactCode: string,
  filters?: { from?: Date }
): Promise<Invoice[] | null> => {
  const xledgerId = await getContactDbId(contactCode)

  if (!xledgerId) {
    logger.error(
      { contactCode },
      'Could not find customer with contact code in Xledger'
    )
    return null
  }

  const fromDateFilter = filters?.from
    ? `, invoiceDate_gte: "${dateToXledgerDateString(filters.from)}"`
    : ''

  const query = {
    query: `{
      arTransactions(
        first: 100,
        filter: {
          subledgerDbId: ${xledgerId},
          headerTransactionSourceDbId_in: [600, 797, 3536]${fromDateFilter}
        }
      )
      {
        edges {
          node {
            ${invoiceNodeFragment}
          }
        }
      }
    }`,
  }

  const result = await makeXledgerRequest(query)

  return result.data?.arTransactions?.edges.map(transformToInvoice) ?? []
}

export const getInvoices = async (from?: Date, to?: Date) => {
  const query = {
    query: `
      query($from: String, $to: String) {
        arTransactions(
          first: 10000,
          filter: {
            invoiceDate_gte: $from
            invoiceDate_lt: $to
            headerTransactionSourceDbId_in: [600, 797, 3536]
          }
        ) {
          edges {
            node {
              ${invoiceNodeFragment}
            }
          }
        }
      }
    `,
    variables: {
      from: from ? dateToGraphQlDateString(from) : null,
      to: to ? dateToGraphQlDateString(to) : null,
    },
  }

  const result = await makeXledgerRequest(query)
  return result.data?.arTransactions?.edges.map(transformToInvoice) ?? []
}

export const getAllInvoicesWithMatchIds = async ({
  from,
  to,
  after,
  remainingAmountGreaterThan,
}: {
  from?: Date
  to?: Date
  after?: string
  remainingAmountGreaterThan?: number
}): Promise<InvoiceWithMatchId[]> => {
  const query = {
    query: gql`
      query($after: String, $filter: ARTransaction_Filter) {
        arTransactions(
          first: 1000
          after: $after
          filter: $filter
        ) {
          edges {
            node {
              ${invoiceNodeFragment}
              matchId
            }
            cursor
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `,
    variables: {
      after: after ?? null,
      filter: {
        invoiceDate_gte: from ? dateToGraphQlDateString(from) : undefined,
        invoiceDate_lte: to ? dateToGraphQlDateString(to) : undefined,
        headerTransactionSourceDbId_in: [
          TransactionSourceDbId.AR,
          TransactionSourceDbId.OS,
        ],
        invoiceRemaining_gt: remainingAmountGreaterThan,
      },
    },
  }
  const result = await makeXledgerRequest(query)

  if (!result.data?.arTransactions) {
    return []
  }

  const invoicesWithMatchIds: InvoiceWithMatchId[] =
    result.data.arTransactions.edges.map((e: any): InvoiceWithMatchId => {
      return {
        ...transformToInvoice(e),
        matchId: e.node.matchId,
      }
    })

  if (result.data.arTransactions.pageInfo.hasNextPage) {
    const lastEdge = result.data.arTransactions.edges.at(-1)
    const nextInvoices = await getAllInvoicesWithMatchIds({
      from,
      to,
      after: lastEdge.cursor,
      remainingAmountGreaterThan,
    })
    invoicesWithMatchIds.push(...nextInvoices)
  }

  return invoicesWithMatchIds
}

export async function getInvoiceByInvoiceNumber(invoiceNumber: string) {
  const q = {
    query: `query {
      arTransactions(
        first: 1
        filter: {
          invoiceNumber: "${invoiceNumber}", headerTransactionSourceDbId_in: [600, 797, 3536]
        }
      ) {
          edges {
            node {
              ${invoiceNodeFragment}
            }
          }
        }
    }`,
  }

  try {
    const result = await makeXledgerRequest(q)

    if (!result.data.arTransactions?.edges) {
      return null
    }

    const [invoice] =
      result.data?.arTransactions.edges.map(transformToInvoice) ?? []
    return invoice
  } catch (err) {
    logger.error(err, 'Error getting invoice from Xledger')
    throw err
  }
}

export async function getInvoiceMatchId(invoiceNumber: string) {
  const q = {
    query: `query {
      arTransactions(
        first: 1
        filter: {
          invoiceNumber: "${invoiceNumber}", headerTransactionSourceDbId_in: [600, 797, 3536]
        }
      ) {
          edges {
            node {
              matchId
            }
          }
        }
    }`,
  }

  try {
    const result = await makeXledgerRequest(q)

    if (!result.data?.arTransactions?.edges) {
      return null
    }

    const matchId = result.data.arTransactions.edges[0]?.node.matchId
    // If matchId is 0, invoice has not been paired correctly with events in xledger.
    // Return null in this scenario.
    if (matchId == null || matchId === 0) {
      return null
    } else {
      return matchId
    }
  } catch (err) {
    logger.error(err, 'Error getting invoice match id from Xledger')
    throw err
  }
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

    result.data.accounts?.edges.forEach((edge: any) => {
      accountJobIds[edge.node.code] = edge.node.dbId
    })

    return accountJobIds[account]
  }
}

const _createAggregatedTransaction = async (
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
  } catch (_error) {
    return
  }
}

export const createCustomerLedgerRow = (
  invoiceDataRows: InvoiceDataRow[],
  batchId: string,
  chunkNumber: number,
  counterPartCode: string
): InvoiceDataRow => {
  let customerInvoiceAmount = 0

  invoiceDataRows.forEach((row) => {
    customerInvoiceAmount += row.TotalAmount as number
  })

  customerInvoiceAmount = +customerInvoiceAmount.toFixed(2)

  return {
    voucherType: 'AR',
    voucherNo:
      '2' +
      batchId.toString().padStart(5, '0') +
      chunkNumber.toString().padStart(3, '0'),
    voucherDate: invoiceDataRows[0].InvoiceDate as string,
    account: invoiceDataRows[0].LedgerAccount,
    posting1: '',
    posting2: '',
    posting3: '',
    posting4: '',
    posting5: counterPartCode,
    periodStart: '',
    noOfPeriods: '',
    subledgerNo: invoiceDataRows[0].ContactCode as string,
    invoiceDate: invoiceDataRows[0].InvoiceDate as string,
    invoiceNo: invoiceDataRows[0].InvoiceNumber,
    ocr: invoiceDataRows[0].OCR,
    dueDate: invoiceDataRows[0].InvoiceDueDate as string,
    text: '',
    taxRule: '',
    amount: customerInvoiceAmount,
    ledgerAccount: invoiceDataRows[0].LedgerAccount,
    totalAccount: invoiceDataRows[0].TotalAccount,
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
    invoiceDeliveryMethod: contact.InvoiceDeliveryMethod,
    counterPart: contact.CounterPart ?? '',
    group: contact.CustomerGroup,
  }
}

const getTaxRule = (totalAmount: number, totalVat: number, account: string) => {
  const vatRate = Math.round((totalVat * 100) / (totalAmount - totalVat))
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

export const getPeriodInformation = (
  invoiceDate: Date | null,
  fromDate: Date,
  toDate: Date
): { periodStart: string; periods: string } => {
  if (!invoiceDate) {
    invoiceDate = fromDate
  }

  const toStart = fromDate.getMonth() - invoiceDate.getMonth()
  const invoiceInterval = toDate.getMonth() - fromDate.getMonth()

  const periodInformation = {
    periodStart: toStart == 0 ? '' : toStart.toString(),
    periods:
      invoiceInterval == 0 && toStart == 0
        ? ''
        : (invoiceInterval + 1).toString(),
  }

  return periodInformation
}

export const transformAggregatedInvoiceRow = (
  invoiceRow: InvoiceDataRow,
  chunkNumber: number
): InvoiceDataRow => {
  const periodInformation = getPeriodInformation(
    null,
    dateFromXledgerDateString(invoiceRow.InvoiceFromDate as string),
    dateFromXledgerDateString(invoiceRow.InvoiceToDate as string)
  )

  const transformedRow = {
    voucherType: 'AR',
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
    ).toString(),
    amount: -invoiceRow.totalAmount,
    totalAccount: invoiceRow.TotalAccount,
  }

  return transformedRow
}

export const uploadFile = async (filename: string, csvFile: string) => {
  const sftpConfig: SftpClient.ConnectOptions = {
    host: config.xledger.sftp.host,
    username: config.xledger.sftp.username,
    password: config.xledger.sftp.password,
  }

  if (config.xledger.sftp.useSshDss) {
    sftpConfig.algorithms = {
      serverHostKey: ['ssh-dss'],
    }
  }

  let remoteDir = ''

  if (filename.endsWith('.gl.csv')) {
    remoteDir = config.xledger.sftp.glDirectory ?? ''
  } else if (filename.endsWith('.ar.csv')) {
    remoteDir = config.xledger.sftp.arDirectory ?? ''
  } else {
    logger.error(
      { filename },
      'Unknown file type, accepted types are .gl.csv and .ar.csv'
    )
    throw new Error('Unknown file type, accepted types are .gl.csv and .ar.csv')
  }

  const stream = new Readable()
  stream.push(csvFile)
  stream.push(null)

  const sftp = new SftpClient()
  try {
    await sftp.connect(sftpConfig)
    await sftp.put(stream, remoteDir + '/' + filename)
  } catch (err) {
    throw new Error('SFTP : ' + JSON.stringify(err))
  } finally {
    await sftp.end()
  }
}

export const healthCheck = async () => {
  return {}
}

const quote = (s: string | number) => `"${s}"`

export const submitMiscellaneousInvoice = async (
  invoice: MiscellaneousInvoicePayload
) => {
  const headerInfo = `${invoice.leaseId}: ${invoice.invoiceRows.map((ir) => ir.articleName).join(', ')}`

  /*
    TODO
    Hur ska vi sätta ourRef? Behöver hämta contact för att få dbId baserat på något, men vad?
    Hur kan vi få användare i Xledger från inloggad användare i Onecore?
    Behöver vi hämta alla contacts från Xledger och välja manuellt ur en lista när fakturaunderlaget skapas?

    ourRef: {
      dbId: "12345"
    }
  */

  const nodes = invoice.invoiceRows.map(
    (ir, index) => gql`
      {
        node: {
          subledger: { code: ${quote(invoice.contactCode)} }
          lineNumber: ${index}
          product: {
            code: ${quote(ir.articleId)}
          }
          text: ${quote(`${ir.articleName}${ir.text ? `: ${ir.text}` : ''}`)}
          quantity: 1
          unitPrice: ${ir.price}
          glObject1: {
            code: ${quote(invoice.costCentre)}
          }
          glObject3: {
            code: ${quote(invoice.propertyCode)}
          }
          headerInfo: ${quote(headerInfo)}
          approved: true
          invoiceDate: ${quote(dateToGraphQlDateString(new Date(invoice.invoiceDate)))}
          ${
            invoice.projectCode
              ? `
                project: {
                  code: ${quote(invoice.projectCode)}
                }
              `
              : ''
          }
          comment: ${quote(invoice.comment ?? '')}
          ${
            invoice.attachment
              ? `
                attachment: ${quote(invoice.attachment.originalFilename)}
                `
              : ''
          }
        }
      }
    `
  )

  const mutation = gql`
    mutation {
      addInvoiceBaseItems(
        inputs: [
          ${nodes}
        ]
      ) {
        edges {
          node {
            dbId
          }
        }
      }
    }
  `

  try {
    const result = await makeXledgerRequest(
      { query: mutation },
      invoice.attachment
    )

    return result.data.addInvoiceBaseItems.edges
  } catch (err: unknown) {
    logger.error(err, 'Error creating miscellaneous invoice')
    throw err
  }
}

interface InvoiceRow {
  text?: string
  price: number
  articleName: string
  articleId: string
}

interface MiscellaneousInvoicePayload {
  reference: string
  invoiceDate: Date
  contactCode: string
  tenantName: string
  leaseId: string
  costCentre: string
  propertyCode: string
  invoiceRows: InvoiceRow[]
  comment?: string
  projectCode?: string
  attachment?: any // TODO formidable file PersistentFileStorage
}
