import { z } from 'zod'
import { inspection, ALL_VALID_TYPE_CODES } from '@onecore/types'
import { Lease } from '../lease-service/schemas/lease'
import { ResidenceDetailsSchema } from '../property-base-service/schemas'

export const InspectionSchema = inspection.XpandInspectionSchema.extend({
  lease: Lease.nullable(),

  // TODO: rooms are nullable for now because xpand inspections currently lack this data
  rooms: z.array(inspection.InspectionRoomSchema).nullable(),
})

export const DetailedInspectionSchema =
  inspection.DetailedXpandInspectionSchema.extend({
    lease: Lease.nullable(),
    residence: ResidenceDetailsSchema.nullable(),
  })

export const INSPECTION_SOURCE = {
  XPAND: 'xpand',
  INTERNAL: 'internal',
} as const

export type InspectionSource =
  (typeof INSPECTION_SOURCE)[keyof typeof INSPECTION_SOURCE]

export const InspectionSourceSchema = z.enum([
  INSPECTION_SOURCE.XPAND,
  INSPECTION_SOURCE.INTERNAL,
])

export const InspectionWithSourceSchema =
  inspection.XpandInspectionSchema.extend({
    source: InspectionSourceSchema,
    lease: Lease.nullable(),
  })

export type InspectionWithSource = z.infer<typeof InspectionWithSourceSchema>
export type Inspection = z.infer<typeof InspectionSchema>
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
    apartmentCode: z.string().nullable(),
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

export const CreateInspectionRequestSchema =
  inspection.DetailedXpandInspectionSchema.omit({
    id: true,
    remarkCount: true,
  })

export type CreateInspectionRequest = z.infer<
  typeof CreateInspectionRequestSchema
>

export const UpdateInspectionStatusRequestSchema = z
  .object({
    status: z
      .enum(['Registrerad', 'Påbörjad', 'Genomförd'], {
        invalid_type_error: 'Invalid status value',
      })
      .optional(),
    inspector: z.string().min(1).optional(),
  })
  .refine((data) => data.status !== undefined || data.inspector !== undefined, {
    message: 'At least one field (status or inspector) must be provided',
  })

export type UpdateInspectionStatusRequest = z.infer<
  typeof UpdateInspectionStatusRequestSchema
>

// Body for POST /inspections/internal/:inspectionId/rooms. rentalId is
// looked up server-side from the inspection's residenceId. Type-specific
// defaults (features, usage, code) are handled by the property service —
// the inspector flow has no input for them.
export const AddInspectionRoomRequestSchema = z.object({
  roomTypeCode: z.enum(ALL_VALID_TYPE_CODES, {
    errorMap: () => ({
      message: `roomTypeCode must be one of: ${ALL_VALID_TYPE_CODES.join(', ')}`,
    }),
  }),
  caption: z.string().min(1).max(30).optional(),
})

export type AddInspectionRoomRequest = z.infer<
  typeof AddInspectionRoomRequestSchema
>

export type TenantContact = z.infer<typeof TenantContactSchema>
export type TenantInfo = z.infer<typeof TenantInfoSchema>
export type TenantContactsResponse = z.infer<
  typeof TenantContactsResponseSchema
>
export type SendProtocolRequest = z.infer<typeof SendProtocolRequestSchema>
export type SendProtocolResponse = z.infer<typeof SendProtocolResponseSchema>
