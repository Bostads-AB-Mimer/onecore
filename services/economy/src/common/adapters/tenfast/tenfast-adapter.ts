import axios from 'axios'
import config from '../../config'
import { logger } from '@onecore/utilities'
import { AdapterResult } from '../../types'
import {
  TenfastTenantSchema,
  TenfastInvoicesByTenantIdResponseSchema,
  TenfastTenant,
  TenfastInvoiceSchema,
  TenfastInvoice,
  TenfastInvoiceRow,
  TenfastRentArticleSchema,
  TenfastRentArticle,
  TenfastBatchGetRentalObjectsResponseSchema,
  type TenfastBatchGetLease,
  TenfastLease,
  TenfastLeaseSchema,
  TenfastRentalPropertySchema,
  TenfastRentalProperty,
  TenfastAutogiroConsentResponseSchema,
  TenfastAutogiroConsent,
  isVisibleTenfastInvoice,
} from './schemas'
import { TenfastDeferralSource } from '../../invoice-deferral'
import {
  Contact,
  Invoice,
  InvoiceRow,
  InvoiceTransactionType,
  Lease,
  LeaseStatus,
  LeaseType,
  PaymentStatus,
  RentalProperty,
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
      `/v1/hyresvard/extras/hyresgaster/${encodeURIComponent(contactCode)}`,
      { params: { hyresvard: companyId } }
    )

    if (tenantResponse.status === 404) return { ok: true, data: null }

    if (tenantResponse.status !== 200) {
      return {
        ok: false,
        err: tenantResponse.statusText,
        statusCode: tenantResponse.status,
      }
    }

    const parsed = TenfastTenantSchema.safeParse(tenantResponse.data)
    if (!parsed.success) {
      logger.warn(JSON.stringify(parsed.error, null, 2))
      return { ok: false, err: 'schema-error' }
    }

    return { ok: true, data: parsed.data }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

export const getContactByContactCode = async (
  contactCode: string
): Promise<AdapterResult<Contact, string>> => {
  const tenfastTenantResult = await getTenantByContactCode(contactCode)
  if (!tenfastTenantResult.ok) {
    return { ok: false, err: tenfastTenantResult.err }
  }
  if (!tenfastTenantResult.data) {
    return {
      ok: false,
      err: `Contact with contactCode ${contactCode} not found`,
    }
  }

  const contact = transformTenfastTenantToContact(tenfastTenantResult.data)

  return { ok: true, data: contact }
}

const transformTenfastTenantToContact = (
  tenfastTenant: TenfastTenant
): Contact => {
  return {
    contactCode: tenfastTenant.externalId,
    contactKey: tenfastTenant._id,
    firstName: tenfastTenant.name.first,
    lastName: tenfastTenant.name.last,
    fullName: tenfastTenant.displayName,
    nationalRegistrationNumber: tenfastTenant.idbeteckning,
    birthDate: new Date(0), // not available in Tenfast tenant data
    address: {
      street: tenfastTenant.postadress,
      number: '', // Tenfast stores full address in postadress, no separate house number
      postalCode: tenfastTenant.postnummer,
      city: tenfastTenant.stad,
    },
    phoneNumbers: tenfastTenant.phone
      ? [{ phoneNumber: tenfastTenant.phone, type: 'main', isMainNumber: true }]
      : undefined,
    isTenant: true,
    careOf: tenfastTenant.careOfAddress,
    protectedIdentity: false, // not available in Tenfast tenant data
    deceased: false, // not available in Tenfast tenant data
    emigrated: false, // not available in Tenfast tenant data
    noAdvertising: false, // not available in Tenfast tenant data
  }
}

const dateToDateString = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

export type ParsedTenfastInvoice = {
  invoice: Invoice
  tenfastDeferral?: TenfastDeferralSource
}

