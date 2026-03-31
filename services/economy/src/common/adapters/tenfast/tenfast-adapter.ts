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
  TenfastBatchGetRentalObjectsResponseSchema,
  type TenfastLease,
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

const BATCH_SIZE = 500

// Stages that represent leases that were never fully activated
const EXCLUDED_STAGES = new Set(['draft', 'signingInProgress'])

function findActiveLease(
  leases: TenfastLease[],
  periodStart: Date,
  periodEnd: Date
): TenfastLease | null {
  const candidates = leases.filter((lease) => {
    if (lease.externalId.includes('M')) return false
    if (EXCLUDED_STAGES.has(lease.stage)) return false
    if (lease.startDate > periodEnd) return false
    if (lease.endDate !== null && lease.endDate < periodStart) return false
    return true
  })

  if (candidates.length === 0) return null

  // Pick the lease with the latest startDate — most relevant to the period
  return candidates.reduce((best, lease) =>
    lease.startDate > best.startDate ? lease : best
  )
}

export const getActiveLeasesByRentalObjectCodes = async (params: {
  rentalObjectCodes: string[]
  periodStart: Date
  periodEnd: Date
}): Promise<Map<string, LeaseMatch | null>> => {
  if (params.rentalObjectCodes.length === 0) return new Map()

  const batches: string[][] = []
  for (let i = 0; i < params.rentalObjectCodes.length; i += BATCH_SIZE) {
    batches.push(params.rentalObjectCodes.slice(i, i + BATCH_SIZE))
  }

  const queryBatch = async (
    batch: string[],
    index: number
  ): Promise<Map<string, LeaseMatch | null>> => {
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

    const batchMap = new Map<string, LeaseMatch | null>()

    for (const record of parsed.data.records) {
      // Rental object exists — default to null (no active lease found)
      batchMap.set(record.externalId, null)

      const activeLease = findActiveLease(
        record.avtal,
        params.periodStart,
        params.periodEnd
      )
      if (activeLease) {
        batchMap.set(record.externalId, {
          leaseId: activeLease.externalId,
          leaseEndDate: activeLease.endDate ?? null,
        })
      }
    }

    logger.info(
      `IMD: Batch ${index + 1}/${batches.length} — ${batch.length} codes, ${parsed.data.records.length} records, ${Date.now() - start}ms`
    )

    return batchMap
  }

  const batchResults = await Promise.all(
    batches.map((batch, i) => queryBatch(batch, i))
  )

  const results = new Map<string, LeaseMatch | null>()
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
