/**
 * Inspection status filter constants
 */
export const INSPECTION_STATUS_FILTER = {
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
} as const

export type InspectionStatusFilter =
  (typeof INSPECTION_STATUS_FILTER)[keyof typeof INSPECTION_STATUS_FILTER]
