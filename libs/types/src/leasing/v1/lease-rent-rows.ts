import { z } from 'zod'

import { LeaseStatus } from '../../enums'
import { GetLeasesStatusSchema } from './leases'

/**
 * Narrows the rent row list to one kind of row.
 * - homeInsurance: rows with the home insurance article
 * - sameDate: rows whose from and to are the same day
 */
export const LeaseRentRowFilterSchema = z.enum(['homeInsurance', 'sameDate'])

export type LeaseRentRowFilter = z.infer<typeof LeaseRentRowFilterSchema>

const toArray = <T>(val: T | T[]): T[] => (Array.isArray(val) ? val : [val])

export const LeaseRentRowsQueryParamsSchema = z.object({
  // Free-text search on lease id, contact code, article code, label and row id
  q: z.string().trim().optional(),
  // Lease statuses to include. Leaving it out includes every status.
  status: z
    .union([GetLeasesStatusSchema, z.array(GetLeasesStatusSchema)])
    .transform(toArray)
    .optional(),
  filter: LeaseRentRowFilterSchema.optional(),
  // Leaving page out returns every matching row (used by the Excel export)
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

export type LeaseRentRowsQueryParams = z.infer<
  typeof LeaseRentRowsQueryParamsSchema
>
export type LeaseRentRowsQueryParamsInput = z.input<
  typeof LeaseRentRowsQueryParamsSchema
>

/** One rent row on a lease, together with the lease and article it belongs to. */
export const LeaseRentRowListItemSchema = z.object({
  leaseId: z.string(),
  leaseStatus: z.nativeEnum(LeaseStatus),
  contactCodes: z.array(z.string()),
  rowId: z.string(),
  articleId: z.string().nullable(),
  articleCode: z.string().nullable(),
  label: z.string(),
  // Monthly amount
  amount: z.number(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  isHomeInsurance: z.boolean(),
  articleCreatedAt: z.string().nullable(),
  articleUpdatedAt: z.string().nullable(),
})

export type LeaseRentRowListItem = z.infer<typeof LeaseRentRowListItemSchema>

export const SetHomeInsuranceEndDateRequestSchema = z.object({
  rowId: z.string().min(1),
  // yyyy-mm-dd
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type SetHomeInsuranceEndDateRequest = z.infer<
  typeof SetHomeInsuranceEndDateRequestSchema
>

/** Why a home insurance end date change was refused. */
export const SetHomeInsuranceEndDateErrorSchema = z.enum([
  'lease-not-found',
  'row-not-found',
  'not-home-insurance',
  'end-before-start',
  'unchanged',
  // Reading the lease or saving the change failed in the leasing system
  'lease-fetch-failed',
  'update-failed',
])

export type SetHomeInsuranceEndDateError = z.infer<
  typeof SetHomeInsuranceEndDateErrorSchema
>

export const LeaseRentRowsResponseSchema = z.object({
  content: z.array(LeaseRentRowListItemSchema),
  _meta: z.object({
    totalRecords: z.number(),
    page: z.number(),
    limit: z.number(),
    count: z.number(),
    // When the lease cache last synced with the leasing system (ISO), null if never
    syncedAt: z.string().nullable(),
  }),
})

export type LeaseRentRowsResponse = z.infer<typeof LeaseRentRowsResponseSchema>

export const SetHomeInsuranceEndDateResponseSchema = z.object({
  changed: z.literal(true),
  // The lease's rent rows read back from the leasing system after the change, or null
  // if reading them back failed (the change itself went through)
  rentRows: z.array(LeaseRentRowListItemSchema).nullable(),
})

export type SetHomeInsuranceEndDateResponse = z.infer<
  typeof SetHomeInsuranceEndDateResponseSchema
>
