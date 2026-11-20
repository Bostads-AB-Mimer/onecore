import {
  loggedAxios as axios,
  logger,
  PaginatedResponse,
} from '@onecore/utilities'
import { Lease, leasing, ReplyToOfferErrorCodes, schemas } from '@onecore/types'
import z from 'zod'

import { AdapterResult } from '../types'
import config from '../../common/config'
import { errorLogFields } from '../../utils/error-log'

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

type GetLeasesOptions = z.infer<typeof leasing.v1.GetLeasesOptionsSchema>
type GetLeasesByContactCodeOptions = z.infer<
  typeof leasing.v1.GetLeasesByContactCodeOptionsSchema
>
type HomeInsuranceExportRow = z.infer<
  typeof schemas.v1.HomeInsuranceExportRowSchema
>

export const getLease = async (leaseId: string): Promise<Lease | null> => {
  // Explicit validateStatus: the process-wide default (<500) would let other
  // 4xx through with no content, which callers would read as "not found".
  const leaseResponse = await axios(
    `${tenantsLeasesServiceUrl}/leases/${encodeURIComponent(leaseId)}`,
    { validateStatus: (status) => status === 200 || status === 404 }
  )

  if (leaseResponse.status === 404) {
    return null
  }

  return leaseResponse.data.content
}

export const getLeasesByContactCode = async (
  contactCode: string,
  options: Partial<GetLeasesByContactCodeOptions>
): Promise<Lease[]> => {
  const queryParams = new URLSearchParams()

  if (options.status) {
    queryParams.set('status', options.status.join(','))
  }

  if (options.includeSubletLeases) {
    queryParams.set('includeSubletLeases', 'true')
  }

  const leasesResponse = await axios.get(
    `${tenantsLeasesServiceUrl}/leases/by-contact-code/${contactCode}?${queryParams.toString()}`
  )

  return leasesResponse.data.content
}

export const getLeasesByRentalObjectCode = async (
  rentalObjectCode: string,
  options?: GetLeasesOptions
): Promise<Lease[]> => {
  const queryParams = new URLSearchParams()

  if (options?.status) {
    queryParams.set('status', options.status.join(','))
  }

  const leasesResponse = await axios(
    `${tenantsLeasesServiceUrl}/leases/by-rental-object-code/${rentalObjectCode}?${queryParams.toString()}`
  )

  // Leasing answers 404 for a rental object it cannot find, and validateStatus
  // stops axios from throwing on it, so `content` would be undefined.
  if (leasesResponse.status === 404) {
    return []
  }

  return leasesResponse.data.content
}

export const createLease = async (
  objectId: string,
  contactId: string,
  fromDate: string,
  companyCode: string,
  includeVAT: boolean
): Promise<
  AdapterResult<
    string,
    ReplyToOfferErrorCodes.RentalObjectNotAvailable | 'unknown'
  >
> => {
  const axiosOptions = {
    method: 'POST',
    data: {
      parkingSpaceId: objectId,
      contactCode: contactId,
      fromDate,
      companyCode,
      includeVAT,
    },
    validateStatus: () => true,
  }

  try {
    const result = await axios(
      tenantsLeasesServiceUrl + '/leases',
      axiosOptions
    )

    if (result.status == 200) {
      return { ok: true, data: result.data.content }
    } else if (
      result.status == 409 &&
      result.data?.error === ReplyToOfferErrorCodes.RentalObjectNotAvailable
    ) {
      // Expected outcome, not a failure: the calling process logs it.
      return { ok: false, err: ReplyToOfferErrorCodes.RentalObjectNotAvailable }
    } else {
      logger.error(
        {
          objectId,
          contactId,
          fromDate,
          status: result.status,
        },
        'Unknown error when creating lease'
      )
      return { ok: false, err: 'unknown' }
    }
  } catch (err: any) {
    logger.error(err, 'leasing-adapter.createLease')
    return { ok: false, err: 'unknown' }
  }
}

type AddLeaseHomeInsuranceParams = z.infer<
  typeof leasing.v1.AddLeaseHomeInsuranceRequestSchema
>

export async function addLeaseHomeInsurance(
  leaseId: string,
  params: AddLeaseHomeInsuranceParams
): Promise<
  AdapterResult<null, 'unknown' | 'not-found' | 'insurance-already-exists'>
