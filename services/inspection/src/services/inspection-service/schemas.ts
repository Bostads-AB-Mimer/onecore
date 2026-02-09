import { z } from 'zod'

/**
 * Inspection status filter constants
 */
export const INSPECTION_STATUS_FILTER = {
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
} as const

export type InspectionStatusFilter =
  (typeof INSPECTION_STATUS_FILTER)[keyof typeof INSPECTION_STATUS_FILTER]

export const XpandInspectionSchema = z.object({
  id: z.string(),
  status: z.string(),
  date: z.coerce.date(),
  inspector: z.string(),
  type: z.string(),
  address: z.string(),
  apartmentCode: z.string().nullable(),
  leaseId: z.string(),
  masterKeyAccess: z.string().nullable(),
})

export const DetailedXpandInspectionRemarkSchema = z.object({
  remarkId: z.string(),
  location: z.string().nullable(),
  buildingComponent: z.string().nullable(),
  notes: z.string().nullable(),
  remarkGrade: z.number(),
  remarkStatus: z.string().nullable(),
  cost: z.number(),
  invoice: z.boolean(),
  quantity: z.number(),
  isMissing: z.boolean(),
  fixedDate: z.coerce.date().nullable(),
  workOrderCreated: z.boolean(),
  workOrderStatus: z.number().nullable(),
})

export const DetailedXpandInspectionRoomSchema = z.object({
  room: z.string(),
  remarks: DetailedXpandInspectionRemarkSchema.array(),
})

export const DetailedXpandInspectionSchema = z.object({
  id: z.string(),
  status: z.string(),
  date: z.coerce.date(),
  startedAt: z.coerce.date().nullable(),
  endedAt: z.coerce.date().nullable(),
  inspector: z.string(),
  type: z.string(),
  residenceId: z.string(),
  address: z.string(),
  apartmentCode: z.string().nullable(),
  isFurnished: z.boolean(),
  leaseId: z.string(),
  isTenantPresent: z.boolean(),
  isNewTenantPresent: z.boolean(),
  masterKeyAccess: z.string().nullable(),
  hasRemarks: z.boolean(),
  notes: z.string().nullable(),
  totalCost: z.number().nullable(),
  remarkCount: z.number(),
  rooms: DetailedXpandInspectionRoomSchema.array(),
})

export const GetInspectionsFromXpandQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  statusFilter: z
    .enum([
      INSPECTION_STATUS_FILTER.ONGOING,
      INSPECTION_STATUS_FILTER.COMPLETED,
    ])
    .optional(),
  sortAscending: z
    .string()
    .transform((s) => (s === 'true' ? true : false))
    .optional(),
  inspector: z.string().optional(),
  address: z.string().optional(),
})

export const GetInspectionsByResidenceIdQuerySchema = z.object({
  statusFilter: z
    .enum([
      INSPECTION_STATUS_FILTER.ONGOING,
      INSPECTION_STATUS_FILTER.COMPLETED,
    ])
    .optional(),
})

export type XpandInspection = z.infer<typeof XpandInspectionSchema>
export type DetailedXpandInspectionRemark = z.infer<
  typeof DetailedXpandInspectionRemarkSchema
>
export type DetailedXpandInspectionRoom = z.infer<
  typeof DetailedXpandInspectionRoomSchema
>
export type DetailedXpandInspection = z.infer<
  typeof DetailedXpandInspectionSchema
>
