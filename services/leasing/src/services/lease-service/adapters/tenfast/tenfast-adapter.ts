import { logger } from '@onecore/utilities'
import {
  Contact,
  RentalObjectAvailabilityInfo,
  SyncContactToLeasingPayload,
} from '@onecore/types'
import { isAxiosError } from 'axios'
import z from 'zod'

import {
  TenfastTenant,
  TenfastRentalObject,
  TenfastRentalObjectByRentalObjectCodeResponseSchema,
  TenfastLeaseTemplate,
  TenfastLeaseTemplateSchema,
  TenfastTenantSchema,
  PreliminaryTerminationResponse,
  TenfastLease,
  TenfastLeaseSchema,
  TenfastInvoiceRow,
  TenfastRentalObjectSchema,
  TenfastLeaseTemplateResponseSchema,
  TenfastLeasesByArticleResponseSchema,
  TenfastTagSchema,
  TenfastTag,
} from './schemas'
import config from '../../../../common/config'
import { AdapterResult } from '../../adapters/types'
import * as tenfastApi from './tenfast-api'
import { filterByStatus, GetLeasesFilters } from './filters'
import { mapTenfastRentalObjectToAvailabilityInfo } from './tenfast-rental-object-helpers'
import { RelatedContact } from '@onecore/types/src/schemas/v1/contact-sync'

const tenfastBaseUrl = config.tenfast.baseUrl
const tenfastCompanyId = config.tenfast.companyId

type SchemaError = { tag: 'schema-error'; error: z.ZodError }

/**
 * Fetches all pages from a paginated Tenfast endpoint.
 *
 * @param buildUrl - Called with the current page cursor on each iteration.
 *                   Pass an empty string for the first page.
 * @param schema   - Zod schema for the paginated response. Must have
 *                   `records`, `next`, and `totalCount` fields.
 * @returns        - All records across all pages combined, typed as the
 *                   schema's own output type (preserving branded strings etc.)
 * @throws         - On non-200/201 responses or schema parse failures.
 */
const fetchAllPages = async <
  S extends z.ZodType<{
    records: unknown[]
    next: string | null
    totalCount: number
  }>,
>(
  buildUrl: (paginate: string) => string,
  schema: S
): Promise<z.output<S>['records']> => {
  let next: string | null = ''
  let totalCount = Infinity
  let records: z.output<S>['records'] = []

  while (next !== null && records.length < totalCount) {
    const response = await tenfastApi.request({
      method: 'get',
      url: buildUrl(next),
    })

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(
        `Tenfast responded with status ${response.status}: ${JSON.stringify(response.data)}`
      )
    }

    const parsed = schema.safeParse(response.data)
    if (!parsed.success) throw parsed.error

    records.push(...parsed.data.records)
    next = parsed.data.next
    totalCount = parsed.data.totalCount
  }

  return records
}

export const createLease = async (
  contact: Contact,
  rentalObjectCode: string,
  fromDate: Date,
  includeVAT: boolean
): Promise<
  AdapterResult<
    any,
    | 'could-not-find-template'
    | 'rental-object-has-no-template'
    | 'could-not-retrieve-tenant'
    | 'could-not-create-tenant'
    | 'could-not-find-rental-object'
    | 'lease-could-not-be-created'
    | 'create-lease-bad-request'
    | 'rent-article-is-missing'
    | 'unknown'
  >
> => {
  const tenantResult = await getOrCreateTenant(
    contact.contactCode,
    buildTenantRequestData(contact)
  )
  if (!tenantResult.ok) return { ok: false, err: tenantResult.err }
  else if (!tenantResult.data)
    return { ok: false, err: 'could-not-retrieve-tenant' }

  const rentalObjectResponse = await getRentalObject(rentalObjectCode)
  if (!rentalObjectResponse.ok || !rentalObjectResponse.data)
    return { ok: false, err: 'could-not-find-rental-object' }
  if (
    !rentalObjectResponse.data.hyror ||
    rentalObjectResponse.data.hyror.length === 0
  )
    return { ok: false, err: 'rent-article-is-missing' }
  if (!rentalObjectResponse.data.contractTemplate)
    return { ok: false, err: 'rental-object-has-no-template' }

  const templateResponse = await getLeaseTemplate(
    rentalObjectResponse.data.contractTemplate
  )
  if (!templateResponse.ok || !templateResponse.data)
    return { ok: false, err: 'could-not-find-template' }

  try {
    const createLeaseRequestData = buildLeaseRequestData(
      tenantResult.data,
      rentalObjectResponse.data,
      templateResponse.data,
      fromDate,
      includeVAT
    )

    const leaseResponse = await tenfastApi.request({
      method: 'post',
      url: `${tenfastBaseUrl}/v1/hyresvard/avtal?hyresvard=${tenfastCompanyId}`,
      data: createLeaseRequestData,
    })
    if (leaseResponse.status === 400)
      return handleTenfastError(
        leaseResponse.data.error,
        'create-lease-bad-request'
      )
    else if (leaseResponse.status !== 200 && leaseResponse.status !== 201)
      return handleTenfastError(
        { error: leaseResponse.data.error, status: leaseResponse.status },
        'lease-could-not-be-created'
      )

    //TODO: create schema for response and convert to onecore lease type here later
    return { ok: true, data: undefined }
  } catch (err) {
    const responseData = isAxiosError(err) ? err.response?.data : undefined
    logger.error(
      { err, responseData },
      'tenfast-adapter.createLease: caught exception'
    )
    return handleTenfastError(err, 'lease-could-not-be-created')
  }
}

