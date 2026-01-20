/**
 * Inspection Status Constants
 *
 * Centralizes all status-related constants and helpers.
 * Eliminates magic strings scattered across components.
 */

// Status value constants (Swedish labels as used by API)
export const INSPECTION_STATUS = {
  REGISTERED: 'Registrerad',
  IN_PROGRESS: 'Påbörjad',
  COMPLETED: 'Genomförd',
} as const

// Internal status types (for type safety)
export type InspectionStatusType =
  (typeof INSPECTION_STATUS)[keyof typeof INSPECTION_STATUS]

// Status display configuration
export const STATUS_CONFIG = {
  [INSPECTION_STATUS.REGISTERED]: {
    label: 'Registrerad',
    badgeVariant: 'secondary' as const,
    actionLabel: 'Starta besiktning',
  },
  [INSPECTION_STATUS.IN_PROGRESS]: {
    label: 'Påbörjad',
    badgeVariant: 'secondary' as const,
    actionLabel: 'Återuppta besiktning',
  },
  [INSPECTION_STATUS.COMPLETED]: {
    label: 'Genomförd',
    badgeVariant: 'default' as const,
    actionLabel: 'Visa protokoll',
  },
} as const

// Default config for unknown statuses
const DEFAULT_STATUS_CONFIG = {
  label: 'Okänd',
  badgeVariant: 'secondary' as const,
  actionLabel: 'Visa detaljer',
} as const

/**
 * Get status configuration for a given status value
 * @param status - The status string from the API
 * @returns Status configuration object with label, badge variant, and action label
 */
export function getStatusConfig(status?: string) {
  if (!status || !(status in STATUS_CONFIG)) {
    return DEFAULT_STATUS_CONFIG
  }
  return STATUS_CONFIG[status as InspectionStatusType]
}

/**
 * Check if inspection is completed
 * @param status - The status string
 * @returns true if status is 'Genomförd'
 */
export function isCompleted(status?: string): boolean {
  return status === INSPECTION_STATUS.COMPLETED
}

/**
 * Check if inspection can be resumed
 * @param status - The status string
 * @returns true if status is 'Påbörjad'
 */
export function canResume(status?: string): boolean {
  return status === INSPECTION_STATUS.IN_PROGRESS
}

/**
 * Check if inspection can be started
 * @param status - The status string
 * @returns true if status is 'Registrerad'
 */
export function canStart(status?: string): boolean {
  return status === INSPECTION_STATUS.REGISTERED
}
