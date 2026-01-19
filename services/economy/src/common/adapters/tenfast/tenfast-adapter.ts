import axios from 'axios'
import config from '../../config'
import { logger } from '@onecore/utilities'
import { AdapterResult } from '../../types'
import {
  TenfastTenantByContactCodeResponseSchema,
  TenfastInvoicesByTenantIdResponseSchema,
  TenfastTenant,
  TenfastInvoicesByOcrResponseSchema,
  TenfastInvoice,
  TenfastRentArticle,
  TenfastInvoiceRow,
  TenfastInvoiceRowWithAccounting,
} from './schemas'
import {
  Invoice,
  InvoiceRow,
  InvoiceTransactionType,
  PaymentStatus,
} from '@onecore/types'

const baseUrl = config.tenfast.baseUrl
const apiKey = config.tenfast.apiKey

const axiosOptions = {
  headers: {
    'Content-type': 'application/json',
    'api-token': apiKey,
  },
}
const articles: TenfastRentArticle[] = []

const getRentArticles = async (): Promise<TenfastRentArticle[]> => {
  if (articles.length === 0) {
    const result = await axios.get(
      `${baseUrl}/v1/hyresvard/articles`,
      axiosOptions
    )
    if (result.status == 200) {
      articles.push(...result.data)
    }
  }

  return articles
}

const transformToInvoice = (
  tenfastInvoice: TenfastInvoice,
  rentArticles: TenfastRentArticle[]
): Invoice => {
  const invoiceRows: InvoiceRow[] = []
  const invoice: Invoice = {
    invoiceId: tenfastInvoice.id,
    leaseId: '', // TODO: Add,
    amount: tenfastInvoice.amount,
    reference: '', // TODO: Add
    fromDate: new Date(tenfastInvoice.interval.from),
    toDate: new Date(tenfastInvoice.interval.to),
    invoiceDate: new Date(tenfastInvoice.expectedInvoiceDate),
    expirationDate: new Date(tenfastInvoice.due),
    debitStatus: 0,
    paymentStatus: PaymentStatus.Unpaid,
    transactionType: InvoiceTransactionType.Rent,
    transactionTypeName: 'Rent',
    type: 'Regular',
    source: 'next',
    invoiceRows,
  }

  tenfastInvoice

  return invoice
}

export const getTenantByContactCode = async (
  contactCode: string
): Promise<AdapterResult<TenfastTenant | null, string>> => {
  try {
    const tenantResponse = await axios.get(
      `${baseUrl}/v1/hyresvard/hyresgaster?filter[externalId]=${contactCode}`,
      axiosOptions
    )
    if (tenantResponse.status !== 200) {
      return { ok: false, err: tenantResponse.statusText }
    }

    const parsedTenantResponse =
      TenfastTenantByContactCodeResponseSchema.safeParse(tenantResponse.data)
    if (!parsedTenantResponse.success) {
      throw new Error(
        'Failed to parse Tenfast response',
        parsedTenantResponse.error
      )
    }

    return {
      ok: true,
      data: parsedTenantResponse.data.records[0] ?? null,
    }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.statusCode }
  }
}

export const getInvoicesForTenant = async (
  tenantId: string
): Promise<AdapterResult<TenfastInvoice[], string>> => {
  try {
    const result = await axios.get(
      `${baseUrl}/v1/hyresvard/hyresgaster/${tenantId}/hyror`,
      axiosOptions
    )
    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    const parsedResponse = TenfastInvoicesByTenantIdResponseSchema.safeParse(
      result.data
    )
    if (!parsedResponse.success) {
      throw new Error(
        `Failed to parse Tenfast response: ${parsedResponse.error}`
      )
    }

    return { ok: true, data: parsedResponse.data }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.statusCode }
  }
}

export const getInvoiceByOcr = async (
  ocr: string
): Promise<AdapterResult<TenfastInvoice | null, string>> => {
  try {
    const result = await axios.get(
      `${baseUrl}/v1/hyresvard/hyror?filter[ocrNumber]=${ocr}`,
      axiosOptions
    )
    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    console.log(result.data.records[0])

    const parsedResponse = TenfastInvoicesByOcrResponseSchema.safeParse(
      result.data
    )
    if (!parsedResponse.success) {
      throw new Error(
        `Failed to parse Tenfast response: ${parsedResponse.error}`
      )
    }

    return { ok: true, data: parsedResponse.data.records[0] ?? null }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.statusCode }
  }
}

export const getInvoicesNotExported = async (
  maxCount: number
): Promise<AdapterResult<Invoice[], string>> => {
  // Dummy implementation awaiting exported flag in Tenfast
  const tenfastInvoicesResult = await getInvoiceByOcr('2007826013131')
  const invoices: Invoice[] = []
  const rentArticles = await getRentArticles()

  if (tenfastInvoicesResult.ok && tenfastInvoicesResult.data) {
    //for (const tenfastInvoice of tenfastInvoicesResult.data) {
    invoices.push(transformToInvoice(tenfastInvoicesResult.data, rentArticles))
    //}
    return { ok: true, data: invoices }
  } else {
    return { ok: false, err: 'error-getting-invoices' }
  }
}

export const convertToDate = (tenfastDate: string) => {
  return new Date(tenfastDate)
}