/**
 * Creates a Tenfast lease as an externally-signed import — no template, no
 * generated PDF, no rent rows. The lease is linked to a Tenfast rental
 * object and tenant; Tenfast derives rent from the rental object's own
 * configuration. Used by the xpand → Tenfast sync flow on `Undertecknat`
 * cmlog events. The signed PDF from xpand should be attached separately via
 * `POST /v1/hyresvard/avtal/{id}/upload-file`.
 */
export const importLease = async (
  leaseId: string,
  contact: SyncContactToLeasingPayload,
  rentalObjectCode: string,
  fromDate: Date
): Promise<
  AdapterResult<
    { _id: string },
    | 'could-not-retrieve-tenant'
    | 'could-not-create-tenant'
    | 'could-not-find-rental-object'
    | 'lease-could-not-be-created'
    | 'unknown'
  >
> => {
  try {
    logger.info(
      { leaseId, contactCode: contact.contactCode, rentalObjectCode },
      'tenfast-adapter.importLease: starting import'
    )
    const tenantResult = await getOrCreateTenant(
      contact.contactCode,
      buildTenantRequestDataFromPayload(contact)
    )
    if (!tenantResult.ok) return { ok: false, err: tenantResult.err }
    if (!tenantResult.data)
      return { ok: false, err: 'could-not-retrieve-tenant' }

    const rentalObjectResponse = await getRentalObject(rentalObjectCode)
    if (!rentalObjectResponse.ok || !rentalObjectResponse.data)
      return { ok: false, err: 'could-not-find-rental-object' }
    const rentalObject = rentalObjectResponse.data
    const body = {
      // Pass the xpand leaseId as externalId so terminate/void can later look
      // up this lease via GET /extras/avtal/{externalId} (see
      // getLeaseByExternalId, used by terminateLease and voidLease).
      externalId: leaseId,
      hyresgaster: [tenantResult.data._id],
      hyresobjekt: [rentalObject._id],
      startDate: fromDate.toISOString(),
      avtalsbyggare: false,
      aviseringsFrekvens: '1m',
      forskottAvisering: '2v',
      betalningsOffset: '1d',
      betalasForskott: true,
      // this might be changed later to just pass entire rentalObject.hyror
      hyror: (rentalObject.hyror ?? []).map(({ _id, ...rest }) => ({
        ...rest,
        hyresobjekt: rentalObject._id,
      })),
      method: 'import',
      signed: true,
    }

    const response = await tenfastApi.request({
      method: 'post',
      url: `${tenfastBaseUrl}/v1/hyresvard/avtal?hyresvard=${tenfastCompanyId}`,
      data: body,
    })

    if (response.status === 200 || response.status === 201) {
      return { ok: true, data: { _id: response.data?._id } }
    }

    logger.error(
      { status: response.status, error: response.data },
      'tenfast-adapter.importLease'
    )
    return { ok: false, err: 'lease-could-not-be-created' }
  } catch (err) {
    const responseData = isAxiosError(err) ? err.response?.data : undefined
    const requestUrl = isAxiosError(err) ? err.config?.url : undefined
    logger.error(
      { err, requestUrl, responseData },
      'tenfast-adapter.importLease: caught exception'
    )
    return { ok: false, err: 'unknown' }
  }
}

/**
 * Uploads a PDF as the main contract document for an existing Tenfast lease.
 *
 * Posts multipart/form-data to POST /v1/hyresvard/avtal/{id}/upload-file. The
 * `tenfastApi.request` wrapper doesn't handle multipart, so we use native
 * fetch + FormData here, replicating the api-token header.
 */
export const uploadLeaseFile = async (
  tenfastLeaseId: string,
  content: Buffer,
  filename: string
): Promise<AdapterResult<undefined, 'upload-failed' | 'unknown'>> => {
  try {
    // Native FormData/fetch are stable in Node 20 despite the experimental flag.
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const form = new FormData()
    form.append(
      'file',
      new Blob([content], { type: 'application/pdf' }),
      filename
    )

    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const response = await fetch(
      `${tenfastBaseUrl}/v1/hyresvard/avtal/${tenfastLeaseId}/upload-file?hyresvard=${tenfastCompanyId}`,
      {
        method: 'POST',
        headers: { 'api-token': config.tenfast.apiKey },
        body: form,
      }
    )

    if (response.ok) {
      return { ok: true, data: undefined }
    }

    const errorBody = await response.text()
    logger.error(
      { status: response.status, error: errorBody, tenfastLeaseId },
      'tenfast-adapter.uploadLeaseFile'
    )
    return { ok: false, err: 'upload-failed' }
  } catch (err) {
    logger.error(
      { err, tenfastLeaseId },
      'tenfast-adapter.uploadLeaseFile: caught exception'
    )
    return { ok: false, err: 'unknown' }
  }
}

export const getLeases = async (): Promise<
  AdapterResult<
    Array<TenfastLease>,
    'unknown' | 'bad-request' | 'not-found' | 'parsing-error'
  >