export const getInvoicesForTenant = async (
  tenantId: string,
  from?: Date
): Promise<AdapterResult<ParsedTenfastInvoice[], string>> => {
  try {
    const result = await makeTenfastRequest(
      `/v1/hyresvard/hyresgaster/${tenantId}/hyror?populate=avtal`,
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
      logger.error(
        { tenantId, error: parsedResponse.error.issues },
        'Failed to parse Tenfast invoices by tenant id response'
      )
      return { ok: false, err: 'schema-error' }
    }
    return {
      ok: true,
      data: parsedResponse.data
        .filter(isVisibleTenfastInvoice)
        .map(transformToInvoice),
    }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

export const getInvoicesByContactCode = async (
  contactCode: string,
  filters?: { from?: Date }
): Promise<ParsedTenfastInvoice[]> => {
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

export const getRentalProperty = async (
  rentalPropertyCode: string
): Promise<AdapterResult<RentalProperty, string>> => {
  try {
    const result = await makeTenfastRequest(
      `/v1/hyresvard/extras/hyresobjekt/${encodeURIComponent(rentalPropertyCode)}`,
      { params: { hyresvard: companyId } }
    )

    if (result.status === 404) {
      return {
        ok: false,
        err: `Rental property with rentalPropertyCode ${rentalPropertyCode} not found`,
      }
    }

    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    const parsed = TenfastRentalPropertySchema.safeParse(result.data)
    if (!parsed.success) {
      logger.warn(JSON.stringify(parsed.error, null, 2))
      return { ok: false, err: 'schema-error' }
    }

    return { ok: true, data: transformToRentalProperty(parsed.data) }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

const transformToRentalProperty = (
  tenfastRentalProperty: TenfastRentalProperty
): RentalProperty => {
  return {
    rentalPropertyId: tenfastRentalProperty.externalId,
    apartmentNumber: tenfastRentalProperty.skvNummer ?? 0, // ?
    size: tenfastRentalProperty.kvm,
    type: tenfastRentalProperty.typ,
    rentalPropertyType: tenfastRentalProperty.typ, // ?
    address: {
      street: tenfastRentalProperty.postadress,
      number: tenfastRentalProperty.nummer,
      postalCode: tenfastRentalProperty.postnummer,
      city: tenfastRentalProperty.stad,
    },
    additionsIncludedInRent: '',
    otherInfo: tenfastRentalProperty.description,
    roomTypes: undefined, // TenfastRentalProperty has roomCount but no room type details
    lastUpdated: new Date(tenfastRentalProperty.updatedAt),
  }
}

export const getLease = async (
  leaseId: string
): Promise<AdapterResult<Lease, string>> => {
  try {
    const result = await makeTenfastRequest(
      `/v1/hyresvard/extras/avtal/${encodeURIComponent(leaseId)}`,
      { params: { hyresvard: companyId, populate: 'hyresobjekt,hyresgaster' } }
    )

    if (result.status === 404) {
      return { ok: false, err: `Lease with leaseId ${leaseId} not found` }
    }

    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    const parsed = TenfastLeaseSchema.safeParse(result.data)
    if (!parsed.success) {
      logger.warn(JSON.stringify(parsed.error, null, 2))
      return { ok: false, err: 'schema-error' }
    }

    return { ok: true, data: transformToLease(parsed.data) }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

const stageToLeaseStatus = (stage: TenfastLease['stage']): LeaseStatus => {
  switch (stage) {
    case 'active':
      return LeaseStatus.Current
    case 'upcoming':
      return LeaseStatus.Upcoming
    case 'terminationScheduled':
      return LeaseStatus.AboutToEnd
    case 'preTermination':
      return LeaseStatus.PreliminaryTerminated
    case 'signingInProgress':
      return LeaseStatus.PendingSignature
    case 'terminated':
    case 'archived':
    case 'voided':
      return LeaseStatus.Ended
    case 'draft':
      return LeaseStatus.NotSent
  }
}

const transformToLease = (tenfastLease: TenfastLease): Lease => {
  let lastDebitDate: Date | undefined

  if (
    ['preTermination', 'terminationScheduled', 'terminated'].includes(
      tenfastLease.stage
    )
  ) {
    if (!tenfastLease.endDate) {
      throw new Error(
        `Lease ${tenfastLease.externalId} is terminated but does not have an endDate`
      )
    }

    lastDebitDate = tenfastLease.endDate
  }

  const rentalProperty = tenfastLease.hyresobjekt[0]

  const LeaseTypeFromTenfastTyp: Record<string, LeaseType> = {
    bostad: LeaseType.HousingContract,
    parkering: LeaseType.ParkingSpaceContract,
    lokal: LeaseType.CommercialTenantContract,
    garage: LeaseType.GarageContract,
    forrad: LeaseType.StorageContract,
    ovrigt: LeaseType.OtherContract,
  }

  return {
    leaseId: tenfastLease.externalId,
    leaseNumber: tenfastLease.reference.toString(),
    leaseStartDate: tenfastLease.startDate,
    leaseEndDate: tenfastLease.endDate ?? undefined,
    status: stageToLeaseStatus(tenfastLease.stage),
    tenantContactIds: undefined,
    tenants: undefined,
    rentalPropertyId: rentalProperty.externalId,
    rentalObject: undefined,
    type:
      LeaseTypeFromTenfastTyp[rentalProperty.typ] ?? LeaseType.OtherContract,
    lastDebitDate: lastDebitDate,
    noticeGivenBy: undefined,
    noticeDate: undefined,
    noticeTimeTenant: undefined,
    preferredMoveOutDate: undefined,
    terminationDate: undefined,
    contractDate: undefined,
    approvalDate: undefined,
    residentialArea: undefined,
    rentRows: [], // not in TenfastLease, requires separate fetch
  }
}

const fetchTenfastInvoiceByOcr = async (
  ocr: string
): Promise<
  AdapterResult<TenfastInvoice, 'not-found' | 'unknown' | 'schema-error'>
> => {
  try {
    const result = await makeTenfastRequest(
      `/v1/hyresvard/extras/hyror/${encodeURIComponent(ocr)}`,
      {
        params: { hyresvard: companyId, populate: 'avtal' },
      }
    )

    if (result.status === 404) {
      logger.info({ ocr }, 'deferral: Tenfast OCR lookup returned 404')
      return { ok: false, err: 'not-found' }
    }

    if (result.status !== 200) {
      logger.info(
        { ocr, status: result.status, data: result.data },
        'deferral: Tenfast OCR lookup returned unexpected status'
      )
      return { ok: false, err: 'unknown' }
    }

    const parsed = TenfastInvoiceSchema.safeParse(result.data)
    if (!parsed.success) {
      logger.warn(
        { ocr, errors: parsed.error.issues },
        'tenfast-adapter.fetchTenfastInvoiceByOcr: response failed schema validation'
      )
      return { ok: false, err: 'schema-error' }
    }

    return { ok: true, data: parsed.data }
  } catch (err: any) {
    logger.error(err, 'tenfast-adapter.fetchTenfastInvoiceByOcr')
    return { ok: false, err: 'unknown' }
  }
}

export const getInvoiceByOcr = async (
  ocr: string
): Promise<AdapterResult<ParsedTenfastInvoice, string>> => {
  const result = await fetchTenfastInvoiceByOcr(ocr)
  if (!result.ok) {
    if (result.err === 'not-found') {
      return { ok: false, err: `Invoice with ocr ${ocr} not found` }
    }
    if (result.err === 'schema-error') {
      return { ok: false, err: 'schema-error' }
    }
    return { ok: false, err: 'unknown' }
  }

  if (!isVisibleTenfastInvoice(result.data)) {
    return {
      ok: false,
      err: `Invoice with ocr ${ocr} not found`,
    }
  }

  return {
    ok: true,
    data: transformToInvoice(result.data),
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

const toTenfastDeferralSource = (
  gracePeriod: TenfastInvoice['gracePeriod']
): TenfastDeferralSource | undefined => {
  if (!gracePeriod) {
    return undefined
  }

  return {
    reason: gracePeriod.reason,
    madeBy: gracePeriod.madeByEmail,
  }
}

const transformToInvoice = (
  tenfastInvoice: TenfastInvoice
): ParsedTenfastInvoice => {
  const remainingAmount = tenfastInvoice.amount - tenfastInvoice.amountPaid

  return {
    invoice: {
      amount: tenfastInvoice.amount,
      debitStatus: 0, //
      fromDate: new Date(tenfastInvoice.interval.from),
      toDate: new Date(tenfastInvoice.interval.to),
      invoiceDate: tenfastInvoice.activatedAt
        ? new Date(tenfastInvoice.activatedAt)
        : new Date(tenfastInvoice.expectedInvoiceDate),
      expirationDate: new Date(tenfastInvoice.due),
      paidAmount: tenfastInvoice.amountPaid,
      remainingAmount,
      invoiceId: tenfastInvoice.ocrNumber,
      leaseIds: tenfastInvoice.avtal.map((a) => a.externalId),
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
    },
    tenfastDeferral: toTenfastDeferralSource(tenfastInvoice.gracePeriod),
  }
}

export const setGracePeriod = async (params: {
  invoiceOcr: string
  endDate: string
  madeByEmail: string
  reason: string
}): Promise<AdapterResult<null, 'not-found' | 'unknown' | 'schema-error'>> => {
  try {
    const result = await fetchTenfastInvoiceByOcr(params.invoiceOcr)
    if (!result.ok) {
      logger.info(
        { invoiceOcr: params.invoiceOcr, err: result.err },
        'deferral: Tenfast grace period aborted — OCR lookup failed'
      )
      return result
    }

    const res = await makeTenfastRequest(
      `/v1/hyresvard/hyror/${result.data._id}/grace-period`,
      {
        method: 'POST',
        data: {
          endDate: params.endDate,
          madeByEmail: params.madeByEmail,
          reason: params.reason,
        },
      }
    )

    if (res.status === 200) {
      return { ok: true, data: null }
    }
    if (res.status === 404) {
      logger.error(
        { invoiceOcr: params.invoiceOcr, tenfastInvoiceId: result.data._id },
        'deferral: Tenfast grace-period endpoint returned 404'
      )
      return { ok: false, err: 'not-found' }
    }

    logger.error(
      {
        status: res.status,
        data: res.data,
        ocr: params.invoiceOcr,
        tenfastInvoiceId: result.data._id,
      },
      'tenfast-adapter.setGracePeriod: unexpected status'
    )
    return { ok: false, err: 'unknown' }
  } catch (err: any) {
    logger.error(err, 'tenfast-adapter.setGracePeriod')
    return { ok: false, err: 'unknown' }
  }
}

export const recordPaymentForInvoice = async (params: {
  ocr: string
  amount: number
  dateTime: Date
  // TODO: confirm valid method values with Tenfast (e.g. 'bank', 'bankgiro', 'autogiro')
  method: string
}): Promise<AdapterResult<null, 'not-found' | 'unknown' | 'schema-error'>> => {
  try {
    const result = await fetchTenfastInvoiceByOcr(params.ocr)
    if (!result.ok) {
      return result
    }

    const invoice = result.data
    logger.info(
      { ocr: params.ocr, found: true, invoiceId: invoice._id },
      'tenfast-adapter.recordPaymentForInvoice: invoice lookup'
    )

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
    totalAmount: tenfastInvoiceRow.amount * (1 + tenfastInvoiceRow.vat),
    printGroup: tenfastInvoiceRow.consolidationLabel ?? null,
    invoiceRowText: tenfastInvoiceRow.label,
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

export const getInvoicePdf = async (
  ocr: string
): Promise<
  AdapterResult<
    { data: Buffer; contentDisposition: string },
    'not-found' | 'unknown'
  >
> => {
  try {
    const result = await fetchTenfastInvoiceByOcr(ocr)
    if (!result.ok) {
      if (result.err === 'not-found') {
        return { ok: false, err: 'not-found' }
      }
      logger.error({ ocr }, 'getInvoicePdf: OCR lookup failed')
      return { ok: false, err: 'unknown' }
    }

    const tenfastId = result.data._id

    const response = await axios.request({
      baseURL: baseUrl,
      url: `/v1/hyresvard/hyror/${tenfastId}/download-pdf`,
      method: 'GET',
      responseType: 'arraybuffer',
      headers: {
        'api-token': apiKey,
      },
      validateStatus: () => true,
    })

    if (response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    if (response.status !== 200) {
      logger.error(
        { ocr, tenfastId, status: response.status },
        'getInvoicePdf: PDF download failed'
      )
      return { ok: false, err: 'unknown' }
    }

    return {
      ok: true,
      data: {
        data: Buffer.from(response.data),
        contentDisposition: response.headers['content-disposition'] ?? '',
      },
    }
  } catch (err) {
    logger.error({ err, ocr }, 'getInvoicePdf: failed')
    return { ok: false, err: 'unknown' }
  }
}

export const getAutogiroConsentByNationalRegistrationNumber = async (
  nationalRegistrationNumber: string
): Promise<AdapterResult<TenfastAutogiroConsent | null, string>> => {
  try {
    // payerSSN in autogiro consent has a dash before the last 4 digits, we need to add it to nationalRegistrationNumber if missing
    const formattedNationalRegistrationNumber =
      nationalRegistrationNumber.includes('-')
        ? nationalRegistrationNumber
        : `${nationalRegistrationNumber.slice(0, -4)}-${nationalRegistrationNumber.slice(-4)}`

    const autogiroConsentResponse = await makeTenfastRequest(
      '/v1/hyresvard/autogiro/consents/search',
      {
        params: {
          'filter[payerSSN]': formattedNationalRegistrationNumber,
          limit: 1,
        },
      }
    )
    if (autogiroConsentResponse.status !== 200) {
      return {
        ok: false,
        err: autogiroConsentResponse.statusText,
        statusCode: autogiroConsentResponse.status,
      }
    }

    const parsedResponse = TenfastAutogiroConsentResponseSchema.safeParse(
      autogiroConsentResponse.data
    )
    if (!parsedResponse.success) {
      logger.warn(JSON.stringify(parsedResponse.error, null, 2))
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