> {
  const result = await axios.post(
    `${tenantsLeasesServiceUrl}/leases/${encodeURIComponent(leaseId)}/home-insurance`,
    params
  )

  if (result.status === 201) {
    return { ok: true, data: result.data.content }
  } else if (result.status === 404) {
    return { ok: false, err: 'not-found' }
  } else if (result.status === 422) {
    return { ok: false, err: 'insurance-already-exists' }
  } else {
    logger.error(
      { error: JSON.stringify(result.data) },
      'Unknown error when adding home insurance rent row'
    )

    return { ok: false, err: 'unknown' }
  }
}

/**
 * What leasing's home insurance routes for one lease can fail with: leasing's
 * own error code, a request body leasing rejected, or a response this adapter
 * does not recognise.
 */
export type HomeInsuranceAdapterError =
  leasing.HomeInsuranceErrorCode | 'invalid-request' | 'unknown'

export type HomeInsuranceAdapterFailure = {
  ok: false
  err: HomeInsuranceAdapterError
  statusCode?: number
  detail?: string
}

const HomeInsuranceErrorBodySchema = z.object({
  error: leasing.HomeInsuranceErrorCodeSchema,
})

// The body leasing's parseRequestBody answers 400 with.
const InvalidRequestBodySchema = z.object({
  data: z.array(z.object({ message: z.string() })),
})

const HomeInsuranceRowResponseSchema = z.object({
  content: leasing.HomeInsuranceRowSchema,
})

const UpdateHomeInsuranceRowResponseBodySchema = z.object({
  content: leasing.UpdateHomeInsuranceRowResponseSchema,
})

/**
 * Maps a non-200 answer from a home insurance route to its error. Leasing's
 * own code is passed through as it is, so the route can answer with the same
 * status and code.
 */
const toHomeInsuranceFailure = (
  response: { status: number; data: unknown },
  context: string
): HomeInsuranceAdapterFailure => {
  const statusCode = response.status

  const known = HomeInsuranceErrorBodySchema.safeParse(response.data)
  if (known.success) {
    // Leasing has already logged the Tenfast failure as an error.
    if (known.data.error === 'upstream-failed') {
      logger.warn({ status: statusCode, error: known.data.error }, context)
    }
    return { ok: false, err: known.data.error, statusCode }
  }

  if (statusCode === 400) {
    const invalid = InvalidRequestBodySchema.safeParse(response.data)
    return {
      ok: false,
      err: 'invalid-request',
      statusCode,
      detail: invalid.success
        ? invalid.data.data.map((issue) => issue.message).join('; ')
        : undefined,
    }
  }

  logger.error({ status: statusCode }, context)
  return {
    ok: false,
    err: statusCode === 503 ? 'upstream-failed' : 'unknown',
    statusCode,
  }
}

const homeInsuranceUrl = (leaseId: string) =>
  `${tenantsLeasesServiceUrl}/leases/${encodeURIComponent(leaseId)}/home-insurance`

/** The lease's current home insurance row, with the rowId to end it by. */
export async function getLeaseHomeInsurance(
  leaseId: string
): Promise<AdapterResult<leasing.HomeInsuranceRow, HomeInsuranceAdapterError>> {
  try {
    // Every status is handled here instead of by the process-wide default.
    const response = await axios.get(homeInsuranceUrl(leaseId), {
      validateStatus: () => true,
    })

    if (response.status === 200) {
      return {
        ok: true,
        data: HomeInsuranceRowResponseSchema.parse(response.data).content,
      }
    }

    return toHomeInsuranceFailure(
      response,
      'leasing-adapter.getLeaseHomeInsurance'
    )
  } catch (err: unknown) {
    logger.error(errorLogFields(err), 'leasing-adapter.getLeaseHomeInsurance')
    return { ok: false, err: 'unknown' }
  }
}

/**
 * Ends the lease's current home insurance row on endDate (Mina sidor). The
 * row is never removed.
 */
export async function cancelLeaseHomeInsurance(
  leaseId: string,
  params: { endDate: Date }
): Promise<AdapterResult<null, HomeInsuranceAdapterError>> {
  try {
    const response = await axios.post(
      `${homeInsuranceUrl(leaseId)}/cancel`,
      params,
      { validateStatus: () => true }
    )

    if (response.status === 200) {
      return { ok: true, data: null }
    }

    return toHomeInsuranceFailure(
      response,
      'leasing-adapter.cancelLeaseHomeInsurance'
    )
  } catch (err: unknown) {
    // The write may have reached Tenfast, so the outcome is unknown.
    logger.error(
      errorLogFields(err),
      'leasing-adapter.cancelLeaseHomeInsurance'
    )
    return { ok: false, err: 'unknown' }
  }
}

