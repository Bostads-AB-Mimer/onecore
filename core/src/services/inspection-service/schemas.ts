import { z } from 'zod'
import { Lease } from '../lease-service/schemas/lease'
import { ResidenceByRentalIdSchema } from '../property-base-service/schemas'

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

export const InspectionRoomSchema = z.object({
  roomId: z.string(),
  conditions: z.object({
    wall1: z.string(),
    wall2: z.string(),
    wall3: z.string(),
    wall4: z.string(),
    floor: z.string(),
    ceiling: z.string(),
    details: z.string(),
  }),
  actions: z.object({
    wall1: z.array(z.string()),
    wall2: z.array(z.string()),
    wall3: z.array(z.string()),
    wall4: z.array(z.string()),
    floor: z.array(z.string()),
    ceiling: z.array(z.string()),
    details: z.array(z.string()),
  }),
  componentNotes: z.object({
    wall1: z.string(),
    wall2: z.string(),
    wall3: z.string(),
    wall4: z.string(),
    floor: z.string(),
    ceiling: z.string(),
    details: z.string(),
  }),
  componentPhotos: z.object({
    wall1: z.array(z.string()),
    wall2: z.array(z.string()),
    wall3: z.array(z.string()),
    wall4: z.array(z.string()),
    floor: z.array(z.string()),
    ceiling: z.array(z.string()),
    details: z.array(z.string()),
  }),
  photos: z.array(z.string()),
  isApproved: z.boolean(),
  isHandled: z.boolean(),
})

export const InspectionSchema = XpandInspectionSchema.extend({
  lease: Lease.nullable(),

  // TODO: rooms are nullable for now because xpand inspections currently lack this data
  rooms: z.array(InspectionRoomSchema).nullable(),
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

export const DetailedInspectionSchema = DetailedXpandInspectionSchema.extend({
  lease: Lease.nullable(),
  residence: ResidenceByRentalIdSchema.nullable(),
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
export type Inspection = z.infer<typeof InspectionSchema>
export type InspectionRoom = z.infer<typeof InspectionRoomSchema>
export type DetailedInspection = z.infer<typeof DetailedInspectionSchema>

// Tenant contact schemas for send-protocol feature
export const TenantContactSchema = z.object({
  fullName: z.string(),
  emailAddress: z.string(),
  contactCode: z.string(),
})

export const TenantInfoSchema = z.object({
  contacts: z.array(TenantContactSchema),
  contractId: z.string(),
})

export const TenantContactsResponseSchema = z.object({
  inspection: z.object({
    id: z.string(),
    address: z.string(),
    apartmentCode: z.string(),
  }),
  new_tenant: TenantInfoSchema.optional(),
  tenant: TenantInfoSchema.optional(),
})

export const SendProtocolRequestSchema = z.object({
  recipient: z.enum(['tenant', 'new-tenant']),
})

export const SendProtocolResponseSchema = z.object({
  success: z.boolean(),
  recipient: z.enum(['tenant', 'new-tenant']),
  sentTo: z.object({
    emails: z.array(z.string()),
    contactNames: z.array(z.string()),
    contractId: z.string(),
  }),
  error: z.string().optional(),
})

export type TenantContact = z.infer<typeof TenantContactSchema>
export type TenantInfo = z.infer<typeof TenantInfoSchema>
export type TenantContactsResponse = z.infer<
  typeof TenantContactsResponseSchema
>
export type SendProtocolRequest = z.infer<typeof SendProtocolRequestSchema>
export type SendProtocolResponse = z.infer<typeof SendProtocolResponseSchema>