> => {
  try {
    const leaseResponse = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/avtal?populate=hyresobjekt,hyresgaster&limit=100000`,
    })

    if (leaseResponse.status === 400)
      return handleTenfastError(leaseResponse.data.error, 'bad-request')
    else if (leaseResponse.status !== 200 && leaseResponse.status !== 201)
      return handleTenfastError(
        {
          error: leaseResponse.data.error,
          status: leaseResponse.status,
        },
        'not-found'
      )

    const parsedLeaseResponse = TenfastLeaseTemplateResponseSchema.safeParse(
      leaseResponse.data
    )

    if (!parsedLeaseResponse.success)
      return handleTenfastError(parsedLeaseResponse.error, 'parsing-error')
    return {
      ok: true,
      data: parsedLeaseResponse.data.records,
    }
  } catch (err: any) {
    return handleTenfastError(err, 'unknown')
  }
}

export const getRentalObject = async (
  rentalObjectCode: string
): Promise<
  AdapterResult<
    TenfastRentalObject | null,
    'could-not-find-rental-object' | 'could-not-parse-rental-object'
  >
> => {
  try {
    const rentalObjectResponse = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/extras/hyresobjekt/${encodeURIComponent(rentalObjectCode)}?hyresvard=${tenfastCompanyId}`,
    })

    if (rentalObjectResponse.status === 404) return { ok: true, data: null }

    if (rentalObjectResponse.status !== 200)
      return handleTenfastError(
        {
          error: rentalObjectResponse.data.error,
          status: rentalObjectResponse.status,
        },
        'could-not-find-rental-object'
      )

    const parsed = TenfastRentalObjectSchema.safeParse(
      rentalObjectResponse.data
    )
    if (!parsed.success)
      return handleTenfastError(parsed.error, 'could-not-parse-rental-object')

    return { ok: true, data: parsed.data }
  } catch (err: any) {
    return handleTenfastError(err, 'could-not-find-rental-object')
  }
}

export enum RentalObjectType {
  ParkingSpace = 'parkering',
  Apartment = 'lägenhet',
  Storage = 'förråd',
}

const TAGS_CACHE_TTL_MS = 5 * 60 * 1000
let tagsCache: Promise<Map<string, TenfastTag>> | null = null
let tagsCachedAt = 0

const getTags = (): Promise<Map<string, TenfastTag>> => {
  if (tagsCache && Date.now() - tagsCachedAt < TAGS_CACHE_TTL_MS) {
    return tagsCache
  }
  tagsCachedAt = Date.now()
  tagsCache = (async () => {
    try {
      const res = await tenfastApi.request({
        method: 'get',
        url: `${tenfastBaseUrl}/v1/hyresvard/tags?hyresvard=${tenfastCompanyId}`,
      })
      if (res.status !== 200) {
        tagsCache = null
        tagsCachedAt = 0
        return new Map()
      }
      const tags = z.array(TenfastTagSchema).safeParse(res.data)
      if (!tags.success) {
        tagsCache = null
        tagsCachedAt = 0
        return new Map()
      }
      return new Map(tags.data.map((t) => [t._id, t]))
    } catch (err) {
      logger.error(
        { err: JSON.stringify(err) },
        'Failed to fetch tags from Tenfast '
      )
      tagsCache = null
      tagsCachedAt = 0
      return new Map()
    }
  })()
  return tagsCache
}

export const getAvailabilityForVacantRentalObjects = async (
  type: RentalObjectType
): Promise<
  AdapterResult<
    RentalObjectAvailabilityInfo[] | null,
    | 'could-not-find-rental-object'
    | 'could-not-parse-rental-object'
    | 'get-rental-object-bad-request'
  >
> => {
  try {
    const tagsById = await getTags()

    let page = ''
    let allRecords: any[] = []
    let totalCount = 0
    let first = true

    do {
      const rentalObjectResponse = await tenfastApi.request({
        method: 'get',
        url: `${tenfastBaseUrl}/v1/hyresvard/hyresobjekt?hyresvard=${tenfastCompanyId}&states=vacant,soon-vacant&typ=${type}&includeAvtal=true&paginate=${page}`,
      })
      if (rentalObjectResponse.status === 400)
        return handleTenfastError(
          rentalObjectResponse.data.error,
          'get-rental-object-bad-request'
        )
      else if (
        rentalObjectResponse.status !== 200 &&
        rentalObjectResponse.status !== 201
      )
        return handleTenfastError(
          {
            error: rentalObjectResponse.data.error,
            status: rentalObjectResponse.status,
          },
          'could-not-find-rental-object'
        )

      const parsedRentalObjectResponse =
        TenfastRentalObjectByRentalObjectCodeResponseSchema.safeParse(
          rentalObjectResponse.data
        )
      if (!parsedRentalObjectResponse.success)
        return handleTenfastError(
          parsedRentalObjectResponse.error,
          'could-not-parse-rental-object'
        )

      if (first) {
        totalCount = parsedRentalObjectResponse.data.totalCount || 0
        first = false
      }
      allRecords = allRecords.concat(parsedRentalObjectResponse.data.records)
      page = parsedRentalObjectResponse.data.next ?? ''
    } while (allRecords.length < totalCount)

    const recordsWithoutUpcomingLeases = allRecords.filter(
      (record) => filterByStatus(record.avtal ?? [], ['upcoming']).length === 0
    )

    return {
      ok: true,
      data: recordsWithoutUpcomingLeases.map((record) =>
        mapTenfastRentalObjectToAvailabilityInfo(false, record, tagsById)
      ),
    }
  } catch (err: any) {
    return handleTenfastError(err, 'could-not-find-rental-object')
  }
}

export const getAvailabilityForRentalObject = async (
  rentalObjectCode: string,
  includeVAT: boolean
): Promise<
  AdapterResult<
    RentalObjectAvailabilityInfo,
    'could-not-find-rental-object' | 'could-not-parse-rental-object'
  >