/**
 * Ends or removes one home insurance row (staff). rowId is the row the
 * client last read; leasing answers home-insurance-row-changed when that row
 * is gone or was changed during the write.
 */
export async function updateLeaseHomeInsuranceRow(
  leaseId: string,
  rowId: string,
  body: leasing.UpdateHomeInsuranceRowRequest
): Promise<
  AdapterResult<
    leasing.UpdateHomeInsuranceRowResponse,
    HomeInsuranceAdapterError
  >
> {
  try {
    const response = await axios.patch(
      `${homeInsuranceUrl(leaseId)}/rows/${encodeURIComponent(rowId)}`,
      body,
      { validateStatus: () => true }
    )

    if (response.status === 200) {
      return {
        ok: true,
        data: UpdateHomeInsuranceRowResponseBodySchema.parse(response.data)
          .content,
      }
    }

    return toHomeInsuranceFailure(
      response,
      'leasing-adapter.updateLeaseHomeInsuranceRow'
    )
  } catch (err: unknown) {
    // The write may have reached Tenfast, or its answer did not parse: the
    // outcome is unknown, never a success.
    logger.error(
      errorLogFields(err),
      'leasing-adapter.updateLeaseHomeInsuranceRow'
    )
    return { ok: false, err: 'unknown' }
  }
}

export type HomeInsuranceListAdapterError =
  leasing.HomeInsuranceListErrorCode | 'unknown'

export type HomeInsuranceListFailure = {
  ok: false
  err: HomeInsuranceListAdapterError
  statusCode?: number
  detail?: string
  // Leasing's Retry-After header, sent with cache-warming.
  retryAfter?: string
}

export type HomeInsuranceListResult =
  | {
      ok: true
      data: PaginatedResponse<leasing.HomeInsuranceListItem>
    }
  | HomeInsuranceListFailure

const HomeInsuranceListErrorBodySchema = z.object({
  error: leasing.HomeInsuranceListErrorCodeSchema,
})

const HomeInsuranceListResponseSchema = schemas.paginatedResponseSchema(
  leasing.HomeInsuranceListItemSchema
)

const HomeInsuranceListAllResponseSchema = z.object({
  content: z.array(leasing.HomeInsuranceListItemSchema),
})

// The list query as leasing reads it.
const homeInsuranceListParams = (
  query: leasing.HomeInsuranceListAllQueryParams
) => ({
  q: query.q,
  // Joined rather than repeated: axios leaves out an empty array, but an
  // empty contactCodes must still reach leasing, where it matches nothing
  // instead of everything.
  contactCodes: query.contactCodes?.join(','),
  status: query.status?.join(','),
  rows: query.rows,
  sameDate: query.sameDate === undefined ? undefined : String(query.sameDate),
  sortBy: query.sortBy,
  sortOrder: query.sortOrder,
})

/** Maps a non-200 answer from a home insurance list route to its error. */
const toHomeInsuranceListFailure = (
  response: {
    status: number
    data: unknown
    headers: { [key: string]: unknown }
  },
  context: string
): HomeInsuranceListFailure => {
  const known = HomeInsuranceListErrorBodySchema.safeParse(response.data)
  if (known.success) {
    const retryAfter = response.headers['retry-after']
    if (known.data.error === 'upstream-failed') {
      // Leasing has already logged the Tenfast failure as an error.
      logger.warn({ status: response.status, error: known.data.error }, context)
    }
    return {
      ok: false,
      err: known.data.error,
      statusCode: response.status,
      retryAfter: typeof retryAfter === 'string' ? retryAfter : undefined,
    }
  }

  logger.error({ status: response.status }, context)
  return { ok: false, err: 'unknown', statusCode: response.status }
}

/**
 * One page of leasing's home insurance list. The list holds no person data:
 * the tenant is only a contactCode.
 */
