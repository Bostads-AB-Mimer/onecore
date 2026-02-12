import { useMemo } from 'react'

import type { InspectorInfo } from './useInspectorInfo'

export interface ValidationResult {
  canSaveDraft: boolean
  canComplete: boolean
  errors: string[]
}

export function useInspectionValidation(
  inspectorInfo: InspectorInfo,
  completedRooms: number,
  totalRooms: number
): ValidationResult {
  return useMemo(() => {
    const errors: string[] = []

    // Validate inspector name
    if (!inspectorInfo.inspectorName.trim()) {
      errors.push('Inspector name is required')
    }

    // Can save draft if basic info is present
    const canSaveDraft = inspectorInfo.inspectorName.trim().length > 0

    // Can complete only if all rooms are handled
    const canComplete = canSaveDraft && completedRooms === totalRooms

    // Add completion error if applicable
    if (!canComplete && completedRooms < totalRooms) {
      errors.push(`${totalRooms - completedRooms} rooms remaining`)
    }

    return {
      canSaveDraft,
      canComplete,
      errors,
    }
  }, [inspectorInfo.inspectorName, completedRooms, totalRooms])
}
