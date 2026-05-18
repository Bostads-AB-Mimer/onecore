import axios from 'axios'
import { z } from 'zod'
import config from '../../config'
import { logger } from '@onecore/utilities'
import { AdapterResult } from '../../types'
import {
  TenfastTenantByContactCodeResponseSchema,
  TenfastInvoicesByTenantIdResponseSchema,
  TenfastTenant,
  TenfastInvoicesByOcrResponseSchema,
  TenfastInvoiceStateSchema,
  TenfastInvoice,
  TenfastInvoiceRow,
  TenfastRentArticleSchema,
  TenfastRentArticle,
  TenfastBatchGetRentalObjectsResponseSchema,
  type TenfastBatchGetLease,
} from './schemas'
import {
  Invoice,
  InvoiceRow,
  InvoiceTransactionType,
  PaymentStatus,
} from '@onecore/types'

const baseUrl = config.tenfast.baseUrl
const apiKey = config.tenfast.apiKey
const companyId = config.tenfast.companyId

const TENFAST_INVOICE_STATES = TenfastInvoiceStateSchema.options

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
      '/v1/hyresvard/hyresgaster/search',
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

const dateToDateString = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

export const getInvoicesForTenant = async (
  tenantId: string,
  from?: Date
): Promise<AdapterResult<Invoice[], string>> => {
  try {
    const result = await makeTenfastRequest(
      `/v1/hyresvard/hyresgaster/${tenantId}/hyror`,
      {
        params: {
          // these have no effect currently
          from: from ? dateToDateString(from) : undefined,
          to: from ? dateToDateString(new Date()) : undefined,
        },
      }
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

export const getInvoicesByContactCode = async (
  contactCode: string,
  filters?: { from?: Date }
): Promise<Invoice[]> => {
  const tenantResult = await getTenantByContactCode(contactCode)
  if (!tenantResult.ok) {
    throw tenantResult.err
  }
  if (!tenantResult.data) {
    return []
  }

  const invoicesResult = await getInvoicesForTenant(
    tenantResult.data._id,
    filters?.from
  )
  if (!invoicesResult.ok) {
    throw invoicesResult.err
  }

  return invoicesResult.data
}

export const getInvoiceByOcr = async (
  ocr: string
): Promise<AdapterResult<Invoice | null, string>> => {
  try {
    const result = await makeTenfastRequest('/v1/hyresvard/hyror', {
      params: {
        'filter[ocrNumber]': ocr,
        states: TENFAST_INVOICE_STATES.join(','),
      },
    })
    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    const parsedResponse = TenfastInvoicesByOcrResponseSchema.safeParse(
      result.data
    )
    if (!parsedResponse.success) {
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
    invoiceId: tenfastInvoice.ocrNumber,
    leaseId: '',
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
    credit: null,
  }
}

export const recordPaymentForInvoice = async (params: {
  ocr: string
  amount: number
  dateTime: Date
  // TODO: confirm valid method values with Tenfast (e.g. 'bank', 'bankgiro', 'autogiro')
  method: string
}): Promise<AdapterResult<null, 'not-found' | 'unknown'>> => {
  try {
    const lookupResult = await makeTenfastRequest('/v1/hyresvard/hyror', {
      params: {
        'filter[ocrNumber]': params.ocr,
        states: TENFAST_INVOICE_STATES.join(','),
      },
    })

    logger.info(
      { ocr: params.ocr, status: lookupResult.status, data: lookupResult.data },
      'tenfast-adapter.recordPaymentForInvoice: OCR lookup result'
    )

    if (lookupResult.status !== 200) {
      return { ok: false, err: 'unknown' }
    }

    const OcrLookupResponseSchema = z.object({
      records: z.array(z.object({ _id: z.string() }).passthrough()),
    })

    const parsed = OcrLookupResponseSchema.safeParse(lookupResult.data)
    if (!parsed.success) {
      logger.warn(
        { ocr: params.ocr, errors: parsed.error.issues },
        'tenfast-adapter.recordPaymentForInvoice: OCR lookup response failed schema validation'
      )
      return { ok: false, err: 'unknown' }
    }

    const invoice = parsed.data.records[0]
    logger.info(
      { ocr: params.ocr, found: !!invoice, invoiceId: invoice?._id },
      'tenfast-adapter.recordPaymentForInvoice: invoice lookup'
    )
    if (!invoice) {
      return { ok: false, err: 'not-found' }
    }

    const res = await makeTenfastRequest('/v1/hyresvard/transactions', {
      method: 'POST',
      params: { hyresvard: companyId },
      data: {
        type: 'hyra',
        amount: params.amount,
        dateTime: params.dateTime.toISOString(),
        method: params.method,
        hyra: invoice._id,
      },
    })

    if (res.status === 200 || res.status === 201) {
      return { ok: true, data: null }
    }
    if (res.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    logger.error(
      { status: res.status, data: res.data },
      'tenfast-adapter.recordPaymentForInvoice: unexpected status'
    )
    return { ok: false, err: 'unknown' }
  } catch (err: any) {
    logger.error(err, 'tenfast-adapter.recordPaymentForInvoice')
    return { ok: false, err: 'unknown' }
  }
}

export const updateLeaseInvoiceRows = async (params: {
  leaseId: string
  rowsToDelete: string[]
  rowsToAdd: Omit<TenfastInvoiceRow, '_id' | 'accountingRows'>[]
}): Promise<AdapterResult<null, string>> => {
  try {
    const res = await makeTenfastRequest(
      `/v1/hyresvard/extras/avtal/${encodeURIComponent(params.leaseId)}/rows`,
      {
        method: 'PATCH',
        params: { hyresvard: companyId },
        data: {
          vatEnabled: true,
          rowsToDelete: params.rowsToDelete,
          rowsToAdd: params.rowsToAdd,
        },
      }
    )

    if (res.status === 200) {
      return { ok: true, data: null }
    }

    return { ok: false, err: `Unexpected status ${res.status}` }
  } catch (err: any) {
    logger.error(err, 'tenfast-adapter.updateLeaseInvoiceRows')
    return { ok: false, err: err.message }
  }
}

export type LeaseMatch = {
  leaseId: string
  leaseEndDate: Date | null
}

export type MultipleLeaseMatch = {
  leaseIds: string[]
}

const BATCH_SIZE = 500

// Stages that represent leases that were never fully activated
const EXCLUDED_STAGES = new Set(['draft', 'signingInProgress'])

function findMatchingLeases(
  leases: TenfastBatchGetLease[],
  periodStart: Date,
  periodEnd: Date
): TenfastBatchGetLease[] {
  // Only consider leases that cover the entire period — started on or before
  // periodStart and ends on or after periodEnd (or has no end date).
  return leases.filter((lease) => {
    if (EXCLUDED_STAGES.has(lease.stage)) return false
    if (lease.startDate > periodStart) return false
    if (lease.endDate !== null && lease.endDate < periodEnd) return false
    return true
  })
}

export const getActiveLeasesByRentalObjectCodes = async (params: {
  rentalObjectCodes: string[]
  periodStart: Date
  periodEnd: Date
}): Promise<Map<string, LeaseMatch | MultipleLeaseMatch | null>> => {
  if (params.rentalObjectCodes.length === 0) return new Map()

  const batches: string[][] = []
  for (let i = 0; i < params.rentalObjectCodes.length; i += BATCH_SIZE) {
    batches.push(params.rentalObjectCodes.slice(i, i + BATCH_SIZE))
  }

  const queryBatch = async (
    batch: string[],
    index: number
  ): Promise<Map<string, LeaseMatch | MultipleLeaseMatch | null>> => {
    const start = Date.now()
    const res = await makeTenfastRequest(
      '/v1/hyresvard/extras/hyresobjekt/batch-get',
      {
        method: 'POST',
        params: { hyresvard: companyId, includeAvtal: 'all' },
        data: { externalIds: batch },
      }
    )

    if (res.status !== 200) {
      throw new Error(`Tenfast batch-get returned status ${res.status}`)
    }

    const parsed = TenfastBatchGetRentalObjectsResponseSchema.safeParse(
      res.data
    )
    if (!parsed.success) {
      logger.error(
        parsed.error,
        'IMD: Failed to parse Tenfast batch-get response'
      )
      throw new Error('schema-error')
    }

    const batchMap = new Map<string, LeaseMatch | MultipleLeaseMatch | null>()

    for (const record of parsed.data) {
      // Rental object exists — default to null (no active lease found)
      batchMap.set(record.externalId, null)

      const matches = findMatchingLeases(
        record.avtal,
        params.periodStart,
        params.periodEnd
      )

      if (matches.length === 1) {
        batchMap.set(record.externalId, {
          leaseId: matches[0].externalId,
          leaseEndDate: matches[0].endDate ?? null,
        })
      } else if (matches.length > 1) {
        batchMap.set(record.externalId, {
          leaseIds: matches.map((l) => l.externalId),
        })
      }
    }

    logger.info(
      `IMD: Batch ${index + 1}/${batches.length} — ${batch.length} codes, ${parsed.data.length} records, ${Date.now() - start}ms`
    )

    return batchMap
  }

  const batchResults = await Promise.all(
    batches.map((batch, i) => queryBatch(batch, i))
  )

  const results = new Map<string, LeaseMatch | MultipleLeaseMatch | null>()
  for (const batchMap of batchResults) {
    for (const [code, match] of batchMap) {
      results.set(code, match)
    }
  }

  return results
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
