import { z } from 'zod'

export const INSPECTION_STATUS_FILTER = {
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
} as const

// Inspector-driven safety/utility checks performed during the inspection.
// Persisted as JSON in the inspection.checklist column. New (MIM-1818) and
// therefore optional + default everywhere so drafts saved before the column
// existed parse cleanly.
export const ChecklistSchema = z.object({
  groundFaultBreaker: z.boolean().default(false),
  smokeDetector: z.boolean().default(false),
  electricalSchema: z.boolean().default(false),
  electricalSystem: z.boolean().default(false),
})

export const CHECKLIST_DEFAULT = {
  groundFaultBreaker: false,
  smokeDetector: false,
  electricalSchema: false,
  electricalSystem: false,
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
  // Set on internal inspections from `InspectionComponent.costResponsibility`
  // or `InspectionRoom.componentCostResponsibilities`. Always null for xpand
  // remarks — the PDF generator falls back to a single SUMMA when every
  // remark in the inspection is null.
  costResponsibility: z.enum(['tenant', 'landlord']).nullable().default(null),
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
  // Optional + defaults so drafts created before MIM-1818 still parse.
  checklist: ChecklistSchema.optional().default(CHECKLIST_DEFAULT),
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
  // Optional + defaults so drafts saved before MIM-1818 still parse cleanly.
  condition: z.string().optional().default(''),
  cost: z.number().optional(),
  costResponsibility: z.enum(['tenant', 'landlord']).nullable().default(null),
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
    details: z.string(),
  }),
  actions: z.object({
    details: z.array(z.string()),
  }),
  componentNotes: z.object({
    details: z.string(),
  }),
  componentCosts: z.object({
    details: z.number().int().min(0).default(0),
  }),
  componentPhotos: z.object({
    details: z.array(z.string()),
  }),
  componentCostResponsibilities: z.object({
    details: z.enum(['tenant', 'landlord']).nullable().default(null),
  }),
  photos: z.array(z.string()),
  isApproved: z.boolean(),
  isHandled: z.boolean(),
  detailComponents: z.array(DetailComponentSchema).optional().default([]),
  components: z.array(InspectionComponentSchema).optional().default([]),
  // True when this room was added during the current inspection (vs. coming
  // from the property record). Populated by the inspection service via the
  // inspection_added_room tracking table.
  isAddedInThisInspection: z.boolean().optional().default(false),
})

export const InternalInspectionSchema = XpandInspectionSchema.extend({
  residenceId: z.string(),
  isFurnished: z.boolean(),
  startedAt: z.coerce.date().nullable(),
  endedAt: z.coerce.date().nullable(),
  isTenantPresent: z.boolean(),
  isNewTenantPresent: z.boolean(),
  hasRemarks: z.boolean(),
  notes: z.string().nullable(),
  totalCost: z.number().nullable(),
  remarkCount: z.number(),
  // Optional + defaults so drafts saved before MIM-1818 still parse cleanly.
  checklist: ChecklistSchema.optional().default(CHECKLIST_DEFAULT),
  rooms: z.array(InspectionRoomSchema).nullable(),
})

export const SaveInspectionDraftRequestSchema = z.object({
  inspectorName: z.string(),
  rooms: z.array(InspectionRoomSchema),
  isFurnished: z.boolean(),
  // Captured in the new "Kontrollfrågor" step. Optional so older clients that
  // haven't been updated yet still hit a valid save endpoint — the backend
  // applies sensible defaults (false / current persisted value).
  isTenantPresent: z.boolean().optional(),
  isNewTenantPresent: z.boolean().optional(),
  checklist: ChecklistSchema.optional(),
})

// Per-component result attached to the inspection PATCH response when an
// inspection transitions to "Genomförd". `message` is a Swedish UI-ready
// string, not an internal error code — the internal code lives in core logs.
export const ComponentWriteBackErrorSchema = z.object({
  componentId: z.string(),
  componentLabel: z.string(),
  message: z.string(),
})
