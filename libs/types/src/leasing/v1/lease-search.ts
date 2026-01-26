import { z } from 'zod'
import { LeaseStatus } from '../../enums'

/**
 * Contact info schema - reusable for lease contacts
 */
export const ContactInfoSchema = z.object({
  name: z.string(),
  contactCode: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
})

export type ContactInfo = z.infer<typeof ContactInfoSchema>

/**
 * Lease search query parameters schema
 */
export const LeaseSearchQueryParamsSchema = z.object({
  // Text search
  q: z.string().optional(),

  // Filters
  objectType: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),

  status: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),

  // Date filters
  startDateFrom: z.string().optional(),
  startDateTo: z.string().optional(),
  endDateFrom: z.string().optional(),
  endDateTo: z.string().optional(),

  // Property/Building/Area filters
  propertyCodes: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),

  buildingCodes: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),

  areaCodes: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),

  districtNames: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),

  buildingManagerCodes: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),

  // Pagination
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(parseInt(val, 10), 100) : 20)),

  // Sorting (tenantName removed since contacts are fetched separately)
  sortBy: z.enum(['leaseStartDate', 'lastDebitDate', 'leaseId']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export type LeaseSearchQueryParams = z.infer<
  typeof LeaseSearchQueryParamsSchema
>

/**
 * Lease search result item schema
 */
export const LeaseSearchResultSchema = z.object({
  // Core lease fields (always returned)
  leaseId: z.string(),
  objectTypeCode: z.string(),
  leaseType: z.string(),
  contacts: z.array(ContactInfoSchema),
  address: z.string().nullable(),
  startDate: z.date().nullable(),
  lastDebitDate: z.date().nullable(),
  status: z.nativeEnum(LeaseStatus),

  // Property/Building/Area fields - optional (only included when filter used)
  // nullable().optional() = omit when not queried, null when queried but empty in DB
  propertyCode: z.string().nullable().optional(),
  propertyCaption: z.string().nullable().optional(),
  buildingCode: z.string().nullable().optional(),
  buildingCaption: z.string().nullable().optional(),
  areaCode: z.string().nullable().optional(),
  areaName: z.string().nullable().optional(),
  buildingManagerCode: z.string().nullable().optional(),
  managementUnitName: z.string().nullable().optional(),
  buildingManagerName: z.string().nullable().optional(),
  districtName: z.string().nullable().optional(),
})

export type LeaseSearchResult = z.infer<typeof LeaseSearchResultSchema>
