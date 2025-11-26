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
  TenfastInvoiceRow,
  TenfastRentArticleSchema,
  TenfastRentArticle,
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

const makeTenfastRequest = async (
  url: string,
  config?: {
    method?: string
    params?: Record<string, string | string[] | number | number[]>
    data?: any
  }
) => {
  return axios.request({
    ...axiosOptions,
    baseURL: baseUrl,
    url,
    method: config?.method ?? 'GET',
    data: config?.data,
    params: config?.params,
  })
}

export const getTenantByContactCode = async (
  contactCode: string
): Promise<AdapterResult<TenfastTenant | null, string>> => {
  try {
    const tenantResponse = await makeTenfastRequest(
      '/v1/hyresvard/hyresgaster',
      {
        params: {
          'filter[externalId]': contactCode,
        },
      }
    )
    if (tenantResponse.status !== 200) {
      return { ok: false, err: tenantResponse.statusText }
    }

    const parsedResponse = TenfastTenantByContactCodeResponseSchema.safeParse(
      tenantResponse.data
    )
    if (!parsedResponse.success) {
      throw new Error(
        `Failed to parse Tenfast response: ${parsedResponse.error}`
      )
    }

    return {
      ok: true,
      data: parsedResponse.data.records[0] ?? null,
    }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

export const getInvoicesForTenant = async (
  tenantId: string
): Promise<AdapterResult<Invoice[], string>> => {
  try {
    const result = await makeTenfastRequest(
      `/v1/hyresvard/hyresgaster/${tenantId}/hyror`
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

    return { ok: true, data: parsedResponse.data.map(transformToInvoice) }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

export const getInvoiceByOcr = async (
  ocr: string
): Promise<AdapterResult<Invoice | null, string>> => {
  try {
    const invoiceStates = [
      'betald',
      'ny',
      'ej-avprickad',
      'forsenad',
      'delvis-betald',
      'krediterad',
      'anstand',
    ]
    const result = await makeTenfastRequest('/v1/hyresvard/hyror', {
      params: {
        'filter[ocrNumber]': ocr,
        states: invoiceStates.join(','),
      },
    })
    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    const parsedResponse = TenfastInvoicesByOcrResponseSchema.safeParse(
      result.data
    )
    if (!parsedResponse.success) {
      throw new Error(
        `Failed to parse Tenfast response: ${parsedResponse.error}`
      )
    }

    return {
      ok: true,
      data: parsedResponse.data.records[0]
        ? transformToInvoice(parsedResponse.data.records[0])
        : null,
    }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

export const getInvoiceArticle = async (
  articleId: string
): Promise<AdapterResult<TenfastRentArticle, string>> => {
  try {
    const result = await makeTenfastRequest(
      `/v1/hyresvard/articles/${articleId}`
    )
    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    const parsedResponse = TenfastRentArticleSchema.safeParse(result.data)
    if (!parsedResponse.success) {
      throw new Error(
        `Failed to parse Tenfast response: ${parsedResponse.error}`
      )
    }

    return { ok: true, data: parsedResponse.data }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

const transformToInvoice = (tenfastInvoice: TenfastInvoice): Invoice => {
  const remainingAmount = tenfastInvoice.amount - tenfastInvoice.amountPaid

  return {
    amount: tenfastInvoice.amount,
    debitStatus: 0, //
    fromDate: new Date(tenfastInvoice.interval.from),
    toDate: new Date(tenfastInvoice.interval.to),
    invoiceDate: tenfastInvoice.activatedAt
      ? new Date(tenfastInvoice.activatedAt)
      : new Date(tenfastInvoice.expectedInvoiceDate), // If tenfastInvoice.state == 'draft', activatedAt will be null
    expirationDate: new Date(tenfastInvoice.due),
    paidAmount: tenfastInvoice.amountPaid,
    remainingAmount,
    invoiceId: tenfastInvoice.ocrNumber,
    leaseId: '',
    paymentStatus:
      remainingAmount <= 0 ? PaymentStatus.Paid : PaymentStatus.Unpaid,
    type: 'Regular', // ?
    reference: tenfastInvoice.ocrNumber,
    source: 'next', // ??
    invoiceRows: tenfastInvoice.hyror.map(transformToInvoiceRow),
    transactionType: InvoiceTransactionType.Rent, // ?
    transactionTypeName: '', // ?
  }
}

const transformToInvoiceRow = (
  tenfastInvoiceRow: TenfastInvoiceRow
): InvoiceRow => {
  return {
    amount: tenfastInvoiceRow.amount,
    rentArticle: tenfastInvoiceRow.article,
    fromDate: tenfastInvoiceRow.from ?? '',
    toDate: tenfastInvoiceRow.to ?? '',
    vat: tenfastInvoiceRow.vat,
    totalAmount: tenfastInvoiceRow.amount + tenfastInvoiceRow.vat,
    printGroup: tenfastInvoiceRow.consolidationLabel ?? null,
    invoiceRowText: null, // Set later from related article
    // We do not have the fields below in tenfast at the moment
    deduction: 0,
    roundoff: 0,
    rowType: 0, // TODO We will hopefully not need this anymore when we are using Tenfast for invoice rows
    // TODO Are the fields below needed? Are they something that belong in an invoice row?
    invoiceDate: '',
    invoiceDueDate: '',
    invoiceNumber: '',
  }
}
