import SftpClient from 'ssh2-sftp-client'
import { Readable } from 'stream'
import {
  Invoice,
  InvoicePaymentEvent,
  InvoiceTransactionType,
  PaymentStatus,
} from '@onecore/types'
import { gql } from 'graphql-request'
import { logger, loggedAxios as axios } from '@onecore/utilities'

import config from '../../../common/config'
import { AdapterResult, InvoiceDataRow } from '../../../common/types'
import { randomUUID } from 'crypto'

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
  query?: string
}

const getCallerFromError = (error: Error) => {
  return error.stack
    ?.split('\n')[4]
    .trim()
    .replace('at async ', '')
    .split(' ')[0]
}

const makeXledgerRequest = async (query: {
  query: string
  variables?: Record<string, any>
}): Promise<any> => {
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

const makeXledgerHttpRequest = async (query: {
  query: string
  variables?: Record<string, any>
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

const transformToInvoice = (invoiceData: any[]): Invoice[] => {
  const InvoiceTypeMap: Record<number, Invoice['type']> = {
    600: 'Other',
    797: 'Regular',
    3536: 'Regular',
  }

  // Match "Sergel Inkasso" and optionally a space followed by an 8-digit date string
  const debtCollectionRegex = /Sergel Inkasso(?: (?<date>\d{8}))?/

  const invoices = invoiceData.map((invoiceData) => {
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

    const invoice: Invoice = {
      invoiceId: invoiceData.node.invoiceNumber,
      leaseId: 'missing',
      reference: invoiceData.node.subledger.code,
      amount: parseFloat(invoiceData.node.amount),
      invoiceDate: dateFromString(invoiceData.node.invoiceDate),
      fromDate: dateFromString(invoiceData.node.period.fromDate),
      toDate: dateFromString(invoiceData.node.period.toDate),
      expirationDate: dateFromString(invoiceData.node.dueDate),
      debitStatus: 0,
      paymentStatus: PaymentStatus.Unpaid,
      transactionType: InvoiceTransactionType.Rent,
      transactionTypeName: randomUUID(),
      paidAmount:
        parseFloat(invoiceData.node.amount) -
        parseFloat(invoiceData.node.invoiceRemaining),
      type: InvoiceTypeMap[invoiceData.node.headerTransactionSourceDbId],
      description: invoiceData.node.text,
      sentToDebtCollection,
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

const invoiceNodeFragment = `
  invoiceNumber
  invoiceRemaining
  invoiceAmount
  dueDate
  amount
  invoiceDate
  text
  headerTransactionSourceDbId
  subledger {
    code
    description
  }
  period {
    fromDate
    toDate
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

function mapToInvoicePaymentEvent(event: any): InvoicePaymentEvent {
  return {
    type: event.type,
    invoiceId: event.invoiceNumber,
    amount: event.amount,
    paymentDate: event.transactionHeader.postedDate ?? event.paymentDate,
    text: event.text,
    transactionSourceCode: event.transactionHeader.transactionSource.code,
  }
}

export const getInvoicesByContactCode = async (
  contactCode: string,
  filters?: { from?: Date }
) => {
  const xledgerId = await getContactDbId(contactCode)

  if (!xledgerId) {
    logger.error(
      { contactCode },
      'Could not find customer with contact code in Xledger'
    )
    return null
  }

  const query = {
    query: gql`
      query GetInvoices($xledgerId: Int!, $fromDate: String) {
        arTransactions(
          first: 100,
          filter: {
            subledgerDbId: $xledgerId,
            headerTransactionSourceDbId_in: [600, 797, 3536],
            invoiceDate_gte: $fromDate
          }
        )
        {
          edges {
            node {
              ${invoiceNodeFragment}
            }
          }
        }
      }
    `,
    variables: {
      xledgerId,
      fromDate: filters?.from
        ? dateToXledgerDateString(filters.from)
        : undefined,
    },
  }

  const result = await makeXledgerRequest(query)
  return transformToInvoice(result.data?.arTransactions?.edges ?? [])
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

    const [invoice] = transformToInvoice(
      result.data?.arTransactions.edges ?? []
    )
    return invoice
  } catch (err) {
    logger.error(err, 'Error getting invoice from Xledger')
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

export const getPeriodInformation = (
  invoiceRow: InvoiceDataRow
): { periodStart: string; periods: string } => {
  const from = dateFromXledgerDateString(invoiceRow.InvoiceFromDate as string)
  const to = dateFromXledgerDateString(invoiceRow.InvoiceToDate as string)
  const interval = to.getMonth() - from.getMonth()

  const periodInformation = {
    periodStart: interval == 0 ? '' : '0',
    periods: interval == 0 ? '' : (interval + 1).toString(),
  }

  return periodInformation
}

export const transformAggregatedInvoiceRow = (
  invoiceRow: InvoiceDataRow,
  chunkNumber: number
): InvoiceDataRow => {
  const periodInformation = getPeriodInformation(invoiceRow)

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
    posting5: '',
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
      invoiceRow.totalVat as number
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
