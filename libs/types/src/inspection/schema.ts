import { z } from 'zod'

export const INSPECTION_STATUS_FILTER = {
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
} as const

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
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
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

export const DetailComponentSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  note: z.string(),
})

export const InspectionComponentSchema = z.object({
  componentId: z.string(),
  // Snapshot of the display label at inspection time so the summary still
  // reads correctly if the component is renamed or removed from property-base.
  label: z.string(),
  condition: z.string(),
  action: z.array(z.string()),
  note: z.string(),
  photos: z.array(z.string()),
  cost: z.number().optional(),
  costResponsibility: z.enum(['tenant', 'landlord']).nullable().default(null),
})

// Note: 'details' fields in conditions/actions/componentNotes/componentPhotos are kept
// for backward compatibility with existing persisted data. New detail inspections use
// the detailComponents array instead. The UI no longer renders these fields.
//
// The conditions/actions/componentNotes/componentPhotos/componentCosts/componentCostResponsibilities
// sub-shapes are intentionally inlined (rather than extracted into reusable z.object consts) so
// zod-to-json-schema sees independent instances at each site. Reusing a single instance across
// multiple fields here causes the OpenAPI generator to emit deep-path $refs (e.g.
// #/components/schemas/Inspection/properties/rooms/items/properties/conditions) which
// openapi-typescript can't translate, breaking the frontend api-types regen.
export const InspectionRoomSchema = z.object({
  roomId: z.string(),
  // Populated for ad-hoc rooms created by the inspector when the Xpand room
  // list is incomplete. Absent for rooms sourced from the property system —
  // their display name is resolved via the Room record from roomService.
  name: z.string().optional(),
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
  componentCosts: z.object({
    wall1: z.number().int().min(0).default(0),
    wall2: z.number().int().min(0).default(0),
    wall3: z.number().int().min(0).default(0),
    wall4: z.number().int().min(0).default(0),
    floor: z.number().int().min(0).default(0),
    ceiling: z.number().int().min(0).default(0),
    details: z.number().int().min(0).default(0),
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
  componentCostResponsibilities: z.object({
    wall1: z.enum(['tenant', 'landlord']).nullable().default(null),
    wall2: z.enum(['tenant', 'landlord']).nullable().default(null),
    wall3: z.enum(['tenant', 'landlord']).nullable().default(null),
    wall4: z.enum(['tenant', 'landlord']).nullable().default(null),
    floor: z.enum(['tenant', 'landlord']).nullable().default(null),
    ceiling: z.enum(['tenant', 'landlord']).nullable().default(null),
    details: z.enum(['tenant', 'landlord']).nullable().default(null),
  }),
  photos: z.array(z.string()),
  isApproved: z.boolean(),
  isHandled: z.boolean(),
  detailComponents: z.array(DetailComponentSchema).optional().default([]),
  components: z.array(InspectionComponentSchema).optional().default([]),
})

export const InternalInspectionSchema = XpandInspectionSchema.extend({
  residenceId: z.string(),
  isFurnished: z.boolean(),
  rooms: z.array(InspectionRoomSchema).nullable(),
})

export const SaveInspectionDraftRequestSchema = z.object({
  inspectorName: z.string(),
  rooms: z.array(InspectionRoomSchema),
  isFurnished: z.boolean(),
})