> => {
  const [rentalObjectResult, tagsById] = await Promise.all([
    getRentalObject(rentalObjectCode),
    getTags(),
  ])

  if (!rentalObjectResult.ok) {
    return {
      ok: false,
      err: rentalObjectResult.err,
    }
  }

  if (!rentalObjectResult.data) {
    return {
      ok: false,
      err: 'could-not-find-rental-object',
    }
  }

  const availability: RentalObjectAvailabilityInfo =
    mapTenfastRentalObjectToAvailabilityInfo(
      includeVAT,
      rentalObjectResult.data,
      tagsById
    )

  return {
    ok: true,
    data: availability,
  }
}

export const getRentalObjectAvailabilityInfo = async (
  rentalObjectCodes: Array<string>,
  includeVAT: boolean
): Promise<
  AdapterResult<
    Array<RentalObjectAvailabilityInfo>,
    | 'could-not-find-rental-objects'
    | 'could-not-parse-rental-objects'
    | 'get-rental-objects-bad-request'
    | 'unknown'
  >
> => {
  try {
    const tagsById = await getTags()

    const batchSize = 500
    const batches: Array<Array<string>> = []
    for (let i = 0; i < rentalObjectCodes.length; i += batchSize) {
      batches.push(rentalObjectCodes.slice(i, i + batchSize))
    }

    let allParsedRentalObjects: RentalObjectAvailabilityInfo[] = []

    for (const batch of batches) {
      const rentalObjectResponse = await tenfastApi.request({
        method: 'post',
        url: `${tenfastBaseUrl}/v1/hyresvard/extras/hyresobjekt/batch-get?hyresvard=${tenfastCompanyId}&includeAvtal=signed`,
        data: {
          externalIds: batch,
        },
      })

      if (rentalObjectResponse.status === 400)
        return handleTenfastError(
          rentalObjectResponse.data.error,
          'get-rental-objects-bad-request'
        )
      else if (
        rentalObjectResponse.status !== 200 &&
        rentalObjectResponse.status !== 201
      )
        return handleTenfastError(
          {
            error: rentalObjectResponse.data.error,
            status: rentalObjectResponse.status,
          },
          'could-not-find-rental-objects'
        )

      const parsedRentalObjects = rentalObjectResponse.data.map(
        (rentalObjectData: any) => {
          const parsedRentalObject =
            TenfastRentalObjectSchema.safeParse(rentalObjectData)
          if (!parsedRentalObject.success) throw parsedRentalObject.error

          return mapTenfastRentalObjectToAvailabilityInfo(
            includeVAT,
            parsedRentalObject.data,
            tagsById
          )
        }
      )
      allParsedRentalObjects =
        allParsedRentalObjects.concat(parsedRentalObjects)
    }

    return {
      ok: true,
      data: allParsedRentalObjects,
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return handleTenfastError(err, 'could-not-parse-rental-objects')
    }

    return handleTenfastError(err, 'unknown')
  }
}

export const getLeaseTemplate = async (
  templateId: string
): Promise<
  AdapterResult<
    TenfastLeaseTemplate | undefined,
    | 'could-not-get-template'
    | 'get-template-bad-request'
    | 'response-could-not-be-parsed'
    | 'unknown'
  >
> => {
  try {
    const templateResponse = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/avtalsmallar/${templateId}`,
    })

    if (templateResponse.status === 400)
      return handleTenfastError(
        templateResponse.data.error,
        'get-template-bad-request'
      )
    else if (templateResponse.status !== 200)
      return handleTenfastError(
        {
          error: templateResponse.data.error,
          status: templateResponse.status,
        },
        'could-not-get-template'
      )

    const parsedTemplateResponse = TenfastLeaseTemplateSchema.safeParse(
      templateResponse.data
    )
    if (!parsedTemplateResponse.success)
      return handleTenfastError(
        parsedTemplateResponse.error,
        'response-could-not-be-parsed'
      )
    return { ok: true, data: parsedTemplateResponse.data ?? undefined }
  } catch (err: any) {
    return handleTenfastError(err, 'unknown')
  }
}

export const getTenantByContactCode = async (
  contactCode: string
): Promise<
  AdapterResult<
    TenfastTenant | null,
    'could-not-retrieve-tenant' | 'could-not-parse-tenant-response'
  >
> => {
  try {
    const tenantResponse = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/extras/hyresgaster/${encodeURIComponent(contactCode)}?hyresvard=${tenfastCompanyId}`,
    })

    if (tenantResponse.status === 404) return { ok: true, data: null }

    if (tenantResponse.status !== 200)
      return handleTenfastError(
        {
          error: tenantResponse.data.error,
          status: tenantResponse.status,
        },
        'could-not-retrieve-tenant'
      )

    const parsed = TenfastTenantSchema.safeParse(tenantResponse.data)
    if (!parsed.success)
      return handleTenfastError(parsed.error, 'could-not-parse-tenant-response')

    return { ok: true, data: parsed.data }
  } catch (err: any) {
    return handleTenfastError(err, 'could-not-retrieve-tenant')
  }
}

const createTenantRequest = async (
  requestData: object
): Promise<
  AdapterResult<
    TenfastTenant | undefined,
    | 'tenant-could-not-be-created'
    | 'tenant-could-not-be-parsed'
    | 'create-tenant-bad-request'
  >
