import axios from 'axios'

import config, { isRentalObjectRequirementException } from '../../config'
import { errorMessage, logger } from '@onecore/utilities'
import { AdapterResult } from '../../types'
import { z } from 'zod'
import {
  TenfastInvoicesByTenantIdResponseSchema,
  TenfastTenant,
  TenfastInvoicesByExportedResponseSchema,
  TenfastTenantSchema,
  TenfastInvoiceSchema,
  TenfastRentalLossHyraSchema,
  TenfastRentalLossSchema,
  TenfastRentalLoss,
  TenfastRentalLossHyra,
  TenfastRentalLossResponseSchema,
  TenfastBatchGetRentalObjectsResponseSchema,
  type TenfastBatchGetLease,
  TenfastTenantLeasesResponseSchema,
  type TenfastTenantLease,
  TenfastLease,
  TenfastLeaseSchema,
  TenfastRentalPropertySchema,
  TenfastRentalProperty,
  TenfastOutboundExportSchema,
  TenfastOutboundExportListSchema,
  TenfastOutboundExport,
  TenfastAutogiroConsentResponseSchema,
  TenfastAutogiroConsent,
  isVisibleTenfastInvoice,
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
  Contact,
  Lease,
  LeaseStatus,
  LeaseType,
  RentalProperty,
  economy,
} from '@onecore/types'

import {
  InvoiceRowWithAccounting,
  InvoiceWithAccounting,
  MimerCompany,
  RentalLoss,
  RentalLossChecksumMismatch,
  RentalLossError,
  RentalLossInterval,
  RentalLossRow,
  TenfastRentalObject,
} from '@src/common/types/typesv2'

import { TenfastDeferralSource } from '../../invoice-deferral'

const baseUrl = config.tenfast.baseUrl
const apiKey = config.tenfast.apiKey
const companyId = config.tenfast.companyId

export const makeTenfastRequest = async (
  url: string,
  config?: {
    method?: string
    params?: Record<string, string | string[] | number | number[] | undefined>
    data?: any
    validateStatus?: (status: number) => boolean
    responseType?: 'json' | 'arraybuffer'
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
    ...(config?.validateStatus && { validateStatus: config.validateStatus }),
    ...(config?.responseType && { responseType: config.responseType }),
  })
}

export const getTenantByContactCode = async (
  contactCode: string
): Promise<AdapterResult<TenfastTenant | null, string>> => {
  try {
    const tenantResponse = await makeTenfastRequest(
      `/v1/hyresvard/extras/hyresgaster/${encodeURIComponent(contactCode)}`,
      {
        params: { hyresvard: companyId },
        // 404 is a contact Tenfast doesn't have (e.g. leases ended before
        // Tenfast), not a failure, so it must reach the null branch below.
        validateStatus: (status) => status === 200 || status === 404,
      }
    )

    if (tenantResponse.status === 404) return { ok: true, data: null }

    const parsed = TenfastTenantSchema.safeParse(tenantResponse.data)
    if (!parsed.success) {
      logger.warn(JSON.stringify(parsed.error, null, 2))
      return { ok: false, err: 'schema-error' }
    }

    return { ok: true, data: parsed.data }
  } catch (err: unknown) {
    // Never the raw error: an AxiosError carries the request headers,
    // including the API token.
    const status = axios.isAxiosError(err) ? err.response?.status : undefined
    logger.error(
      { contactCode, status, error: errorMessage(err) },
      'tenfast-adapter.getTenantByContactCode'
    )
    return { ok: false, err: errorMessage(err) }
  }
}

