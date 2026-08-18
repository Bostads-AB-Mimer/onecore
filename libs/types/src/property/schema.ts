import { z } from 'zod'

// ---- Rental object types ----
// The four kinds of rental object (Xpand balgh/babps/balok/bahyr). Imported
// rather than re-declared by the property service's rental-object schemas and
// core's mirror of them; the frontend reads it from the generated types those
// produce. Do not re-declare in consumers.
export const RENTAL_OBJECT_TYPES = [
  'residence',
  'parkingSpace',
  'facility',
  'other',
] as const

export const RentalObjectTypeSchema = z.enum(RENTAL_OBJECT_TYPES)

export type RentalObjectType = z.infer<typeof RentalObjectTypeSchema>

export const UpdateComponentInspectionStateSchema = z.object({
  condition: z.enum(['GOOD', 'FAIR', 'DAMAGED']),
  lastInspectionDate: z.string().datetime(),
})

export type UpdateComponentInspectionState = z.infer<
  typeof UpdateComponentInspectionStateSchema
>

// ---- Residence: Mälarenergi facility id ("Anläggnings ID Mälarenergi") ----
// Request body for upserting a residence's Mälarenergi facility id. Shared
// between the property service and the core proxy — source of truth, do not
// re-declare in either consumer.
export const UpdateMalarEnergiFacilityIdRequestSchema = z.object({
  malarEnergiFacilityId: z.string().trim().min(1),
})

// Response shape for the upsert — shared so neither the service nor the core
// proxy hand-declares it. Value is echoed back after a successful write.
export const UpdateMalarEnergiFacilityIdResponseSchema = z.object({
  malarEnergiFacilityId: z.string(),
})

// ---- Apartment temperatures (EcoGuard Curves) ----
// Public request/response shapes shared between the property service and the
// core proxy. Source of truth — do not re-declare these in either consumer.

export const ApartmentTemperaturesIntervalSchema = z.enum(['H', 'D'])

export const ApartmentTemperaturesQuerySchema = z
  .object({
    from: z.coerce.number().int().positive().optional(),
    to: z.coerce.number().int().positive().optional(),
    interval: ApartmentTemperaturesIntervalSchema.optional(),
  })
  .refine((q) => q.from === undefined || q.to === undefined || q.to > q.from, {
    message: '`to` must be greater than `from`',
    path: ['to'],
  })

export const ApartmentTemperaturePointSchema = z.object({
  time: z.number(),
  avg: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
})

export const ApartmentTemperatureSeriesSchema = z.object({
  subNodeId: z.number(),
  subNodeName: z.string(),
  points: z.array(ApartmentTemperaturePointSchema),
})

export const ApartmentTemperaturesResponseSchema = z.object({
  objectNumber: z.string(),
  nodeId: z.number(),
  from: z.number(),
  to: z.number(),
  interval: ApartmentTemperaturesIntervalSchema,
  unit: z.string(),
  series: z.array(ApartmentTemperatureSeriesSchema),
})

// Management areas (förvaltningsområden): a property belongs to one KVV-area
// (kvartersvärdsområde), which belongs to one cost center (= distrikt).
export const KvvAreaRefSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string().nullable(),
})

export const CostCenterRefSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
})

// Reverse lookup: property code → its KVV-area → cost center. The responsible
// kvartersvärd is a Keycloak user id here; core hydrates it to a user summary.
export const PropertyKvvAreaLookupSchema = z.object({
  kvvArea: KvvAreaRefSchema,
  costCenter: CostCenterRefSchema,
  responsibleKeycloakUserId: z.string().nullable(),
})

// One KVV-area as listed by GET /kvv-areas, with its cost center (distrikt).
export const KvvAreaWithCostCenterSchema = KvvAreaRefSchema.extend({
  costCenter: CostCenterRefSchema,
  responsibleKeycloakUserId: z.string().nullable(),
})

// Market area (Xpand babya, "marknadsområde") as listed by GET /market-areas.
// The id is a 15-char Xpand key, not a uuid.
export const MarketAreaSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
})
