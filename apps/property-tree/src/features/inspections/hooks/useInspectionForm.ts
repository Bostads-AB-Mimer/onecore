import type { Room } from '@/services/types'
import type { components } from '@/services/api/core/generated/api-types'
import { useInspectorInfo } from './useInspectorInfo'
import { useInspectionFormState } from './useInspectionFormState'
import { useComponentInspection } from './useComponentInspection'
import { useRoomInspection } from './useRoomInspection'
import { useInspectionValidation } from './useInspectionValidation'

type Inspection = components['schemas']['Inspection']

export function useInspectionForm(
  rooms: Room[],
  existingInspection?: Inspection
) {
  // Inspector metadata (name, time, master key)
  const inspectorInfo = useInspectorInfo(existingInspection)

  // Inspection data state (rooms, conditions, actions, notes, photos)
  const formState = useInspectionFormState(rooms, existingInspection)

  // Component operations (CRUD for conditions, actions, notes, photos)
  const componentOps = useComponentInspection(formState.setInspectionData)

  // Room operations (expand/collapse for accordion UI)
  const roomOps = useRoomInspection()

  // Validation (can save draft, can complete)
  const validation = useInspectionValidation(
    inspectorInfo,
    formState.completedRooms,
    formState.totalRooms
  )

  // Legacy handleCancel for backward compatibility
  const handleCancel = () => {
    inspectorInfo.setInspectorName('')
    roomOps.collapseAll()
    return
  }

  // Return combined interface for backward compatibility
  return {
    // Inspector info
    inspectorName: inspectorInfo.inspectorName,
    setInspectorName: inspectorInfo.setInspectorName,
    inspectionTime: inspectorInfo.inspectionTime,
    setInspectionTime: inspectorInfo.setInspectionTime,
    needsMasterKey: inspectorInfo.needsMasterKey,
    setNeedsMasterKey: inspectorInfo.setNeedsMasterKey,

    // Form state
    inspectionData: formState.inspectionData,
    completedRooms: formState.completedRooms,
    totalRooms: formState.totalRooms,
    isAllRoomsComplete: formState.isAllRoomsComplete,

    // Room operations
    expandedRoomIds: roomOps.expandedRoomIds,
    handleToggleRoom: roomOps.toggleRoom,

    // Component operations (maintain original names for compatibility)
    handleConditionUpdate: componentOps.updateCondition,
    handleActionUpdate: componentOps.updateAction,
    handleComponentNoteUpdate: componentOps.updateNote,
    handleComponentPhotoAdd: componentOps.addPhoto,
    handleComponentPhotoRemove: componentOps.removePhoto,

    // Legacy handlers
    handleCancel,

    // Validation
    validation,
  }
}

// Re-export individual hooks for granular usage
export { useInspectorInfo } from './useInspectorInfo'
export { useInspectionFormState } from './useInspectionFormState'
export { useComponentInspection } from './useComponentInspection'
export { useRoomInspection } from './useRoomInspection'
export { useInspectionValidation } from './useInspectionValidation'
