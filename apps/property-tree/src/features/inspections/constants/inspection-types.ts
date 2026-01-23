/**
 * Inspection Type Constants
 *
 * Defines inspection types and priorities.
 */

/**
 * Inspection type constants
 */
export const INSPECTION_TYPE = {
  MOVE_IN: 'inflytt',
  MOVE_OUT: 'avflytt',
} as const

export type InspectionType =
  (typeof INSPECTION_TYPE)[keyof typeof INSPECTION_TYPE]

/**
 * Inspection type labels (Swedish)
 */
export const INSPECTION_TYPE_LABELS = {
  [INSPECTION_TYPE.MOVE_IN]: 'Inflytt',
  [INSPECTION_TYPE.MOVE_OUT]: 'Avflytt',
} as const

/**
 * Get inspection type label
 * @param type - The inspection type value
 * @returns The human-readable label or 'Okänd' if not found
 */
export function getInspectionTypeLabel(type?: string): string {
  if (!type) return 'Okänd'
  return (
    INSPECTION_TYPE_LABELS[type as InspectionType] ||
    type.charAt(0).toUpperCase() + type.slice(1)
  )
}

/**
 * Check if a type is a valid inspection type
 * @param type - The type value to check
 * @returns true if the type is valid
 */
export function isValidInspectionType(type: string): type is InspectionType {
  return Object.values(INSPECTION_TYPE).includes(type as InspectionType)
}
