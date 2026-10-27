import { z } from 'zod'

// ---- Rental object types ----
// The four kinds of rental object (Xpand balgh/babps/balok/bahyr). Source of
// truth — do not re-declare in consumers.
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
// Upsert request/response shared by the property service and the core proxy.
export const UpdateMalarEnergiFacilityIdRequestSchema = z.object({
  malarEnergiFacilityId: z.string().trim().min(1),
})

export const UpdateMalarEnergiFacilityIdResponseSchema = z.object({
  malarEnergiFacilityId: z.string(), // echoed back after a successful write
})

// ---- Apartment temperatures (EcoGuard Curves) ----
// Request/response shapes shared by the property service and the core proxy.
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

// Reverse lookup: property code → its KVV-area → cost center.
export const PropertyKvvAreaLookupSchema = z.object({
  kvvArea: KvvAreaRefSchema,
  costCenter: CostCenterRefSchema,
  responsibleKeycloakUserId: z.string().nullable(), // core expands to a user
})

// One KVV-area as listed by GET /kvv-areas, with its cost center (distrikt).
export const KvvAreaWithCostCenterSchema = KvvAreaRefSchema.extend({
  costCenter: CostCenterRefSchema,
  responsibleKeycloakUserId: z.string().nullable(),
})

// Market area (Xpand babya, "marknadsområde") as listed by GET /market-areas.
export const MarketAreaSchema = z.object({
  id: z.string(), // a 15-char Xpand key, not a uuid
  code: z.string(),
  name: z.string().nullable(),
})

// ---- Rental objects ----
// Shared by the property service and core's proxy. Source of truth — do not
// re-declare in consumers; core-only divergences are derived in core.

// One rental object (balgh/babps/balok/bahyr structure row): what it is,
// where it sits, and its postal address.
export const RentalObjectSummarySchema = z.object({
  rentalId: z.string(),
  type: RentalObjectTypeSchema,
  code: z.string().nullable(),
  name: z.string().nullable(),
  subtypeCode: z.string().nullable(), // filter key; unique only within type
  subtypeName: z.string().nullable(), // Xpand caption ("3 rum och kök", ...)
  address: z.string().nullable(),
  buildingCode: z.string().nullable(),
  staircaseCode: z.string().nullable(),
  staircaseName: z.string().nullable(), // trapphus groups derive from rows
  parkingAreaCode: z.string().nullable(),
  propertyCode: z.string().nullable(),
  propertyName: z.string().nullable(), // fastighetsbeteckning
})

export type RentalObjectSummary = z.infer<typeof RentalObjectSummarySchema>

// Listing-only values, keyed by rental id and kept out of the summary: only
// the object list shows them, so the tree and the picker never carry them.
export const RentalObjectDetailsSchema = z.object({
  rentalId: z.string(),
  baseRent: z.number().nullable(), // grundhyra (hyinf.akthyratot), monthly
  area: z.number().nullable(), // BRA (cmval); hyra per m² is derived
  additionalInfo: z.string().nullable(), // "annan information av vikt"
  malarEnergiFacilityId: z.string().nullable(), // "facility" = lokal, avoided
})

export type RentalObjectDetails = z.infer<typeof RentalObjectDetailsSchema>

// A subtype caption an object carries, scoped to its object type — the code
// is only unique within a type, so filters pass `type:code` pairs.
export const RentalObjectSubtypeSchema = z.object({
  type: RentalObjectTypeSchema,
  code: z.string(),
  name: z.string(),
})

export type RentalObjectSubtype = z.infer<typeof RentalObjectSubtypeSchema>

// ---- Property tree (any grouping) ----
// Ways of organising properties. Everything BELOW the property level is
// identical across groupings; only the levels above differ.
export const PropertyGroupingSchema = z.enum([
  'costCenter',
  'marketArea',
  'company',
])

export type PropertyGrouping = z.infer<typeof PropertyGroupingSchema>

export const PROPERTY_TREE_STRUCTURAL_TYPES = [
  'property',
  'building',
  'staircase',
  'parkingArea',
] as const

export const PROPERTY_TREE_NODE_TYPES = [
  ...PROPERTY_TREE_STRUCTURAL_TYPES,
  ...RENTAL_OBJECT_TYPES,
] as const

export type PropertyTreeNodeType = (typeof PROPERTY_TREE_NODE_TYPES)[number]

// One node shape per level below a group; leaves omit `children`. Depth is
// stamped via factories, not recursion: swagger's $refStrategy 'none'
// degrades self-references (and reused zod instances) to any/invalid TS.
const propertyTreeNodeFields = () => ({
  type: z.enum(PROPERTY_TREE_NODE_TYPES),
  code: z.string(), // the level's id: fstcode/bygcode/vancode/ytacode/rentalId
  name: z.string().nullable(),
  subtypeCode: z.string().nullable(),
  subtypeName: z.string().nullable(),
})