> => {
  const tenantResponse = await tenfastApi.request({
    method: 'post',
    url: `${tenfastBaseUrl}/v1/hyresvard/hyresgaster?hyresvard=${tenfastCompanyId}`,
    data: requestData,
  })

  if (tenantResponse.status === 400)
    return handleTenfastError(
      tenantResponse.data.error,
      'create-tenant-bad-request'
    )
  else if (tenantResponse.status !== 200 && tenantResponse.status !== 201)
    return handleTenfastError(
      {
        error: tenantResponse.data.error,
        status: tenantResponse.status,
      },
      'tenant-could-not-be-created'
    )

  const parsedTenantResponse = TenfastTenantSchema.safeParse(
    tenantResponse.data
  )
  if (!parsedTenantResponse.success)
    return handleTenfastError(
      parsedTenantResponse.error,
      'tenant-could-not-be-parsed'
    )

  return { ok: true, data: parsedTenantResponse.data ?? undefined }
}

export const createTenant = (contact: Contact) =>
  createTenantRequest(buildTenantRequestData(contact))

async function getOrCreateTenant(
  contactCode: string,
  requestData: object
): Promise<
  AdapterResult<
    TenfastTenant,
    'could-not-retrieve-tenant' | 'could-not-create-tenant'
  >
> {
  const tenantResponse = await getTenantByContactCode(contactCode)
  if (!tenantResponse.ok) {
    return { ok: false, err: 'could-not-retrieve-tenant' }
  }
  if (!tenantResponse.data) {
    const createTenantResult = await createTenantRequest(requestData)
    if (!createTenantResult.ok || !createTenantResult.data) {
      return { ok: false, err: 'could-not-create-tenant' }
    }
    return { ok: true, data: createTenantResult.data }
  }
  return { ok: true, data: tenantResponse.data }
}

function handleTenfastError<E extends string>(errorObj: any, errorLiteral: E) {
  logger.error({ err: JSON.stringify(errorObj) }, errorLiteral)
  return { ok: false, err: errorLiteral } as const
}

function buildLeaseRequestData(
  tenant: TenfastTenant,
  rentalObject: TenfastRentalObject,
  template: TenfastLeaseTemplate,
  fromDate: Date,
  includeVAT: boolean
) {
  let vat = 0
  if (includeVAT) {
    vat = 0.25
  }

  return {
    hyresgaster: [tenant?._id],
    hyresobjekt: [rentalObject._id],
    avtalsbyggare: true,
    hyror: (rentalObject.hyror ?? []).map((hyra) => {
      hyra.vat = vat //set vat according to includeVAT for all rent articles
      return hyra
    }),
    startDate: fromDate.toISOString(),
    aviseringsTyp: 'none',
    uppsagningstid: '3m',
    aviseringsFrekvens: '1m',
    forskottAvisering: '2v', //specifies how far in advance the rent invoice should be created
    betalningsOffset: '1d', //specifies the due date for the rent in relation to the start date of the rental period
    betalasForskott: true, //specifies whether the rent should be paid in advance or arrears
    vatEnabled: includeVAT,
    originalTemplate: template._id,
    template: template,
    method: 'simplesign',
  }
}

function buildTenantRequestData(contact: Contact) {
  return {
    externalId: contact.contactCode,
    idbeteckning: contact.nationalRegistrationNumber, // orgNr for companies when that is implemented
    // company: contact.company, //doesn't exist on contact yet
    // firmatecknare: contact.firmatecknare, //doesn't exist on contact yet
    isCompany: false,
    name: {
      first: contact.firstName ?? '',
      last: contact.lastName ?? '',
    },
    email: contact.emailAddress,
    phone: contact.phoneNumbers?.find(
      (p: { isMainNumber: any }) => p.isMainNumber
    )?.phoneNumber,
    postadress: `${contact.address?.street} ${contact.address?.number}`,
    postnummer: contact.address?.postalCode,
    stad: contact.address?.city,
  }
}

function buildTenantRequestDataFromPayload(
  payload: SyncContactToLeasingPayload
) {
  return {
    externalId: payload.contactCode,
    idbeteckning: payload.nationalRegistrationNumber ?? '',
    isCompany: false,
    name: {
      first: payload.firstName ?? '',
      last: payload.lastName ?? '',
    },
    email: payload.emailAddress ?? '',
    phone: payload.phoneNumber ?? '',
    postadress: payload.street ?? '',
    postnummer: payload.zipCode ?? '',
    stad: payload.city ?? '',
  }
}

function buildPatchTenantRequestDataFromPayload(
  payload: SyncContactToLeasingPayload
) {
  /*
    The trustee (god man) and administrator (förvaltare) roles are both represented by the trustee property in Tenfast.
    The trustee.godMan flag indicates which role, where true means it is a trustee, and false means it is an administrator.
  */
  let trusteeOrAdministrator:
    | { contact: RelatedContact; isTrustee: boolean }
    | undefined = undefined

  if (payload.trustee) {
    trusteeOrAdministrator = {
      contact: payload.trustee,
      isTrustee: true,
    }
  } else if (payload.administrator) {
    trusteeOrAdministrator = {
      contact: payload.administrator,
      isTrustee: false,
    }
  }

  return {
    externalId: payload.contactCode,
    idbeteckning: payload.nationalRegistrationNumber,
    isCompany: false,
    name: {
      first: payload.firstName,
      last: payload.lastName,
    },
    email: payload.emailAddress,
    phone: payload.phoneNumber,
    postadress: payload.street,
    postnummer: payload.zipCode,
    stad: payload.city,
    trustee: trusteeOrAdministrator
      ? {
          name: trusteeOrAdministrator.contact.name,
          idbeteckning:
            trusteeOrAdministrator.contact.nationalRegistrationNumber,
          email: trusteeOrAdministrator.contact.email,
          phone: trusteeOrAdministrator.contact.phone,
          postadress: trusteeOrAdministrator.contact.address,
          postnummer: trusteeOrAdministrator.contact.zipCode,
          godMan: trusteeOrAdministrator.isTrustee,
        }
      : undefined,
    fakturaMottagare: payload.invoiceRecipient
      ? {
          name: payload.invoiceRecipient.name,
          idbeteckning: payload.invoiceRecipient.nationalRegistrationNumber,
          email: payload.invoiceRecipient.email,
          phone: payload.invoiceRecipient.phone,
          postadress: payload.invoiceRecipient.address,
          postnummer: payload.invoiceRecipient.zipCode,
        }
      : undefined,
  }
}