export async function listHomeInsurances(
  query: leasing.HomeInsuranceListQueryParams
): Promise<HomeInsuranceListResult> {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/leases/home-insurances`,
      {
        params: {
          ...homeInsuranceListParams(query),
          page: query.page,
          limit: query.limit,
        },
        validateStatus: () => true,
      }
    )

    if (response.status === 200) {
      return {
        ok: true,
        data: HomeInsuranceListResponseSchema.parse(response.data),
      }
    }

    return toHomeInsuranceListFailure(
      response,
      'leasing-adapter.listHomeInsurances'
    )
  } catch (err: unknown) {
    logger.error(errorLogFields(err), 'leasing-adapter.listHomeInsurances')
    return { ok: false, err: 'unknown' }
  }
}

/**
 * Every item of leasing's home insurance list that matches the query, in its
 * order, from one read of leasing's cache, for the Excel export.
 */
export async function listAllHomeInsurances(
  query: leasing.HomeInsuranceListAllQueryParams
): Promise<
  { ok: true; data: leasing.HomeInsuranceListItem[] } | HomeInsuranceListFailure
> {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/leases/home-insurances/all`,
      { params: homeInsuranceListParams(query), validateStatus: () => true }
    )

    if (response.status === 200) {
      return {
        ok: true,
        data: HomeInsuranceListAllResponseSchema.parse(response.data).content,
      }
    }

    return toHomeInsuranceListFailure(
      response,
      'leasing-adapter.listAllHomeInsurances'
    )
  } catch (err: unknown) {
    logger.error(errorLogFields(err), 'leasing-adapter.listAllHomeInsurances')
    return { ok: false, err: 'unknown' }
  }
}

export type LeaseStatusesAdapterError =
  leasing.LeaseStatusesErrorCode | 'unknown'

const LeaseStatusesResponseBodySchema = z.object({
  content: leasing.LeaseStatusesResponseSchema,
})

const LeaseStatusesErrorBodySchema = z.object({
  error: leasing.LeaseStatusesErrorCodeSchema,
})

/**
 * The status of each lease, in one call. Leasing fails the whole call when it
 * cannot read a lease, so a lease missing from the answer is one Tenfast does
 * not have (notFoundLeaseIds), never one that failed.
 */
export async function getLeaseStatuses(
  leaseIds: string[]
): Promise<
  AdapterResult<leasing.LeaseStatusesResponse, LeaseStatusesAdapterError>
> {
  try {
    const response = await axios.post(
      `${tenantsLeasesServiceUrl}/leases/statuses`,
      { leaseIds },
      { validateStatus: () => true }
    )

    if (response.status === 200) {
      return {
        ok: true,
        data: LeaseStatusesResponseBodySchema.parse(response.data).content,
      }
    }

    const known = LeaseStatusesErrorBodySchema.safeParse(response.data)
    if (known.success) {
      // Leasing has already logged the Tenfast failure as an error.
      logger.warn(
        { status: response.status, error: known.data.error },
        'leasing-adapter.getLeaseStatuses'
      )
      return { ok: false, err: known.data.error }
    }

    logger.error(
      { status: response.status },
      'leasing-adapter.getLeaseStatuses'
    )
    return { ok: false, err: 'unknown' }
  } catch (err: unknown) {
    logger.error(errorLogFields(err), 'leasing-adapter.getLeaseStatuses')
    return { ok: false, err: 'unknown' }
  }
}

// TODO: Move move to new microservice governingn organization. for now here just to make it available for the filter in /leases
export const getBuildingManagers = async (): Promise<
  { code: string; name: string; district: string }[]
> => {
  const response = await axios.get(
    `${tenantsLeasesServiceUrl}/leases/building-managers`
  )
  return response.data.content
}

export const searchLeases = async (
  queryParams: leasing.v1.LeaseSearchQueryParamsInput
): Promise<PaginatedResponse<leasing.v1.LeaseSearchResult>> => {
  const params = new URLSearchParams()

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value === undefined) return
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v))
    } else {
      params.append(key, value.toString())
    }
  })

  const response = await axios.get(
    `${tenantsLeasesServiceUrl}/leases/search?${params.toString()}`
  )

  return response.data
}

export const getHomeInsuranceExport = async (): Promise<
  AdapterResult<HomeInsuranceExportRow[], 'schema-error' | 'unknown'>
> => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/leases/lf-export`
    )

    if (response.status !== 200) {
      logger.error(
        { status: response.status },
        'leases/lf-export returned unexpected status'
      )
      return { ok: false, err: 'unknown' }
    }

    const parsed = schemas.v1.HomeInsuranceExportResponseSchema.safeParse(
      response.data
    )
    if (!parsed.success) {
      logger.error(
        { err: parsed.error },
        'leases/lf-export response failed schema validation'
      )
      return { ok: false, err: 'schema-error' }
    }

    return { ok: true, data: parsed.data.content }
  } catch (err) {
    logger.error({ err }, 'leases/lf-export failed')
    return { ok: false, err: 'unknown' }
  }
}
