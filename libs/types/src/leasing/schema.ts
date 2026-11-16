import { z } from 'zod'
import { LeaseStatus } from '../enums'

// A home insurance rent row on a lease. rowId changes every time the row is
// written, so a client sends it back to say which row it saw.
export const HomeInsuranceRowSchema = z.object({
  rowId: z.string(),
  monthlyAmount: z.number(),
  // yyyy-mm-dd, both days included. Left out when the row has no such date.
  from: z.string().optional(),
  to: z.string().optional(),
})

// cancel: end the insurance, removing the row when it would end on or before
// its first day. set-end: move the last day, never before the first day.
export const HomeInsuranceEndActionSchema = z.enum(['cancel', 'set-end'])

export const UpdateHomeInsuranceRowRequestSchema = z.object({
  // The last day the insurance is in force, as yyyy-mm-dd.
  endDate: z.string().date(),
  action: HomeInsuranceEndActionSchema,
})

export const UpdateHomeInsuranceRowResponseSchema = z.discriminatedUnion(
  'action',
  [
    z.object({ action: z.literal('ended'), row: HomeInsuranceRowSchema }),
    z.object({ action: z.literal('deleted'), row: z.null() }),
  ]
)

// Error codes the home insurance routes answer with in `error`.
export const HomeInsuranceErrorCodeSchema = z.enum([
  'lease-not-found',
  'home-insurance-row-not-found',
  // The row the client saw is gone or was changed by someone else.
  'home-insurance-row-changed',
  'home-insurance-already-exists',
  'end-date-before-start',
  'end-date-unchanged',
  'upstream-failed',
])

// The status a home insurance gets in the Länsförsäkringar file: G in force,
// K on a lease to come, * the row has an end date.
export const HomeInsuranceLfStatusSchema = z.enum(['G', 'K', '*'])

// lf: the rows the Länsförsäkringar file holds, one per lease. all: every
// home insurance row on every lease, for quality checks (companies, negative
// amounts, rows without a first day and leases with several rows included).
export const HomeInsuranceListRowsSchema = z.enum(['lf', 'all'])

export const HomeInsuranceListSortBySchema = z.enum([
  'leaseId',
  'leaseStatus',
  'leaseFromDate',
  'leaseToDate',
  'rentalObjectCode',
  'address',
  'rowFromDate',
  'rowToDate',
  'monthlyAmount',
  'contactCode',
])

// A home insurance row in the staff list. It holds no person data: the
// tenant is only its contactCode, and names and personal identity numbers
// come from the contacts service, so a protected identity stays protected.
export const HomeInsuranceListItemSchema = z.object({
  leaseId: z.string(),
  leaseStatus: HomeInsuranceLfStatusSchema,
  // The lease's own status (Gällande, Kommande, ...).
  leaseStage: z.nativeEnum(LeaseStatus),
  // Days are yyyy-mm-dd, Swedish days.
  leaseFromDate: z.string(),
  leaseToDate: z.string().nullable(),
  rentalObjectCode: z.string().nullable(),
  numberOfRooms: z.number().nullable(),
  squareMeters: z.number().nullable(),
  // The rental object's address, not the tenant's.
  address: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  rowId: z.string(),
  rowFromDate: z.string().nullable(),
  rowToDate: z.string().nullable(),
  monthlyAmount: z.number(),
  articleText: z.string(),
  // The insured tenant: the first private tenant with a personal identity
  // number, else the first tenant. Null when the lease has no tenant.
  contactCode: z.string().nullable(),
  isCompany: z.boolean(),
})

// A query parameter given once, repeated, or as a comma-separated list.
const queryList = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value : [value])
      .flatMap((item) => item.split(','))
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  )

export const HomeInsuranceListQueryParamsSchema = z.object({
  // Matches leaseId, rentalObjectCode, contactCode and address, ignoring case.
  q: z.string().optional(),
  // Only rows whose contactCode is one of these. Given but empty, it matches
  // nothing: a search that resolved to no contact must not list every row.
  contactCodes: queryList.optional(),
  status: queryList.pipe(z.array(HomeInsuranceLfStatusSchema)).optional(),
  rows: HomeInsuranceListRowsSchema.default('lf'),
  // Only rows whose first and last day are the same day.
  sameDate: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
  sortBy: HomeInsuranceListSortBySchema.default('leaseId'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
})

// The query of GET /leases/home-insurances/all: the list's filters and sort
// order, without paging.
export const HomeInsuranceListAllQueryParamsSchema =
  HomeInsuranceListQueryParamsSchema.omit({ page: true, limit: true })

// Error codes GET /leases/home-insurances and /leases/home-insurances/all
// answer with in `error`.
export const HomeInsuranceListErrorCodeSchema = z.enum([
  'invalid-query',
  // The list is loading from the leasing system for the first time. Retry after the
  // Retry-After header.
  'cache-warming',
  'upstream-failed',
])

export const LeaseStatusesRequestSchema = z.object({
  leaseIds: z.array(z.string().min(1)),
})

export const LeaseStatusItemSchema = z.object({
  // The lease ID as it was asked for.
  leaseId: z.string(),
  status: z.nativeEnum(LeaseStatus),
})

export const LeaseStatusesResponseSchema = z.object({
  statuses: z.array(LeaseStatusItemSchema),
  // Lease IDs the leasing system has no lease for.
  notFoundLeaseIds: z.array(z.string()),
})

// Error codes POST /leases/statuses answers with in `error`.
export const LeaseStatusesErrorCodeSchema = z.enum([
  // The leases are loading from the leasing system for the first time. Retry after the
  // Retry-After header.
  'cache-warming',
  // The leasing system could not be read for at least one lease.
  'upstream-failed',
])
