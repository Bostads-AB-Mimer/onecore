/**
 * Inspection Condition Constants
 *
 * Centralizes condition options and styling configurations.
 * Consolidates CONDITION_OPTIONS and CONDITION_CONFIG previously duplicated
 * across ComponentInspectionCard and ComponentDetailSheet.
 */

// Condition value constants
export const CONDITION_TYPE = {
  GOOD: 'God',
  ACCEPTABLE: 'Acceptabel',
  DAMAGED: 'Skadad',
} as const

export type ConditionType = (typeof CONDITION_TYPE)[keyof typeof CONDITION_TYPE]

// Unified condition configuration with styling
export const CONDITION_CONFIG = {
  [CONDITION_TYPE.GOOD]: {
    value: 'God',
    label: 'God',
    badgeVariant: 'default' as const,
    badgeClassName:
      'bg-green-500 hover:bg-green-600 text-white border-green-600',
    buttonClassName:
      'bg-green-500 hover:bg-green-600 text-white border-green-600',
  },
  [CONDITION_TYPE.ACCEPTABLE]: {
    value: 'Acceptabel',
    label: 'Acceptabel',
    badgeVariant: 'secondary' as const,
    badgeClassName:
      'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600',
    buttonClassName:
      'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600',
  },
  [CONDITION_TYPE.DAMAGED]: {
    value: 'Skadad',
    label: 'Skadad',
    badgeVariant: 'destructive' as const,
    badgeClassName:
      'bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive',
    buttonClassName:
      'bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive',
  },
} as const

/**
 * Condition options array for UI rendering
 * Use this when you need an array of all condition options (e.g., for mapping)
 */
export const CONDITION_OPTIONS = Object.values(CONDITION_CONFIG)

/**
 * Get condition configuration for a given condition value
 * @param condition - The condition string
 * @returns Condition configuration object or null if not found
 */
export function getConditionConfig(condition?: string) {
  if (!condition || !(condition in CONDITION_CONFIG)) return null
  return CONDITION_CONFIG[condition as ConditionType]
}

/**
 * Check if a value is a valid condition type
 * @param value - The value to check
 * @returns true if value is a valid ConditionType
 */
export function isValidCondition(value: string): value is ConditionType {
  return Object.values(CONDITION_TYPE).includes(value as ConditionType)
}

/**
 * Get badge class name for a condition
 * @param condition - The condition string
 * @returns CSS class name string or empty string if not found
 */
export function getConditionBadgeClassName(condition?: string): string {
  const config = getConditionConfig(condition)
  return config?.badgeClassName || ''
}

/**
 * Get button class name for a condition
 * @param condition - The condition string
 * @returns CSS class name string or empty string if not found
 */
export function getConditionButtonClassName(condition?: string): string {
  const config = getConditionConfig(condition)
  return config?.buttonClassName || ''
}
