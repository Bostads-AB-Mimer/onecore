import { z } from 'zod'

// A trapphus of a building; name is typically the street address + entrance.
export const CostCenterTreeStaircaseSchema = z.object({
  code: z.string(),
  name: z.string().nullable(),
  residenceCount: z.number().int().nonnegative(),
  facilityCount: z.number().int().nonnegative(),
  otherCount: z.number().int().nonnegative(),
})

// A building of a property; buildingName is typically the street address.
// Counts cover ALL the building's objects (incl. staircase-less ones).
export const CostCenterTreeBuildingSchema = z.object({
  buildingCode: z.string(),
  buildingName: z.string().nullable(),
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

// Markområde (bayta) containing parking spaces; code = the shared prefix of
// its spaces' rental object codes (e.g. '607-705-00').
export const CostCenterTreeParkingAreaSchema = z.object({
  code: z.string(),
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