export const syncTenant = async (
  payload: SyncContactToLeasingPayload
): Promise<
  AdapterResult<
    TenfastTenant | null,
    | 'could-not-retrieve-tenant'
    | 'could-not-update-tenant'
    | 'tenant-could-not-be-parsed'
    | 'unknown'
  >
> => {
  try {
    const existingTenant = await getTenantByContactCode(payload.contactCode)

    if (!existingTenant.ok) {
      return { ok: false, err: 'could-not-retrieve-tenant' }
    }

    if (!existingTenant.data) {
      logger.warn(
        { contactCode: payload.contactCode },
        'tenfast-adapter.syncTenant: tenant not found in Tenfast, skipping'
      )
      return { ok: true, data: null }
    }

    const requestData = buildPatchTenantRequestDataFromPayload(payload)

    const tenantResponse = await tenfastApi.request({
      method: 'patch',
      url: `${tenfastBaseUrl}/v1/hyresvard/hyresgaster/${existingTenant.data._id}?hyresvard=${tenfastCompanyId}`,
      data: requestData,
    })

    if (tenantResponse.status !== 200 && tenantResponse.status !== 201) {
      return handleTenfastError(
        { error: tenantResponse.data.error, status: tenantResponse.status },
        'could-not-update-tenant'
      )
    }

    const parsed = TenfastTenantSchema.safeParse(tenantResponse.data)
    if (!parsed.success)
      return handleTenfastError(parsed.error, 'tenant-could-not-be-parsed')
    return { ok: true, data: parsed.data }
  } catch (err: unknown) {
    return handleTenfastError(err, 'unknown')
  }
}

export const preliminaryTerminateLease = async (
  leaseId: string,
  contactCode: string,
  lastDebitDate: Date,
  desiredMoveDate: Date
): Promise<
  AdapterResult<
    PreliminaryTerminationResponse,
    | 'lease-not-found'
    | 'tenant-email-missing'
    | 'termination-not-required'
    | 'termination-failed'
    | 'unknown'
  >
> => {
  try {
    // Get the lease from tenfast using our leaseId (externalId)
    const leaseResponse = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/extras/avtal/${encodeURIComponent(leaseId)}?hyresvard=${tenfastCompanyId}`,
    })

    if (leaseResponse.status === 404) {
      logger.error({ leaseId }, 'Lease not found in tenfast')
      return { ok: false, err: 'lease-not-found' }
    }

    if (leaseResponse.status !== 200) {
      logger.error(
        { leaseId, status: leaseResponse.status },
        'Failed to retrieve lease from tenfast'
      )
      return { ok: false, err: 'termination-failed' }
    }
    // TODO: Handle error when email is missing in Tenfast, when this is implemented in Tenfast API

    const tenfastLeaseId = leaseResponse.data._id

    // Format dates to YYYY-MM-DD format as required by tenfast API
    const endDate = lastDebitDate.toISOString().split('T')[0]

    const requestData: {
      endDate: string
      cancelledByType: string
      reason: string
      preferredMoveOutDate?: string
    } = {
      endDate,
      cancelledByType: 'hyresgast',
      reason: 'Tenant requested termination',
    }

    // Only include preferredMoveOutDate if desiredMoveDate is provided
    if (desiredMoveDate) {
      requestData.preferredMoveOutDate = desiredMoveDate
        .toISOString()
        .split('T')[0]
    }

    const terminationResponse = await tenfastApi.request({
      method: 'patch',
      url: `${tenfastBaseUrl}/v1/hyresvard/avtal/${tenfastLeaseId}/send-simplesign-termination?hyresvard=${tenfastCompanyId}`,
      data: requestData,
    })

    // Handle success
    if (terminationResponse.status === 200) {
      return { ok: true, data: { message: 'Signerings begäran skickad' } }
    }

    // Handle errors - use shared error mapping logic
    return handleTerminationError(terminationResponse, leaseId)
  } catch (err: any) {
    // Handle Axios errors specifically to get status codes
    if (err.response) {
      return handleTerminationError(err.response, leaseId)
    }

    return handleTenfastError(err, 'termination-failed')
  }

  function handleTerminationError(
    response: { status: number; data: any },
    leaseId: string
  ): AdapterResult<
    PreliminaryTerminationResponse,
    | 'lease-not-found'
    | 'tenant-email-missing'
    | 'termination-not-required'
    | 'termination-failed'
    | 'unknown'
  > {
    const errorMessage = response.data?.error
    if (
      errorMessage ===
      'En eller flera hyresgäster saknar en giltig e-postadress'
    ) {
      logger.error(
        { leaseId, status: response.status, error: response.data },
        'Tenant missing valid email address'
      )
      return { ok: false, err: 'tenant-email-missing' }
    }

    if (
      errorMessage ===
      'Avtalet kommer löpa ut inom uppsägningstiden. Ingen uppsägning krävs.'
    ) {
      logger.info(
        { leaseId, status: response.status },
        'Lease expires within notice period, no termination required'
      )
      return { ok: false, err: 'termination-not-required' }
    }

    const errorMap: Record<
      number,
      {
        err:
          | 'lease-not-found'
          | 'tenant-email-missing'
          | 'termination-failed'
          | 'unknown'
        message: string
      }
    > = {
      400: {
        err: 'termination-failed',
        message: 'Invalid termination request data',
      },
      404: { err: 'lease-not-found', message: 'Lease not found in tenfast' },
      500: {
        err: 'termination-failed',
        message: 'Tenfast server error during termination',
      },
    }

    const error = errorMap[response.status] || {
      err: 'unknown' as const,
      message: 'Unexpected response from tenfast termination endpoint',
    }

    logger.error(
      {
        leaseId,
        status: response.status,
        error: response.data,
      },
      error.message
    )
    return { ok: false, err: error.err }
  }
}
const defaultFilters: GetLeasesFilters = {
  status: [
    'current',
    'upcoming',
    'about-to-end',
    'ended',
    'preliminary-terminated',
    'pending-signature',
    'not-sent',
  ],
}

export async function getLeasesByTenantId(
  tenantId: string,
  filters: GetLeasesFilters = defaultFilters
): Promise<AdapterResult<TenfastLease[], 'unknown' | SchemaError>> {
  try {
    const res = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/hyresgaster/${tenantId}/avtal?populate=hyresobjekt,hyresgaster`,
    })

    // Not sure we want to fail completely here if parsing fails
    const leases = TenfastLeaseSchema.array().safeParse(res.data)

    if (!leases.success) {
      logger.error(
        { error: JSON.stringify(leases.error, null, 2) },
        'getLeasesByTenantId: Failed to parse Tenfast response'
      )

      return { ok: false, err: { tag: 'schema-error', error: leases.error } }
    }

    return {
      ok: true,
      data: filterByStatus(leases.data, filters.status),
    }
  } catch (err) {
    logger.error(mapHttpError(err), 'tenfast-adapter.getLeasesByTenantId')
    return { ok: false, err: 'unknown' }
  }
}

