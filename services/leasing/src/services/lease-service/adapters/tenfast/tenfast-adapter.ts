import { logger } from '@onecore/utilities'
import { Contact, RentalObjectRent } from '@onecore/types'
import { isAxiosError } from 'axios'
import z from 'zod'

import {
  TenfastTenantByContactCodeResponseSchema,
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
} from './schemas'
import config from '../../../../common/config'
import { AdapterResult } from '../../adapters/types'
import * as tenfastApi from './tenfast-api'
import { filterByStatus, GetLeasesFilters } from './filters'
import currency from 'currency.js'

const tenfastBaseUrl = config.tenfast.baseUrl
const tenfastCompanyId = config.tenfast.companyId

type SchemaError = { tag: 'schema-error'; error: z.ZodError }

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
  const tenantResult = await getOrCreateTenant(contact)
  if (!tenantResult.ok) return { ok: false, err: tenantResult.err }
  else if (!tenantResult.data)
    return { ok: false, err: 'could-not-retrieve-tenant' }

  const rentalObjectResponse = await getRentalObject(rentalObjectCode)
  if (!rentalObjectResponse.ok || !rentalObjectResponse.data)
    return { ok: false, err: 'could-not-find-rental-object' }
  if (rentalObjectResponse.data.hyror.length === 0)
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
    return handleTenfastError(err, 'lease-could-not-be-created')
  }
}

export const getRentalObject = async (
  rentalObjectCode: string
): Promise<
  AdapterResult<
    TenfastRentalObject | null,
    | 'could-not-find-rental-object'
    | 'could-not-parse-rental-object'
    | 'get-rental-object-bad-request'
  >
> => {
  try {
    const rentalObjectResponse = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/hyresobjekt?filter[externalId]=${rentalObjectCode}`,
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
    return {
      ok: true,
      data: parsedRentalObjectResponse.data.records[0] ?? null,
    }
  } catch (err: any) {
    return handleTenfastError(err, 'could-not-find-rental-object')
  }
}

export const getRentForRentalObject = async (
  rentalObjectCode: string,
  includeVAT: boolean
): Promise<
  AdapterResult<
    RentalObjectRent,
    | 'could-not-find-rental-object'
    | 'could-not-parse-rental-object'
    | 'get-rental-object-bad-request'
  >
> => {
  const rentalObjectResult = await getRentalObject(rentalObjectCode)

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

  const rent: RentalObjectRent = parseRentalObjectRentFromTenfastRentalObject(
    includeVAT,
    rentalObjectResult.data
  )

  return {
    ok: true,
    data: rent,
  }
}

const parseRentalObjectRentFromTenfastRentalObject = (
  includeVAT: boolean,
  tenfastRentalObject: TenfastRentalObject
): RentalObjectRent => {
  return {
    rentalObjectCode: tenfastRentalObject.externalId,
    amount: includeVAT
      ? tenfastRentalObject.hyra
      : tenfastRentalObject.hyraExcludingVat,
    vat: includeVAT ? tenfastRentalObject.hyraVat : 0,
    rows: tenfastRentalObject.hyror.map((hyra) => ({
      description: hyra.label || '',
      amount: includeVAT
        ? currency(hyra.amount).add(hyra.vat).value
        : hyra.amount,
      vatPercentage: includeVAT ? hyra.vat : 0,
      fromDate: hyra.from != undefined ? new Date(hyra.from) : undefined,
      toDate: hyra.to != undefined ? new Date(hyra.to) : undefined,
      code: hyra.article || '', //TODO:vad ska denna sättas till? Är article rätt fält?,
    })),
  }
}

export const getRentalObjectRents = async (
  rentalObjectCodes: Array<string>,
  includeVAT: boolean
): Promise<
  AdapterResult<
    Array<RentalObjectRent>,
    | 'could-not-find-rental-objects'
    | 'could-not-parse-rental-objects'
    | 'get-rental-objects-bad-request'
    | 'unknown'
  >
> => {
  try {
    const batchSize = 500
    const batches: Array<Array<string>> = []
    for (let i = 0; i < rentalObjectCodes.length; i += batchSize) {
      batches.push(rentalObjectCodes.slice(i, i + batchSize))
    }

    let allParsedRentalObjects: RentalObjectRent[] = []

    for (const batch of batches) {
      const rentalObjectResponse = await tenfastApi.request({
        method: 'post',
        url: `${tenfastBaseUrl}/v1/hyresvard/extras/hyresobjekt/batch-get?hyresvard=${tenfastCompanyId}`,
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

          return parseRentalObjectRentFromTenfastRentalObject(
            includeVAT,
            parsedRentalObject.data
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
    | 'could-not-retrieve-tenant'
    | 'could-not-parse-tenant-response'
    | 'get-tenant-bad-request'
    | 'unknown'
  >
> => {
  try {
    const tenantResponse = await tenfastApi.request({
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/hyresgaster?filter[externalId]=${contactCode}`,
    })

    if (tenantResponse.status === 400)
      return handleTenfastError(
        tenantResponse.data.error,
        'get-tenant-bad-request'
      )
    else if (tenantResponse.status !== 200 && tenantResponse.status !== 201)
      return handleTenfastError(
        {
          error: tenantResponse.data.error,
          status: tenantResponse.status,
        },
        'could-not-retrieve-tenant'
      )

    const parsedTenantResponse =
      TenfastTenantByContactCodeResponseSchema.safeParse(tenantResponse.data)
    if (!parsedTenantResponse.success) {
      return handleTenfastError(
        parsedTenantResponse.error,
        'could-not-parse-tenant-response'
      )
    }
    return {
      ok: true,
      data: parsedTenantResponse.data.records[0] ?? null,
    }
  } catch (err: any) {
    return handleTenfastError(err, 'unknown')
  }
}

export const createTenant = async (
  contact: Contact
): Promise<
  AdapterResult<
    TenfastTenant | undefined,
    | 'tenant-could-not-be-created'
    | 'tenant-could-not-be-parsed'
    | 'create-tenant-bad-request'
  >
> => {
  const createTenantRequestData = buildTenantRequestData(contact)

  const tenantResponse = await tenfastApi.request({
    method: 'post',
    url: `${tenfastBaseUrl}/v1/hyresvard/hyresgaster?hyresvard=${tenfastCompanyId}`,
    data: createTenantRequestData,
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

async function getOrCreateTenant(
  contact: Contact
): Promise<
  AdapterResult<
    TenfastTenant,
    'could-not-retrieve-tenant' | 'could-not-create-tenant'
  >
> {
  const tenantResponse = await getTenantByContactCode(contact.contactCode)
  if (!tenantResponse.ok) {
    return { ok: false, err: 'could-not-retrieve-tenant' }
  }
  if (!tenantResponse.data) {
    const createTenantResult = await createTenant(contact)
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
    hyror: rentalObject.hyror.map((hyra) => {
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
  status: ['current', 'upcoming', 'about-to-end', 'ended'],
    'preliminary-terminated',
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
      method: 'get',
      url: `${tenfastBaseUrl}/v1/hyresvard/mimer/avtal/${leaseId}?populate=hyresobjekt`,
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

export async function getLeaseByExternalId(
  externalId: string
): Promise<AdapterResult<TenfastLease, 'unknown' | 'not-found' | SchemaError>> {
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