const propertyTreeLeaf = () => z.object(propertyTreeNodeFields())
const propertyTreeDepth1 = () =>
  z.object({
    ...propertyTreeNodeFields(),
    children: z.array(propertyTreeLeaf()).optional(),
  })
const propertyTreeDepth2 = () =>
  z.object({
    ...propertyTreeNodeFields(),
    children: z.array(propertyTreeDepth1()).optional(),
  })

export const PropertyTreeNodeSchema = z.object({
  ...propertyTreeNodeFields(),
  children: z.array(propertyTreeDepth2()).optional(),
})

export type PropertyTreeNode = z.infer<typeof PropertyTreeNodeSchema>
export type PropertyTreeChildNode = NonNullable<
  PropertyTreeNode['children']
>[number]

// The level between root and properties (KVV-areas for cost centers);
// groupings without one emit a single group mirroring the root.
export const PropertyTreeGroupSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  responsibleKeycloakUserId: z.string().nullable(), // core expands to a user
  properties: z.array(PropertyTreeNodeSchema),
})

// Root → groups → property nodes. Properties hang off groups only — naming a
// schema twice in one definition makes zod-to-json-schema emit a
// self-reference that openapi-typescript renders as invalid TS.
export const PropertyTreeSchema = z.object({
  grouping: PropertyGroupingSchema,
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  groups: z.array(PropertyTreeGroupSchema),
})

export type PropertyTree = z.infer<typeof PropertyTreeSchema>

// ---- Cost-center management tree ----
// Property level and below is identical for every grouping, so these blocks
// are shared by /cost-centers/:id/tree and the property tree above.

// A trapphus of a building. Code '99' is Xpand's catch-all for objects on the
// building but no entrance — often unnamed, holds building-level parking.
export const CostCenterTreeStaircaseSchema = z.object({
  code: z.string(),
  name: z.string().nullable(), // typically street address + entrance
  residenceCount: z.number().int().nonnegative(),
  parkingCount: z.number().int().nonnegative(),
  facilityCount: z.number().int().nonnegative(),
  otherCount: z.number().int().nonnegative(),
})

// A building of a property. Counts cover ALL the building's objects,
// staircase-less ones included.
export const CostCenterTreeBuildingSchema = z.object({
  buildingCode: z.string(),
  buildingName: z.string().nullable(), // typically the street address
  buildingType: z
    .object({
      code: z.string().nullable(),
      name: z.string().nullable(),
    })
    .nullable(),
  staircases: z.array(CostCenterTreeStaircaseSchema),
  residenceCount: z.number().int().nonnegative(),
  parkingCount: z.number().int().nonnegative(),
  facilityCount: z.number().int().nonnegative(),
  otherCount: z.number().int().nonnegative(),
})

export const CostCenterTreeAggregatesSchema = z.object({
  residenceCount: z.number().int().nonnegative(),
  parkingCount: z.number().int().nonnegative(),
  entranceCount: z.number().int().nonnegative(),
  facilityCount: z.number().int().nonnegative(),
  otherCount: z.number().int().nonnegative(),
})

// Markområde (bayta) containing parking spaces.
export const CostCenterTreeParkingAreaSchema = z.object({
  code: z.string(), // shared prefix of its spaces' codes, e.g. '607-705-00'
  name: z.string().nullable(),
  parkingCount: z.number().int().nonnegative(),
})

export const CostCenterTreePropertySchema = z.object({
  code: z.string(),
  designation: z.string().nullable(),
  tract: z.string().nullable(),
  buildings: z.array(CostCenterTreeBuildingSchema),
  parkingAreas: z.array(CostCenterTreeParkingAreaSchema),
  aggregates: CostCenterTreeAggregatesSchema,
})

export type CostCenterTreeProperty = z.infer<
  typeof CostCenterTreePropertySchema
>

// Keycloak ids at this layer; core expands them to user summaries.
export const CostCenterTreeKvvAreaSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string().nullable(),
  responsibleKeycloakUserId: z.string().nullable(),
  properties: z.array(CostCenterTreePropertySchema),
})

export const CostCenterTreeSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  leadKeycloakUserId: z.string().nullable(),
  deputyKeycloakUserId: z.string().nullable(),
  kvvAreas: z.array(CostCenterTreeKvvAreaSchema),
})

export type CostCenterTree = z.infer<typeof CostCenterTreeSchema>

export const CostCenterSummarySchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
})

export type CostCenterSummary = z.infer<typeof CostCenterSummarySchema>