export async function getLeasesByRentalPropertyId(
  rentalPropertyId: string,
  filters: GetLeasesFilters = defaultFilters
): Promise<AdapterResult<TenfastLease[], 'unknown' | SchemaError>> {
  try {
    const res = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/hyresobjekt/${rentalPropertyId}/avtal?populate=hyresobjekt,hyresgaster`,
    })

    // Not sure we want to fail completely here if parsing fails
    const leases = TenfastLeaseSchema.array().safeParse(res.data)

    if (!leases.success) {
      logger.error(
        { error: JSON.stringify(leases.error, null, 2) },
        'getLeasesByRentalPropertyId: Failed to parse Tenfast response'
      )

      return { ok: false, err: { tag: 'schema-error', error: leases.error } }
    }

    return {
      ok: true,
      data: filterByStatus(leases.data, filters.status),
    }
  } catch (err) {
    logger.error(
      mapHttpError(err),
      'tenfast-adapter.getLeasesByRentalPropertyId'
    )
    return { ok: false, err: 'unknown' }
  }
}

export async function getLeaseByLeaseId(
  leaseId: string
): Promise<AdapterResult<TenfastLease, 'unknown' | 'not-found' | SchemaError>> {
  try {
    const res = await tenfastApi.request({
      url: `${tenfastBaseUrl}/v1/hyresvard/extras/avtal/${encodeURIComponent(leaseId)}?hyresvard=${tenfastCompanyId}&populate=hyresobjekt,hyresgaster`,
      method: 'get',
    })

    if (res.status !== 200) {
      if (res.status === 404) {
        return { ok: false, err: 'not-found' }
      }

      return { ok: false, err: 'unknown' }
    }

    // Not sure we want to fail completely here if parsing fails
    const lease = TenfastLeaseSchema.safeParse(res.data)

    if (!lease.success) {
      logger.error(
        { error: JSON.stringify(lease.error, null, 2) },
        'getLeaseByLeaseId: Failed to parse Tenfast response'
      )

      return { ok: false, err: { tag: 'schema-error', error: lease.error } }
    }

    return {
      ok: true,
      data: lease.data,
    }
  } catch (err) {
    logger.error(mapHttpError(err), 'tenfast-adapter.getLeaseByLeaseId')
    return { ok: false, err: 'unknown' }
  }
}

export const getLeaseByExternalId = async (
  externalId: string
): Promise<
  AdapterResult<TenfastLease, 'unknown' | 'not-found' | SchemaError>
> => {
  try {
    const res = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/extras/avtal/${encodeURIComponent(externalId)}?hyresvard=${tenfastCompanyId}&populate=hyresgaster,hyresobjekt`,
    })

    if (res.status !== 200) {
      if (res.status === 404) {
        logger.error({ error: mapHttpError(res.data) }, 'Lease not found')

        return { ok: false, err: 'not-found' }
      }

      logger.error({ error: mapHttpError(res.data) }, 'Unknown error')
      return { ok: false, err: 'unknown' }
    }

    const lease = TenfastLeaseSchema.safeParse(res.data)

    if (!lease.success) {
      logger.error(
        { error: JSON.stringify(lease.error, null, 2) },
        'getLeaseByExternalId: Failed to parse Tenfast response'
      )

      return { ok: false, err: { tag: 'schema-error', error: lease.error } }
    }

    return {
      ok: true,
      data: lease.data,
    }
  } catch (err) {
    logger.error(mapHttpError(err), 'tenfast-adapter.getLeaseByExternalId')
    return { ok: false, err: 'unknown' }
  }
}

