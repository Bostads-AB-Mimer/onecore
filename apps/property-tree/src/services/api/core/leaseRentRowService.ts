import { ApiError, GET, POST } from './baseApi'
import type { components, paths } from './generated/api-types'

export type LeaseRentRow = components['schemas']['LeaseRentRowListItem']
export type LeaseRentRowsResponse =
  components['schemas']['LeaseRentRowsResponse']

export type LeaseRentRowsQueryParams = NonNullable<
  paths['/leases/rent-rows']['get']['parameters']['query']
>
export type LeaseRentRowStatusFilter = NonNullable<
  LeaseRentRowsQueryParams['status']
>[number]
export type LeaseRentRowKindFilter = NonNullable<
  LeaseRentRowsQueryParams['filter']
>

/**
 * Why a T.o.m. change was refused. Kept in sync with
 * SetHomeInsuranceEndDateError in @onecore/types (leasing/v1/lease-rent-rows).
 */
export type SetHomeInsuranceEndDateError =
  | 'lease-not-found'
  | 'row-not-found'
  | 'not-home-insurance'
  | 'end-before-start'
  | 'unchanged'
  | 'lease-fetch-failed'
  | 'update-failed'
  | 'unknown'

export class SetHomeInsuranceEndDateFailed extends ApiError {
  constructor(
    status: number,
    public reason: SetHomeInsuranceEndDateError
  ) {
    super(status, 'set home insurance end date failed')
    this.name = 'SetHomeInsuranceEndDateFailed'
  }
}

const KNOWN_END_DATE_ERRORS: readonly SetHomeInsuranceEndDateError[] = [
  'lease-not-found',
  'row-not-found',
  'not-home-insurance',
  'end-before-start',
  'unchanged',
  'lease-fetch-failed',
  'update-failed',
]

const toEndDateError = (value: unknown): SetHomeInsuranceEndDateError =>
  KNOWN_END_DATE_ERRORS.find((e) => e === value) ?? 'unknown'

async function list(
  params: Omit<LeaseRentRowsQueryParams, 'page' | 'limit'>,
  page: number,
  limit: number
): Promise<LeaseRentRowsResponse> {
  const { data, error, response } = await GET('/leases/rent-rows', {
    params: { query: { ...params, page, limit } },
  })

  if (error) throw new ApiError(response.status, 'rent row list failed')

  return data
}

async function exportToExcel(
  params: Omit<LeaseRentRowsQueryParams, 'page' | 'limit'>
): Promise<Blob> {
  const { data, error, response } = await GET('/leases/rent-rows/export', {
    params: { query: params },
    parseAs: 'blob',
  })

  if (error) throw new ApiError(response.status, 'rent row export failed')

  // openapi-typescript types binary responses as `string`, but parseAs:'blob'
  // makes openapi-fetch return an actual Blob at runtime.
  return data as unknown as Blob
}

async function setHomeInsuranceEndDate(
  leaseId: string,
  body: { rowId: string; endDate: string }
) {
  const { data, error, response } = await POST(
    '/leases/{leaseId}/rent-rows/home-insurance-end-date',
    { params: { path: { leaseId } }, body }
  )

  if (error) {
    throw new SetHomeInsuranceEndDateFailed(
      response.status,
      toEndDateError(error.error)
    )
  }

  return data.content
}

export const leaseRentRowService = {
  list,
  exportToExcel,
  setHomeInsuranceEndDate,
}
