import { property } from '@onecore/types'

// Shared vocabulary (libs/types) — re-exported so local consumers keep their
// existing imports; do not re-declare it here. Core derives its own variant
// with the Keycloak ids expanded to user summaries.
export const {
  CostCenterTreeStaircaseSchema,
  CostCenterTreeBuildingSchema,
  CostCenterTreeAggregatesSchema,
  CostCenterTreeParkingAreaSchema,
  CostCenterTreePropertySchema,
  CostCenterTreeKvvAreaSchema,
  CostCenterTreeSchema,
  CostCenterSummarySchema,
} = property

export type CostCenterTreeProperty = property.CostCenterTreeProperty
export type CostCenterTree = property.CostCenterTree
export type CostCenterSummary = property.CostCenterSummary
