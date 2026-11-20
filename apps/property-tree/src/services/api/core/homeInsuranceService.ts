import { ApiError, GET, PATCH } from './baseApi'
import type { components, paths } from './generated/api-types'
import type { PaginatedResponse } from './leaseSearchService'

export type HomeInsuranceListItem =
  components['schemas']['HomeInsuranceListItem']
export type HomeInsuranceRow = components['schemas']['HomeInsuranceRow']
export type UpdateHomeInsuranceRowResponse =
  components['schemas']['UpdateHomeInsuranceRowResponse']
export type EndHomeInsuranceRowBody =
  paths['/leases/{leaseId}/home-insurance/rows/{rowId}']['patch']['requestBody']['content']['application/json']

// The export's query is the list's query without page and limit.
export type HomeInsuranceListQueryParams = NonNullable<
  paths['/leases/home-insurances/export']['get']['parameters']['query']
>

async function list(
  params: HomeInsuranceListQueryParams,
  page: number,
  limit: number
): Promise<PaginatedResponse<HomeInsuranceListItem>> {
  const { data, error, response } = await GET('/leases/home-insurances', {
    params: { query: { ...params, page, limit } },
  })

  // A 403 has no JSON body, so error can be undefined: check data instead.
  if (!data)
    throw new ApiError(
      response.status,
      'home insurance list failed',
      error?.error
    )

  return data
}

async function exportToExcel(
  params: HomeInsuranceListQueryParams
): Promise<Blob> {
  const { data, error, response } = await GET(
    '/leases/home-insurances/export',
    { params: { query: params }, parseAs: 'blob' }
  )

  if (!data)
    throw new ApiError(
      response.status,
      'home insurance export failed',
      error?.error
    )

  // openapi-typescript types binary responses as `string`, but parseAs:'blob'
  // makes openapi-fetch return an actual Blob at runtime.
  return data as unknown as Blob
}

/** The lease's current home insurance row, or null when it has none. */
async function getByLeaseId(leaseId: string): Promise<HomeInsuranceRow | null> {
  const { data, error, response } = await GET(
    '/leases/{leaseId}/home-insurance',
    { params: { path: { leaseId } } }
  )

  // 404 covers both a missing lease and a lease without home insurance:
  // either way there is no insurance to show.
  if (response.status === 404) return null
  if (!data)
    throw new ApiError(
      response.status,
      'home insurance lookup failed',
      error?.error
    )

  return data.content
}

async function endRow(
  leaseId: string,
  rowId: string,
  body: EndHomeInsuranceRowBody
): Promise<UpdateHomeInsuranceRowResponse> {
  const { data, error, response } = await PATCH(
    '/leases/{leaseId}/home-insurance/rows/{rowId}',
    { params: { path: { leaseId, rowId } }, body }
  )

  if (!data) {
    // An invalid body gets an InvalidRequestBodyResponse, which has no code.
    // A 403 body is plain text at runtime, hence the typeof check.
    const code =
      typeof error === 'object' && error !== null && 'error' in error
        ? error.error
        : undefined
    throw new ApiError(response.status, 'home insurance end failed', code)
  }

  return data.content
}

export const homeInsuranceService = {
  list,
  exportToExcel,
  getByLeaseId,
  endRow,
}
