/**
 * Inspection Types
 *
 * Consolidated type definitions for the inspections module.
 * Single source of truth for all inspection-related types.
 */

// Re-export generated API types namespace
export type { components } from '@/services/api/core/generated/api-types'

// Domain types (from generated schemas)
import type { components } from '@/services/api/core/generated/api-types'

/**
 * Inspection type from API
 */
export type Inspection = components['schemas']['Inspection']

/**
 * Detailed inspection type with room remarks
 */
export type DetailedInspection = components['schemas']['DetailedInspection']

/**
 * Inspection room type with conditions, actions, notes, and photos
 */
export type InspectionRoom = components['schemas']['InspectionRoom']

/**
 * Internal inspection status type
 * Used for form state management
 */
export type InspectionStatus = 'draft' | 'in_progress' | 'completed'

/**
 * Tenant snapshot
 * Captures tenant information at the time of inspection
 */
export interface TenantSnapshot {
  name: string
  personalNumber: string
  phone?: string
  email?: string
}

/**
 * Residence information
 * Auto-populated from residence data
 */
export interface ResidenceInfo {
  id: string
  objectNumber: string
  address: string
  apartmentType: string | null
  size: number | null
}

// Checklist is defined in constants/checklist.ts (derived from the generated
// swagger types). Re-exported here for backward compatibility with existing
// import paths.
export type { Checklist } from '@/features/inspections/constants/checklist'

import type { Checklist } from '@/features/inspections/constants/checklist'

/**
 * Inspection submission data
 * Additional data needed when submitting an inspection
 */
export interface InspectionSubmitData {
  needsMasterKey: boolean
  isFurnished: boolean
  isTenantPresent: boolean
  isNewTenantPresent: boolean
  checklist: Checklist
  tenant?: TenantSnapshot
}

/**
 * Minimal view-model for the tenant info card.
 * Kept separate from the full `Tenant` type so callers can render the card
 * from different data sources.
 */
export interface TenantInfoCardData {
  contactCode: string
  fullName: string
  moveInDate?: string | null
  moveOutDate?: string | null
  isAboutToLeave?: boolean
}

/**
 * Form props types (shared between mobile/desktop)
 * Common props for inspection form components
 */
export interface InspectionFormProps {
  rooms: import('@/services/types').Room[]
  onSave: (
    inspectorName: string,
    rooms: Record<string, InspectionRoom>,
    status: 'draft' | 'completed',
    additionalData: InspectionSubmitData
  ) => void
  onCancel: () => void
  tenant?: any
  existingInspection: Inspection
}
