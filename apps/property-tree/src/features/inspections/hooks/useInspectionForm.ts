import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { useComponentInspection } from './useComponentInspection'
import { useInspectionFormState } from './useInspectionFormState'
import { useInspectionValidation } from './useInspectionValidation'
import { useInspectorInfo } from './useInspectorInfo'
import { useRoomInspection } from './useRoomInspection'

type Inspection = components['schemas']['InternalInspection']

export function useInspectionForm(
  rooms: Room[],
  existingInspection?: Inspection
) {
  // Inspector metadata (name, time, master key)
  const inspectorInfo = useInspectorInfo(existingInspection)

  // Inspection data state (rooms, conditions, actions, notes, photos). The
  // `rooms` arg is the initial list; formState.rooms is the mutable version
  // that includes any ad-hoc rooms added via the "Lägg till rum/utrymme"
  // action and any ad-hoc rooms rehydrated from a persisted draft.
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
    isFurnished: inspectorInfo.isFurnished,
    setIsFurnished: inspectorInfo.setIsFurnished,

    // Form state
    rooms: formState.rooms,
    inspectionData: formState.inspectionData,
    completedRooms: formState.completedRooms,
    totalRooms: formState.totalRooms,
    isAllRoomsComplete: formState.isAllRoomsComplete,

    // Ad-hoc room creation (returns the newly-created Room so callers can
    // navigate to it — e.g. mobile auto-focuses the new room card)
    handleAddRoom: formState.addAdHocRoom,

    // Room operations
    expandedRoomIds: roomOps.expandedRoomIds,
    handleToggleRoom: roomOps.toggleRoom,

    // Component operations (maintain original names for compatibility)
    handleConditionUpdate: componentOps.updateCondition,
    handleActionUpdate: componentOps.updateAction,
    handleComponentNoteUpdate: componentOps.updateNote,
    handleComponentCostUpdate: componentOps.updateComponentCost,
    handleComponentPhotoAdd: componentOps.addPhoto,
    handleComponentPhotoRemove: componentOps.removePhoto,

    // Detail component operations
    handleDetailComponentAdd: componentOps.addDetailComponent,
    handleDetailComponentRemove: componentOps.removeDetailComponent,
    handleDetailComponentNoteUpdate: componentOps.updateDetailComponentNote,

    // Legacy handlers
    handleCancel,

    // Validation
    validation,
  }
}

// Re-export individual hooks for granular usage
export { useComponentInspection } from './useComponentInspection'
export { useInspectionFormState } from './useInspectionFormState'
export { useInspectionValidation } from './useInspectionValidation'
export { useInspectorInfo } from './useInspectorInfo'
export { useRoomInspection } from './useRoomInspection'