export async function updateLeaseInvoiceRows(params: {
  leaseId: string
  rowsToDelete: string[]
  rowsToAdd: Omit<TenfastInvoiceRow, '_id'>[]
}): Promise<AdapterResult<null, 'unknown'>> {
  try {
    const res = await tenfastApi.request({
      method: 'patch',
      url: `${tenfastBaseUrl}/v1/hyresvard/extras/avtal/${encodeURIComponent(params.leaseId)}/rows?hyresvard=${tenfastCompanyId}`,
      data: {
        // TODO: How to handle vatEnabled?
        vatEnabled: true,
        rowsToDelete: params.rowsToDelete,
        rowsToAdd: params.rowsToAdd,
      },
    })

    if (res.status === 200) {
      return { ok: true, data: null }
    } else {
      throw { status: res.status, data: res.data }
    }
  } catch (err) {
    logger.error(mapHttpError(err), 'tenfast-adapter.updateLeaseInvoiceRows')
    return { ok: false, err: 'unknown' }
  }
}

export const getLeasesWithHomeInsurance = async (): Promise<
  AdapterResult<TenfastLease[], 'unknown'>
> => {
  try {
    const articleId = config.tenfast.leaseRentRows.homeInsurance.articleId
    logger.info(
      { articleId },
      'Fetching leases with home insurance from Tenfast'
    )
    const params = new URLSearchParams({
      hyresvard: tenfastCompanyId,
      populate: 'hyresgaster,hyresobjekt',
      states: 'active,upcoming,preTermination,terminationScheduled',
    })

    const records = await fetchAllPages(
      (paginate) =>
        `${tenfastBaseUrl}/v1/hyresvard/extras/avtal/articles/${encodeURIComponent(articleId)}?${params}&paginate=${paginate}`,
      TenfastLeasesByArticleResponseSchema
    )

    return { ok: true, data: records }
  } catch (err: any) {
    return handleTenfastError(err, 'unknown')
  }
}

export type TerminateLeaseBody = {
  endDate: Date
  reason: string
  notifyHg: boolean
  supplementaryAgreements: boolean
  handled: boolean
}

export const terminateLease = async (
  leaseId: string,
  body: TerminateLeaseBody
): Promise<
  AdapterResult<
    { action: 'terminated' | 'skipped'; leaseId: string },
    'lease-not-found' | 'terminate-failed' | 'unknown'
  >
> => {
  const existing = await getLeaseByExternalId(leaseId)
  if (!existing.ok) {
    if (existing.err === 'not-found') {
      return { ok: false, err: 'lease-not-found' }
    }
    return { ok: false, err: 'unknown' }
  }

  try {
    const response = await tenfastApi.request({
      method: 'post',
      url: `${tenfastBaseUrl}/v1/hyresvard/avtal/${existing.data._id}/terminate?hyresvard=${tenfastCompanyId}`,
      data: {
        ...body,
        endDate: body.endDate.toISOString().split('T')[0],
      },
    })

    if (response.status === 200) {
      return { ok: true, data: { action: 'terminated', leaseId } }
    }

    if (
      response.status === 400 &&
      response.data?.error === 'Avtalet kan inte sägas upp'
    ) {
      return { ok: true, data: { action: 'skipped', leaseId } }
    }

    logger.error(
      { status: response.status, error: response.data },
      'tenfast-adapter.terminateLease'
    )
    return { ok: false, err: 'terminate-failed' }
  } catch (err) {
    logger.error({ err }, 'tenfast-adapter.terminateLease')
    return { ok: false, err: 'unknown' }
  }
}

export const voidLease = async (
  leaseId: string
): Promise<
  AdapterResult<
    { action: 'voided'; leaseId: string },
    'lease-not-found' | 'void-failed' | 'unknown'
  >
> => {
  const existing = await getLeaseByExternalId(leaseId)
  if (!existing.ok) {
    if (existing.err === 'not-found') {
      return { ok: false, err: 'lease-not-found' }
    }
    return { ok: false, err: 'unknown' }
  }

  try {
    const response = await tenfastApi.request({
      method: 'patch',
      url: `${tenfastBaseUrl}/v1/hyresvard/avtal/${existing.data._id}/void?hyresvard=${tenfastCompanyId}`,
      data: { reason: 'Synced from xpand' },
    })

    if (response.status === 200) {
      return { ok: true, data: { action: 'voided', leaseId } }
    }

    logger.error(
      { leaseId, status: response.status, error: response.data },
      'tenfast-adapter.voidLease'
    )
    return { ok: false, err: 'void-failed' }
  } catch (err) {
    logger.error({ err }, 'tenfast-adapter.voidLease')
    return { ok: false, err: 'unknown' }
  }
}

// TODO: maybe move to utilities and rework
function mapHttpError(err: unknown): { err: string } {
  if (isAxiosError(err)) {
    return {
      err: JSON.stringify(
        {
          statusCode: err.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
        },
        null,
        2
      ),
    }
  } else {
    return { err: JSON.stringify(err, null, 2) }
  }
}