const getRentalObjectById = async (
  id: string
): Promise<AdapterResult<TenfastRentalObject, string>> => {
  try {
    const result = await makeTenfastRequest(`/v1/hyresvard/hyresobjekt/${id}`)
    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    const rentalObject: TenfastRentalObject = {
      _id: result.data._id,
      externalId: result.data.externalId,
    }

    return { ok: true, data: rentalObject }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

// Largest page size Tenfast accepts on /v1/hyresvard/hyror.
const TENFAST_INVOICES_PAGE_SIZE = 1000

// Upper bound on the pages fetched in one walk, so a cursor chain that never
// ends can't loop forever. Far above any real result set.
const TENFAST_MAX_PAGES = 100

export type TenfastPagesError =
  'request-failed' | 'schema-error' | 'pagination-error'

/**
 * Fetches every page of a paginated Tenfast list endpoint.
 *
 * `paginate` is a cursor in Tenfast, not an on/off flag: the first page is
 * requested without it and each following page with the previous `next`, until
 * `next` is missing. `totalCount` is deliberately not a stop condition, since
 * records can be created between pages.
 *
 * Any failed page fails the whole walk: returning the pages fetched so far
 * would silently hide the remaining records. Network errors are thrown, so
 * call this inside the adapter function's try/catch.
 */
const fetchAllTenfastPages = async <T>(
  url: string,
  params: Record<string, string | number | undefined>,
  schema: z.ZodType<
    { records: T[]; next: string | null },
    z.ZodTypeDef,
    unknown
  >,
  logContext: Record<string, string>
): Promise<AdapterResult<T[], TenfastPagesError>> => {
  const records: T[] = []
  let cursor: string | undefined

  for (let page = 0; page < TENFAST_MAX_PAGES; page++) {
    const response = await makeTenfastRequest(url, {
      params: { ...params, ...(cursor ? { paginate: cursor } : {}) },
      // Every status resolves, so a failed page is handled here rather than
      // depending on the process-wide axios default.
      validateStatus: () => true,
    })
    if (response.status !== 200) {
      // Status only: the body can hold tenant data.
      logger.warn(
        { ...logContext, url, status: response.status },
        'tenfast-adapter.fetchAllTenfastPages: unexpected status'
      )
      return { ok: false, err: 'request-failed' }
    }

    const parsed = schema.safeParse(response.data)
    if (!parsed.success) {
      logger.error(
        { ...logContext, url, error: parsed.error.issues },
        'tenfast-adapter.fetchAllTenfastPages: response parse failed'
      )
      return { ok: false, err: 'schema-error' }
    }

    records.push(...parsed.data.records)

    const { next } = parsed.data
    if (!next) {
      return { ok: true, data: records }
    }
    // Tenfast answers a cursor it doesn't accept with the first page again. An
    // empty page or a cursor that repeats means the walk can't progress, and
    // continuing would return duplicated or incomplete records as success.
    if (parsed.data.records.length === 0 || next === cursor) {
      logger.error(
        { ...logContext, url, page },
        'tenfast-adapter.fetchAllTenfastPages: cursor did not advance'
      )
      return { ok: false, err: 'pagination-error' }
    }
    cursor = next
  }

  logger.error(
    { ...logContext, url, maxPages: TENFAST_MAX_PAGES },
    'tenfast-adapter.fetchAllTenfastPages: page limit reached'
  )
  return { ok: false, err: 'pagination-error' }
}

export const getInvoicesForTenant = async (
  tenantId: string,
  from?: Date
): Promise<AdapterResult<ParsedTenfastInvoice[], TenfastPagesError>> => {
  try {
    const pagesResult = await fetchAllTenfastPages(
      '/v1/hyresvard/hyror',
      {
        hyresvard: companyId,
        hyresgast: tenantId,
        limit: TENFAST_INVOICES_PAGE_SIZE,
        // No `to`: Tenfast applies from/to to the invoice period, not the
        // invoice date. Rent is invoiced in advance, so an upper bound of
        // today would drop next month's invoice.
        from: from ? dateToDateString(from) : undefined,
      },
      TenfastInvoicesByTenantIdResponseSchema,
      { tenantId }
    )
    if (!pagesResult.ok) {
      return pagesResult
    }

    return {
      ok: true,
      data: pagesResult.data
        .filter(isVisibleTenfastInvoice)
        .map(transformToInvoice),
    }
  } catch (err: unknown) {
    // Never the raw error: an AxiosError carries the request headers,
    // including the API token.
    const status = axios.isAxiosError(err) ? err.response?.status : undefined
    logger.error(
      { tenantId, status, error: errorMessage(err) },
      'tenfast-adapter.getInvoicesForTenant'
    )
    return { ok: false, err: 'request-failed' }
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

  await replaceRentArticleIdsWithCodes(invoicesResult.data)
  return invoicesResult.data
}

/**
 * Tenfast invoice rows reference their article by Tenfast's internal id.
 * Shown to users, replace it with the article code (e.g. HYRAB). Only on
 * this read path: the accounting export looks articles up by id. A row whose
 * article can't be fetched keeps the id; getInvoiceArticle logs the failure.
 */
const replaceRentArticleIdsWithCodes = async (
  invoices: ParsedTenfastInvoice[]
) => {
  const rows = invoices.flatMap((parsed) => parsed.invoice.invoiceRows)
  const articleIds = [
    ...new Set(
      rows.flatMap((row) => (row.rentArticle ? [row.rentArticle] : []))
    ),
  ]

  const codeById = new Map(
    await Promise.all(
      articleIds.map(async (articleId) => {
        const result = await getInvoiceArticle(articleId)
        return [articleId, result.ok ? result.data.code : undefined] as const
      })
    )
  )

  for (const row of rows) {
    const code = row.rentArticle ? codeById.get(row.rentArticle) : undefined
    if (code) row.rentArticle = code
  }
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
    size: tenfastRentalProperty.kvm ?? 0,
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
    case 'terminationSigningInProgress':
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

  // Same mapping as the leasing service. Tenfast sends 'förråd', which Xpand
  // types as Lokalkontrakt.
  const LeaseTypeFromTenfastTyp: Record<string, LeaseType> = {
    bostad: LeaseType.HousingContract,
    parkering: LeaseType.ParkingSpaceContract,
    lokal: LeaseType.CommercialTenantContract,
    garage: LeaseType.GarageContract,
    förråd: LeaseType.CommercialTenantContract,
    forrad: LeaseType.CommercialTenantContract,
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
      LeaseTypeFromTenfastTyp[rentalProperty.typ.toLowerCase()] ??
      LeaseType.OtherContract,
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
        validateStatus: (status) => [200, 404].includes(status),
      }
    )

    if (result.status === 404) {
      logger.info({ ocr }, 'deferral: Tenfast OCR lookup returned 404')
      return { ok: false, err: 'not-found' }
    }

    if (result.status !== 200) {
      logger.info(
        { ocr, status: result.status },
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
): Promise<AdapterResult<ParsedTenfastInvoice | null, string>> => {
  const result = await fetchTenfastInvoiceByOcr(ocr)
  if (!result.ok) {
    if (result.err === 'not-found') {
      return { ok: true, data: null }
    }
    if (result.err === 'schema-error') {
      return { ok: false, err: 'schema-error' }
    }
    return { ok: false, err: 'unknown' }
  }

  if (!isVisibleTenfastInvoice(result.data)) {
    return {
      ok: true,
      data: null,
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
      `/v1/hyresvard/articles/${articleId}`,
      { validateStatus: (status) => [200, 404].includes(status) }
    )

    if (result.status === 404) {
      logger.warn({ articleId }, 'tenfast-adapter.getInvoiceArticle: not found')
      return { ok: false, err: 'not-found' }
    }

    if (result.status !== 200) {
      return { ok: false, err: result.statusText }
    }

    const parsedResponse = TenfastRentArticleSchema.safeParse(result.data)
    if (!parsedResponse.success) {
      logger.error(
        { articleId, issues: parsedResponse.error.issues },
        'tenfast-adapter.getInvoiceArticle: response failed schema validation'
      )
      return { ok: false, err: 'schema-error' }
    }

    return { ok: true, data: parsedResponse.data }
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined
    logger.error(
      { articleId, status, error: errorMessage(err) },
      'tenfast-adapter.getInvoiceArticle'
    )
    return { ok: false, err: 'request-failed' }
  }
}

let rentArticles: TenfastRentArticle[]

const retrieveRentArticles = async () => {
  const result = await makeTenfastRequest(`/v1/hyresvard/articles`)

  if (result.status !== 200) {
    logger.error(result.status)
    throw new Error('Could not retrieve rent articles from Tenfast')
  }

  const correctArticles = result.data.filter((article: any) => article.category)

  const parsedResponse = z
    .array(TenfastRentArticleSchema)
    .safeParse(correctArticles)
  if (!parsedResponse.success) {
    logger.error(parsedResponse)
    throw new Error('Could not retrieve rent articles from Tenfast')
  }

  rentArticles = parsedResponse.data
}

/*const transformToInvoice = (tenfastInvoice: TenfastInvoice): Invoice => {
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
    externalId: tenfastInvoice._id,
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
    credit: null,
  }
}*/

const toTenfastDeferralSource = (
  gracePeriod: TenfastInvoice['gracePeriod']
): TenfastDeferralSource | undefined => {
  if (!gracePeriod) {
    return undefined
  }

  return {
    reason: gracePeriod.reason ?? '',
    madeBy: gracePeriod.madeByEmail,
  }
}

const transformToInvoice = (
  tenfastInvoice: Omit<TenfastInvoice, 'avtal'> & {
    avtal: { externalId: string }[]
  }
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
        : // expectedInvoiceDate is no longer returned for some invoices
          // (e.g. credited ones), fall back to the due date.
          new Date(tenfastInvoice.expectedInvoiceDate ?? tenfastInvoice.due),
      expirationDate: new Date(tenfastInvoice.due),
      paidAmount: tenfastInvoice.amountPaid,
      remainingAmount,
      // ocrNumber is no longer returned for some invoices (e.g. credited ones)
      invoiceId: tenfastInvoice.ocrNumber ?? '',
      leaseIds: tenfastInvoice.avtal.map((a) => a.externalId),
      paymentStatus:
        remainingAmount <= 0 ? PaymentStatus.Paid : PaymentStatus.Unpaid,
      type: 'Regular',
      reference: tenfastInvoice.ocrNumber ?? '',
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
      { status: res.status },
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
  tenantIds: string[]
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
          tenantIds: matches[0].hyresgaster.map((tenant) =>
            typeof tenant === 'string' ? tenant : tenant._id
          ),
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

export type TenantLease = {
  leaseId: string
  stage: string
  startDate: Date | null
  endDate: Date | null
  isResidential: boolean
}

const toTenantLease = (lease: TenfastTenantLease): TenantLease => ({
  leaseId: lease.externalId,
  stage: lease.stage,
  startDate: lease.startDate,
  endDate: lease.endDate,
  isResidential: lease.hyresobjekt.some(
    (rentalObject) =>
      typeof rentalObject !== 'string' &&
      rentalObject.typ?.toLowerCase() === 'bostad'
  ),
})

export const getLeasesByTenantId = async (
  tenantId: string
): Promise<AdapterResult<TenantLease[], 'unknown'>> => {
  try {
    const records: TenfastTenantLease[] = []
    let next: string | null = ''
    let totalCount = Infinity

    while (next !== null && records.length < totalCount) {
      const response = await makeTenfastRequest('/v1/hyresvard/avtal', {
        params: {
          hyresvard: companyId,
          hyresgast: tenantId,
          populate: 'hyresobjekt',
          ...(next ? { paginate: next } : {}),
        },
      })

      if (response.status !== 200) {
        logger.error(
          { tenantId, status: response.status },
          'getLeasesByTenantId: unexpected status'
        )
        return { ok: false, err: 'unknown' }
      }

      const parsed = TenfastTenantLeasesResponseSchema.safeParse(response.data)
      if (!parsed.success) {
        logger.error(
          { tenantId, error: parsed.error },
          'getLeasesByTenantId: response parse failed'
        )
        return { ok: false, err: 'unknown' }
      }

      if (parsed.data.records.length === 0) break

      records.push(...parsed.data.records)
      next = parsed.data.next
      totalCount = parsed.data.totalCount
    }

    return { ok: true, data: records.map(toTenantLease) }
  } catch (err) {
    logger.error({ err, tenantId }, 'getLeasesByTenantId: failed')
    return { ok: false, err: 'unknown' }
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
    totalAmount: tenfastInvoiceRow.amount * (1 + tenfastInvoiceRow.vat),
    printGroup: tenfastInvoiceRow.consolidationLabel ?? null,
    invoiceRowText: tenfastInvoiceRow.label,
    rentalObject: tenfastInvoiceRow.hyresobjekt,
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

const replaceRentalObjectExternalIds = async (invoice: Invoice) => {
  for (const invoiceRow of invoice.invoiceRows) {
    if (invoiceRow.rentalObject) {
      const rentalObjectResult = await getRentalObjectById(
        invoiceRow.rentalObject
      )
      if (rentalObjectResult.ok) {
        invoiceRow.rentalObject = rentalObjectResult.data.externalId
      }
    }
  }
}

const enrichInvoiceRowsWithAccounting = async (
  invoice: Invoice
): Promise<{
  invoiceRows: InvoiceRowWithAccounting[]
  errors: economy.RentalInvoiceExportError[]
}> => {
  const invoiceRowsWithAccounting: InvoiceRowWithAccounting[] = []
  const errors: economy.RentalInvoiceExportError[] = []

  for (const invoiceRow of invoice.invoiceRows) {
    const invoiceRowWithAccounting: InvoiceRowWithAccounting = {
      ...invoiceRow,
    }

    // Every row needs an article: the account, cost code and project code
    // all come from its account configuration.
    if (!invoiceRow.rentArticle) {
      logger.error(
        { invoiceNumber: invoice.invoiceId },
        'Invoice row has no rent article'
      )
      errors.push({
        invoiceNumber: invoice.invoiceId,
        code: 'missing-rent-article',
        error: 'Minst en hyresrad på avin saknar hyresartikel',
      })
      continue
    }

    const articleResult = await getInvoiceArticle(invoiceRow.rentArticle)
    if (!articleResult.ok) {
      logger.error(
        {
          invoiceNumber: invoice.invoiceId,
          article: invoiceRow.rentArticle,
          error: articleResult.err,
        },
        'Could not get article information'
      )
      errors.push(
        articleResult.err === 'not-found'
          ? {
              invoiceNumber: invoice.invoiceId,
              code: 'rent-article-not-found',
              rentArticle: invoiceRow.rentArticle,
              error: `Hyresartikeln ${invoiceRow.rentArticle} finns inte i Tenfast`,
            }
          : {
              invoiceNumber: invoice.invoiceId,
              code: 'rent-article-fetch-failed',
              rentArticle: invoiceRow.rentArticle,
              error: `Kunde inte hämta hyresartikeln ${invoiceRow.rentArticle} från Tenfast`,
            }
      )
      continue
    }

    const article = articleResult.data
    invoiceRowWithAccounting.rentArticleName = article.code ?? undefined
    if (!article.accountConfigurations?.length) {
      logger.error({ article }, 'Rent article has no account configurations')
      errors.push({
        invoiceNumber: invoice.invoiceId,
        code: 'rent-article-missing-accounts',
        rentArticle: article.code ?? invoiceRow.rentArticle,
        error: `Hyresartikeln ${article.code} har inga konton`,
      })
      continue
    }

    const accountConfiguration = article.accountConfigurations.find(
      (accountConfiguration) => {
        return (
          accountConfiguration.categoryCode === 'Intäkter' &&
          accountConfiguration.debitType === 'HYRA'
        )
      }
    )
    if (!accountConfiguration) {
      logger.error(
        { article },
        'Rent article has no account configuration for Intäkter'
      )
      errors.push({
        invoiceNumber: invoice.invoiceId,
        code: 'rent-article-missing-income-account',
        rentArticle: article.code ?? invoiceRow.rentArticle,
        error: `Hyresartikeln ${article.code} har inget konto för kategorin Intäkter`,
      })
      continue
    }

    invoiceRowWithAccounting.account = accountConfiguration.accountNr.toString()
    invoiceRowWithAccounting.costCode =
      accountConfiguration.costCenter && accountConfiguration.costCenter !== ''
        ? accountConfiguration.costCenter
        : undefined
    invoiceRowWithAccounting.property =
      accountConfiguration.property && accountConfiguration.property !== ''
        ? accountConfiguration.property
        : undefined
    invoiceRowWithAccounting.projectCode =
      accountConfiguration.projectCode &&
      accountConfiguration.projectCode !== ''
        ? accountConfiguration.projectCode
        : undefined
    invoiceRowWithAccounting.freeCode = accountConfiguration.freeText

    // A rental object (hyresobjekt) is normally required on every invoice row,
    // but certain article codes (e.g. invoice fees) are exempt via
    // configuration. The article code is resolved above into rentArticleName.
    if (
      !invoiceRow.rentalObject &&
      !isRentalObjectRequirementException(
        invoiceRowWithAccounting.rentArticleName
      )
    ) {
      logger.error(
        {
          invoiceId: invoice.invoiceId,
          article: invoiceRowWithAccounting.rentArticleName,
        },
        'Minst en hyresrad på avin saknar hyresobjekt'
      )
      errors.push({
        invoiceNumber: invoice.invoiceId,
        code: 'missing-rental-object',
        rentArticle: invoiceRowWithAccounting.rentArticleName,
        error: `Minst en hyresrad på avin saknar hyresobjekt (hyresartikel ${invoiceRowWithAccounting.rentArticleName})`,
      })
      continue
    }

    invoiceRowsWithAccounting.push(invoiceRowWithAccounting)
  }
  return {
    invoiceRows: invoiceRowsWithAccounting,
    errors,
  }
}

export const getInvoicesNotExported = async (
  maxCount: number,
  company: MimerCompany
): Promise<
  AdapterResult<
    {
      invoices: InvoiceWithAccounting[]
      errors: economy.RentalInvoiceExportError[] | undefined
    },
    string
  >
> => {
  const errors: economy.RentalInvoiceExportError[] = []

  try {
    const result = await makeTenfastRequest('/v1/hyresvard/hyror', {
      params: {
        isManuallyExported: 'false',
        status: 'issued',
        limit: maxCount,
        hyresvard: company.tenfastId,
        /*paginate:
          'eyJpZCI6IjY5ZDZmNDQ0MGM4NGU2YzRjMDRmNGU5MyIsImlzTmV4dCI6dHJ1ZX0',*/
        //ocrNumber: '552606000000733',
      },
    })

    if (result.status !== 200) {
      logger.error(
        { error: result.statusText },
        'Error getting invoices from Tenfast'
      )
      return { ok: false, err: result.statusText }
    }

    if (!result.data.records || result.data.records.length === 0) {
      return {
        ok: true,
        data: {
          invoices: [],
          errors: undefined,
        },
      }
    }

    const parsedResponse = TenfastInvoicesByExportedResponseSchema.safeParse(
      result.data
    )

    if (!parsedResponse.success) {
      logger.error(
        { error: parsedResponse.error },
        'Error parsing Tenfast invoices'
      )
      return { ok: false, err: 'schema-error' }
    }

    const invoices = await transformExportedInvoiceRecords(
      parsedResponse.data.records,
      errors
    )
    return {
      ok: true,
      data: {
        invoices: invoices,
        errors,
      },
    }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

const transformExportedInvoiceRecords = async (
  records: z.infer<typeof TenfastInvoicesByExportedResponseSchema>['records'],
  errors: economy.RentalInvoiceExportError[]
): Promise<InvoiceWithAccounting[]> => {
  const invoices: InvoiceWithAccounting[] = []
  for (const invoiceResult of records) {
    const invoice: InvoiceWithAccounting = {
      ...transformToInvoice(invoiceResult).invoice,
      externalId: invoiceResult._id,
      roundoff: invoiceResult.roundingAmount,
      recipientContactCode: invoiceResult.recipientContactCode,
      recipientName: invoiceResult.recipientName,
    }

    if (!invoice.invoiceId) {
      logger.error(
        { externalId: invoice.externalId },
        'Invoice has no ocrNumber'
      )
    }

    await replaceRentalObjectExternalIds(invoice)

    const invoiceRowsWithAccountingResult =
      await enrichInvoiceRowsWithAccounting(invoice)

    if (invoiceRowsWithAccountingResult.errors?.length === 0) {
      invoice.invoiceRows = invoiceRowsWithAccountingResult.invoiceRows
      invoices.push(invoice)
    } else {
      errors.push(...invoiceRowsWithAccountingResult.errors)
    }
  }
  return invoices
}

/**
 * Debug counterpart to getInvoicesNotExported: fetches specific invoices by
 * OCR number regardless of whether they have already been exported. Used by
 * the import-invoices debug endpoint to regenerate accounting files without
 * marking the invoices as exported.
 */
export const getInvoicesByOcr = async (
  ocrNumbers: string[],
  company: MimerCompany
): Promise<
  AdapterResult<
    {
      invoices: InvoiceWithAccounting[]
      errors: economy.RentalInvoiceExportError[] | undefined
    },
    string
  >
> => {
  const errors: economy.RentalInvoiceExportError[] = []

  try {
    const allInvoices: InvoiceWithAccounting[] = []

    for (const ocrNumber of ocrNumbers) {
      const result = await makeTenfastRequest('/v1/hyresvard/hyror', {
        params: {
          status: 'issued',
          hyresvard: company.tenfastId,
          ocrNumber,
        },
      })

      if (result.status !== 200) {
        logger.error(
          { ocrNumber, status: result.status },
          'Error getting invoice from Tenfast by OCR'
        )
        errors.push({
          invoiceNumber: ocrNumber,
          code: 'invoice-fetch-failed',
          error: `Tenfast svarade med status ${result.status}`,
        })
        continue
      }

      const parsedResponse = TenfastInvoicesByExportedResponseSchema.safeParse(
        result.data
      )

      if (!parsedResponse.success) {
        logger.error(
          { error: parsedResponse.error, ocrNumber },
          'Error parsing Tenfast invoice'
        )
        errors.push({
          invoiceNumber: ocrNumber,
          code: 'invoice-fetch-failed',
          error: 'Avin från Tenfast har ett oväntat format',
        })
        continue
      }

      if (parsedResponse.data.records.length === 0) {
        errors.push({
          invoiceNumber: ocrNumber,
          code: 'invoice-not-found',
          error: 'Avin finns inte i Tenfast',
        })
        continue
      }

      allInvoices.push(
        ...(await transformExportedInvoiceRecords(
          parsedResponse.data.records,
          errors
        ))
      )
    }

    return {
      ok: true,
      data: {
        invoices: allInvoices,
        errors,
      },
    }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.message }
  }
}

export const listNewOutboundExports = async (): Promise<
  AdapterResult<TenfastOutboundExport[], 'unknown'>
> => {
  try {
    const records: TenfastOutboundExport[] = []
    let next: string | null = ''
    let totalCount = Infinity

    while (next !== null && records.length < totalCount) {
      const response = await makeTenfastRequest(
        '/v1/hyresvard/outbound-exports',
        {
          params: {
            hyresvard: companyId,
            status: 'NEW',
            provider: 'stralfors',
            ...(next ? { paginate: next } : {}),
          },
        }
      )

      if (response.status !== 200) {
        logger.error(
          { status: response.status },
          'listNewOutboundExports: unexpected status'
        )
        return { ok: false, err: 'unknown' }
      }

      const parsed = TenfastOutboundExportListSchema.safeParse(response.data)
      if (!parsed.success) {
        logger.error(
          { error: parsed.error },
          'listNewOutboundExports: response parse failed'
        )
        return { ok: false, err: 'unknown' }
      }

      records.push(...parsed.data.records)
      next = parsed.data.next
      totalCount = parsed.data.totalCount
    }

    return { ok: true, data: records }
  } catch (err) {
    logger.error({ err }, 'listNewOutboundExports: failed')
    return { ok: false, err: 'unknown' }
  }
}

export const downloadOutboundExport = async (
  exportId: string
): Promise<
  AdapterResult<{ content: Buffer; filename: string }, 'not-found' | 'unknown'>
> => {
  try {
    const response = await makeTenfastRequest(
      `/v1/hyresvard/outbound-exports/${exportId}/download`,
      {
        method: 'POST',
        params: { hyresvard: companyId },
        responseType: 'arraybuffer',
        validateStatus: () => true,
      }
    )

    if (response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    if (response.status !== 200) {
      logger.error(
        { exportId, status: response.status },
        'downloadOutboundExport: download failed'
      )
      return { ok: false, err: 'unknown' }
    }

    return {
      ok: true,
      data: {
        content: Buffer.from(response.data),
        filename:
          response.headers['content-disposition']?.match(
            /filename="?([^";\s]+)"?/
          )?.[1] ?? `${exportId}.xml`,
      },
    }
  } catch (err) {
    logger.error({ err, exportId }, 'downloadOutboundExport: failed')
    return { ok: false, err: 'unknown' }
  }
}

export const markOutboundExportSent = async (
  exportId: string
): Promise<AdapterResult<TenfastOutboundExport, 'not-found' | 'unknown'>> => {
  try {
    const response = await makeTenfastRequest(
      `/v1/hyresvard/outbound-exports/${exportId}/mark-sent`,
      {
        method: 'POST',
        params: { hyresvard: companyId },
        validateStatus: () => true,
      }
    )

    if (response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    if (response.status !== 200) {
      logger.error(
        { exportId, status: response.status },
        'markOutboundExportSent: unexpected status'
      )
      return { ok: false, err: 'unknown' }
    }

    const parsed = TenfastOutboundExportSchema.safeParse(response.data)
    if (!parsed.success) {
      logger.error(
        { exportId, error: parsed.error },
        'markOutboundExportSent: response parse failed'
      )
      return { ok: false, err: 'unknown' }
    }

    return { ok: true, data: parsed.data }
  } catch (err) {
    logger.error({ err, exportId }, 'markOutboundExportSent: failed')
    return { ok: false, err: 'unknown' }
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

const emptyToUndefined = (
  value: string | null | undefined
): string | undefined => (value && value !== '' ? value : undefined)

// Number of days in a closed date interval [from, to] (inclusive on both ends),
// e.g. [2026-07-01, 2026-07-31] = 31.
const daysInclusive = (from: Date, to: Date): number => {
  const ms = to.getTime() - from.getTime()
  if (ms < 0) return 0
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1
}

const roundCurrency = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100

// The part of a rent row that falls within an uncontracted interval, prorated
// by the days the row is valid there. A rent row is only valid between its own
// from and to dates (e.g. an old rent ending and a new one starting with a rent
// change), so rows outside the interval give no rental loss.
const prorateRentRow = (
  hyra: TenfastRentalLossHyra,
  interval: RentalLossInterval,
  daysInMonth: number
):
  | { amount: number; from: Date; to: Date; coversInterval: boolean }
  | undefined => {
  const rowFrom = hyra.from ? new Date(hyra.from) : undefined
  const rowTo = hyra.to ? new Date(hyra.to) : undefined
  const from = rowFrom && rowFrom > interval.from ? rowFrom : interval.from
  const to = rowTo && rowTo < interval.to ? rowTo : interval.to
  const days = daysInclusive(from, to)

  if (days <= 0) return undefined

  return {
    amount: roundCurrency((hyra.amount * days) / daysInMonth),
    from,
    to,
    coversInterval:
      from.getTime() === interval.from.getTime() &&
      to.getTime() === interval.to.getTime(),
  }
}

// Maps one Tenfast rental loss to one RentalLoss per uncontracted interval.
// Tenfast reports every uncontracted interval of the month on a single record;
// downstream accounting (rental blocks, proration, voucher dates) works on a
// single continuous interval, so we split here instead.
//
// calculatedAmount is the rental loss of all rent rows valid in the
// uncontracted intervals, before rows are left out for missing articles or
// rental loss accounts. It is compared with Tenfast's own proration.
export const mapToRentalLoss = async (
  tenfastRentalLoss: TenfastRentalLoss
): Promise<{
  rentalLosses: RentalLoss[]
  errors: RentalLossError[]
  calculatedAmount: number
  calculatedRowCount: number
}> => {
  const errors: RentalLossError[] = []
  const rentalObjectExternalId = tenfastRentalLoss.hyresobjekt.externalId

  const intervals = tenfastRentalLoss.uncontractedIntervals.map((interval) => ({
    from: new Date(interval.from),
    to: new Date(interval.to),
  }))

  if (intervals.length === 0) {
    logger.error(
      { rentalObject: rentalObjectExternalId, month: tenfastRentalLoss.month },
      'Rental loss has no uncontracted intervals'
    )
    errors.push({
      rentalObject: rentalObjectExternalId,
      error: `Hyresbortfallet för ${rentalObjectExternalId} ${tenfastRentalLoss.month} saknar avtalslösa perioder`,
    })

    return {
      rentalLosses: [],
      errors,
      calculatedAmount: 0,
      calculatedRowCount: 0,
    }
  }

  let calculatedAmount = 0
  let calculatedRowCount = 0
  const rentalLossRowsPerInterval: RentalLossRow[][] = intervals.map(() => [])

  for (const hyra of tenfastRentalLoss.hyresobjekt.hyror) {
    const proratedParts = intervals.map((interval) =>
      prorateRentRow(hyra, interval, tenfastRentalLoss.days.month)
    )

    // Not valid during any uncontracted interval, so no rental loss.
    if (proratedParts.every((part) => !part)) continue

    proratedParts.forEach((part) => {
      if (!part) return
      calculatedAmount += part.amount
      calculatedRowCount++
    })

    if (!hyra.article) {
      logger.error(
        { rentalObject: rentalObjectExternalId, label: hyra.label },
        'Rental loss row is missing rent article'
      )
      errors.push({
        rentalObject: rentalObjectExternalId,
        error: `Hyresraden ${hyra.label} saknar hyresartikel`,
      })
      continue
    }

    const articleResult = await getInvoiceArticle(hyra.article)
    if (!articleResult.ok) {
      errors.push({
        rentalObject: rentalObjectExternalId,
        error: `Kunde inte hämta hyresartikel ${hyra.article}`,
      })
      continue
    }

    const article = articleResult.data
    const rentalLossConfigurations =
      article.accountConfigurations?.filter(
        (accountConfiguration) =>
          accountConfiguration.debitType === 'HYRESBORTFALL'
      ) ?? []

    // Only include rows whose article actually has rental loss
    // (HYRESBORTFALL) account configurations.
    if (rentalLossConfigurations.length === 0) {
      continue
    }

    const incomeConfiguration = rentalLossConfigurations.find(
      (accountConfiguration) => accountConfiguration.categoryCode === 'Intäkter'
    )
    const costConfiguration = rentalLossConfigurations.find(
      (accountConfiguration) =>
        accountConfiguration.categoryCode === 'Kostnad/Inköp'
    )

    if (!incomeConfiguration || !costConfiguration) {
      logger.error(
        { article },
        'Rent article is missing rental loss account configuration'
      )
      errors.push({
        rentalObject: rentalObjectExternalId,
        error: `Hyresartikeln ${article.code} saknar konton för hyresbortfall (Intäkter och/eller Kostnad/Inköp)`,
      })
      continue
    }

    const row: Omit<RentalLossRow, 'amount' | 'totalAmount'> = {
      vat: hyra.vat,
      rentArticleName: article.code,
      rentalObject: rentalObjectExternalId,
      incomeAccount: incomeConfiguration.accountNr,
      incomeProjectCode: emptyToUndefined(incomeConfiguration.projectCode),
      incomeProperty: emptyToUndefined(incomeConfiguration.property),
      incomeFreeCode: emptyToUndefined(incomeConfiguration.freeText),
      incomeCostCode: emptyToUndefined(incomeConfiguration.costCenter),
      costAccount: costConfiguration.accountNr,
      costProjectCode: emptyToUndefined(costConfiguration.projectCode),
      costProperty: emptyToUndefined(costConfiguration.property),
      costFreeCode: emptyToUndefined(costConfiguration.freeText),
      costCostCode: emptyToUndefined(costConfiguration.costCenter),
    }

    proratedParts.forEach((part, index) => {
      if (!part) return
      rentalLossRowsPerInterval[index].push({
        ...row,
        amount: part.amount,
        totalAmount: roundCurrency(part.amount * (1 + (row.vat ?? 0))),
        // A row valid during only part of the interval keeps its own dates.
        ...(part.coversInterval
          ? {}
          : { fromDate: part.from, toDate: part.to }),
      })
    })
  }

  const rentalLosses = intervals.map((uncontractedInterval, index) => ({
    rentalLossRows: rentalLossRowsPerInterval[index],
    rentalObject: rentalObjectExternalId,
    month: tenfastRentalLoss.month,
    days: {
      totalInMonth: tenfastRentalLoss.days.month,
      contracted: tenfastRentalLoss.days.contracted,
      uncontracted: daysInclusive(
        uncontractedInterval.from,
        uncontractedInterval.to
      ),
    },
    uncontractedInterval,
  }))

  return {
    rentalLosses,
    errors,
    calculatedAmount: roundCurrency(calculatedAmount),
    calculatedRowCount,
  }
}

// Compares our calculated rental loss with Tenfast's own proration of the same
// rent rows. Each prorated part is rounded to öre on both sides, so allow one
// öre per part. Reports without proration (older report versions) are not
// checked.
export const checkRentalLossAgainstTenfast = (
  tenfastRentalLoss: TenfastRentalLoss,
  calculatedAmount: number,
  calculatedRowCount: number
): RentalLossChecksumMismatch | undefined => {
  const tenfastRows = tenfastRentalLoss.proration?.hyraRows
  if (!tenfastRows) return undefined

  const tenfastAmount = roundCurrency(
    tenfastRows.reduce((sum, hyra) => sum + hyra.amount, 0)
  )
  const diff = roundCurrency(calculatedAmount - tenfastAmount)
  const tolerance =
    0.01 * Math.max(1, calculatedRowCount, tenfastRows.length) + Number.EPSILON

  if (Math.abs(diff) <= tolerance) return undefined

  return {
    rentalObject: tenfastRentalLoss.hyresobjekt.externalId,
    month: tenfastRentalLoss.month,
    calculatedAmount,
    tenfastAmount,
    diff,
  }
}

export const getRentalLosses = async (
  company: MimerCompany,
  reportId: string
): Promise<
  AdapterResult<
    {
      rentalLosses: RentalLoss[]
      errors: RentalLossError[]
      // External ids of uncontracted rental objects that have no rent rows
      // in Tenfast, so there is no rental loss to account for.
      rentalObjectsWithoutRentRows: string[]
      // Rental objects where our calculated rental loss differs from
      // Tenfast's proration. Reported only, they are still accounted.
      checksumMismatches: RentalLossChecksumMismatch[]
    },
    string
  >
> => {
  const result = await makeTenfastRequest(
    `/v1/hyresvard/reports/${encodeURIComponent(reportId)}/download`,
    {
      params: {
        hyresvard: company.tenfastId,
        /*paginate:
        'eyJpZCI6IjY5ZDZmNDQ0MGM4NGU2YzRjMDRmNGU5MyIsImlzTmV4dCI6dHJ1ZX0',*/
        //ocrNumber: '552606000000733',
      },
    }
  )

  if (result.status !== 200) {
    logger.error(
      { error: result.statusText },
      'Error getting invoices from Tenfast'
    )
    return { ok: false, err: result.statusText }
  }

  const parsedResponse = TenfastRentalLossResponseSchema.safeParse(result.data)

  if (parsedResponse.error) {
    logger.error({ error: parsedResponse.error }, 'Could not parse rental loss')
    return { ok: false, err: 'schema-error' }
  }

  logger.info(
    { hyresvard: company.tenfastId, count: parsedResponse.data.length },
    'Got rental loss report from Tenfast'
  )

  const rentalLosses: RentalLoss[] = []
  const errors: RentalLossError[] = []
  const rentalObjectsWithoutRentRows: string[] = []
  const checksumMismatches: RentalLossChecksumMismatch[] = []

  const rentalLossResults = parsedResponse.data.filter((rentalLoss) => {
    return rentalLoss.days.uncontracted > 0
  })

  if (rentalLossResults.length === 0) {
    logger.info(
      { hyresvard: company.tenfastId },
      'No rental objects with uncontracted days returned from Tenfast'
    )
    return {
      ok: true,
      data: {
        rentalLosses: [],
        errors: [],
        rentalObjectsWithoutRentRows: [],
        checksumMismatches: [],
      },
    }
  }

  logger.info(
    { hyresvard: company.tenfastId, count: rentalLossResults.length },
    'Rental losses to process'
  )

  for (const tenfastRentalLoss of rentalLossResults) {
    if (tenfastRentalLoss.hyresobjekt.hyror.length === 0) {
      rentalObjectsWithoutRentRows.push(
        tenfastRentalLoss.hyresobjekt.externalId
      )
      continue
    }

    const {
      rentalLosses: mappedRentalLosses,
      errors: rentalLossErrors,
      calculatedAmount,
      calculatedRowCount,
    } = await mapToRentalLoss(tenfastRentalLoss)
    rentalLosses.push(...mappedRentalLosses)
    errors.push(...rentalLossErrors)

    const mismatch = checkRentalLossAgainstTenfast(
      tenfastRentalLoss,
      calculatedAmount,
      calculatedRowCount
    )
    if (mismatch) checksumMismatches.push(mismatch)
  }

  if (checksumMismatches.length > 0) {
    logger.warn(
      { hyresvard: company.tenfastId, checksumMismatches },
      'Calculated rental loss differs from Tenfast proration'
    )
  }

  if (rentalObjectsWithoutRentRows.length > 0) {
    logger.warn(
      {
        hyresvard: company.tenfastId,
        count: rentalObjectsWithoutRentRows.length,
      },
      'Uncontracted rental objects without rent rows'
    )
  }

  logger.info(
    {
      hyresvard: company.tenfastId,
      count: rentalLosses.length,
      errors: errors.length,
    },
    'Rental losses processed'
  )

  return {
    ok: true,
    data: {
      rentalLosses,
      errors,
      rentalObjectsWithoutRentRows,
      checksumMismatches,
    },
  }
}

/**
 * Marks each invoice as exported in Tenfast. Keeps going when a single
 * invoice fails, since the accounting files have already been uploaded:
 * stopping would leave the rest unmarked and they would be exported again.
 * Returns the invoices that could not be marked so they can be handled
 * manually.
 */
export const markInvoicesAsExported = async (
  invoices: Invoice[]
): Promise<economy.MarkInvoiceAsExportedFailure[]> => {
  const failures: economy.MarkInvoiceAsExportedFailure[] = []

  for (const invoice of invoices) {
    if (!invoice.externalId) {
      logger.error(
        { invoiceNumber: invoice.invoiceId },
        'tenfast-adapter.markInvoicesAsExported: invoice has no external id'
      )
      failures.push({
        invoiceNumber: invoice.invoiceId,
        error: 'missing-external-id',
      })
      continue
    }

    try {
      const response = await makeTenfastRequest(
        `/v1/hyresvard/hyror/${invoice.externalId}/manual-export`,
        { method: 'POST', validateStatus: () => true }
      )

      if (response.status < 200 || response.status >= 300) {
        logger.error(
          { invoiceNumber: invoice.invoiceId, status: response.status },
          'tenfast-adapter.markInvoicesAsExported'
        )
        failures.push({
          invoiceNumber: invoice.invoiceId,
          error: 'request-failed',
          status: response.status,
        })
      }
    } catch (err: unknown) {
      logger.error(
        {
          invoiceNumber: invoice.invoiceId,
          error: errorMessage(err),
        },
        'tenfast-adapter.markInvoicesAsExported'
      )
      failures.push({
        invoiceNumber: invoice.invoiceId,
        error: 'request-failed',
      })
    }
  }

  return failures
}
export type { TenfastOutboundExport }
