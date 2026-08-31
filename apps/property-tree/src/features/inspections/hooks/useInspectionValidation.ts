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
  totalRooms: number,
  isChecklistComplete: boolean
): ValidationResult {
  return useMemo(() => {
    const errors: string[] = []

    if (!inspectorInfo.inspectorName.trim()) {
      errors.push('Inspector name is required')
    }

    const canSaveDraft = inspectorInfo.inspectorName.trim().length > 0

    // Can complete only if all rooms are handled AND every checklist item in
    // the "Kontrollfrågor" step is checked.
    const allRoomsHandled = completedRooms === totalRooms
    const canComplete = canSaveDraft && allRoomsHandled && isChecklistComplete

    if (!allRoomsHandled) {
      errors.push(`${totalRooms - completedRooms} rooms remaining`)
    }
    if (!isChecklistComplete) {
      errors.push('Checklist incomplete')
    }

    return {
      canSaveDraft,
      canComplete,
      errors,
    }
  }, [
    inspectorInfo.inspectorName,
    completedRooms,
    totalRooms,
    isChecklistComplete,
  ])
}
