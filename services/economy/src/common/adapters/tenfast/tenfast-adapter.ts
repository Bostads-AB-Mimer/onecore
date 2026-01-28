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
import {
  InvoiceRowWithAccounting,
  InvoiceWithAccounting,
} from '@src/common/types/typesv2'

const baseUrl = config.tenfast.baseUrl
const apiKey = config.tenfast.apiKey

const makeTenfastRequest = async (
  url: string,
  config?: {
    method?: string
    params?: Record<string, string | string[] | number | number[] | undefined>
    data?: any
  }
) => {
  return axios.request({
    baseURL: baseUrl,
    url,
    method: config?.method ?? 'GET',
    data: config?.data,
    params: config?.params,
    headers: {
      'Content-type': 'application/json',
      'api-token': apiKey,
    },
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
      return { ok: false, err: 'schema-error' }
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
      return { ok: false, err: 'schema-error' }
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
      logger.error(
        { error: result.statusText },
        'Error getting invoices from Tenfast'
      )
      return { ok: false, err: result.statusText }
    }

    const parsedResponse = TenfastInvoicesByOcrResponseSchema.safeParse(
      result.data
    )

    if (!parsedResponse.success) {
      logger.error(
        { error: parsedResponse.error },
        'Error parsing Tenfast invoice'
      )
      return { ok: false, err: 'schema-error' }
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
      return { ok: false, err: 'schema-error' }
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
    roundoff: tenfastInvoice.roundingAmount,
    invoiceId: tenfastInvoice.ocrNumber,
    leaseId: tenfastInvoice.contractCode!!,
    recipientContactCode: tenfastInvoice.recipientContactCode!!,
    recipientName: tenfastInvoice.recipientName!!,
    paymentStatus:
      remainingAmount <= 0 ? PaymentStatus.Paid : PaymentStatus.Unpaid,
    type: 'Regular',
    reference: tenfastInvoice.ocrNumber,
    source: 'next', // ??
    invoiceRows: tenfastInvoice.hyror.map(transformToInvoiceRow),
    transactionType: InvoiceTransactionType.Rent,
    // TODO this is only (?) used for uniquely identifying invoices with the same invoice number in mina sidor.
    // We should maybe add a unique id property to the Invoice type instead
    transactionTypeName: 'some random string',
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

export const convertToDate = (tenfastDate: string) => {
  return new Date(tenfastDate)
}

export const getInvoicesNotExported = async (
  maxCount: number
): Promise<AdapterResult<InvoiceWithAccounting[], string>> => {
  // Dummy implementation awaiting exported flag in Tenfast
  const invoices: InvoiceWithAccounting[] = []
  const ocrNumbers = [
    '2002125123137',
    '2007725123130',
    '2002925123139',
    '2007925123138',
    '2007625123131',
    '2007225123135',
    '2002825123130',
    '2004225123132',
    '2004125123133',
    '2004025123134',
    '2003925123137',
    '2003825123138',
    '2003725123139',
    '2003625123130',
    '2003525123131',
    '2003425123132',
    '2003325123133',
    '2003225123134',
    '2003125123135',
    '2003025123136',
  ]

  for (const ocrNumber of ocrNumbers) {
    const tenfastInvoicesResult = await getInvoiceByOcr(ocrNumber)
    if (tenfastInvoicesResult.ok && tenfastInvoicesResult.data) {
      const invoice = tenfastInvoicesResult.data
      const invoiceRowsWithAccounting: InvoiceRowWithAccounting[] = []

      for (const invoiceRow of invoice.invoiceRows) {
        const invoiceRowWithAccounting: InvoiceRowWithAccounting = {
          ...invoiceRow,
        }
        if (invoiceRow.rentArticle) {
          const articleResult = await getInvoiceArticle(invoiceRow.rentArticle)
          if (articleResult.ok) {
            const article = articleResult.data
            invoiceRowWithAccounting.account = article.accountNr ?? undefined
            invoiceRowWithAccounting.rentArticleName = article.code ?? undefined
          }
        }

        invoiceRowsWithAccounting.push(invoiceRowWithAccounting)
      }
      const invoiceWithAccounting = {
        ...invoice,
        invoiceRows: invoiceRowsWithAccounting,
      }

      invoices.push(invoiceWithAccounting)
    }
  }

  return { ok: true, data: invoices }
}
