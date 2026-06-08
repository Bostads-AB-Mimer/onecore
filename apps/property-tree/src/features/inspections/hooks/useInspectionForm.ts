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
    formState.totalRooms,
    inspectorInfo.isChecklistComplete
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
    inspectionType: inspectorInfo.inspectionType,
    setInspectionType: inspectorInfo.setInspectionType,
    needsMasterKey: inspectorInfo.needsMasterKey,
    setNeedsMasterKey: inspectorInfo.setNeedsMasterKey,
    isFurnished: inspectorInfo.isFurnished,
    setIsFurnished: inspectorInfo.setIsFurnished,
    isTenantPresent: inspectorInfo.isTenantPresent,
    setIsTenantPresent: inspectorInfo.setIsTenantPresent,
    isNewTenantPresent: inspectorInfo.isNewTenantPresent,
    setIsNewTenantPresent: inspectorInfo.setIsNewTenantPresent,
    checklist: inspectorInfo.checklist,
    setChecklistItem: inspectorInfo.setChecklistItem,
    isChecklistComplete: inspectorInfo.isChecklistComplete,

    // Form state
    rooms: formState.rooms,
    inspectionData: formState.inspectionData,
    completedRooms: formState.completedRooms,
    totalRooms: formState.totalRooms,
    isAllRoomsComplete: formState.isAllRoomsComplete,

    // Append a server-issued room to the local state. The room has already
    // been created in Xpand by POST /inspections/internal/:id/rooms; this
    // callback only updates the in-memory inspection form so the inspector
    // can immediately fill it in.
    handleAddRoom: formState.addServerRoom,
    // Drop a server-deleted room from local state after a successful
    // DELETE /inspections/internal/:id/rooms/:roomId.
    handleRemoveRoom: formState.removeServerRoom,

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
    handleComponentCostResponsibilityUpdate:
      componentOps.updateComponentCostResponsibility,

    // Detail component operations
    handleDetailComponentAdd: componentOps.addDetailComponent,
    handleDetailComponentRemove: componentOps.removeDetailComponent,
    handleDetailComponentNoteUpdate: componentOps.updateDetailComponentNote,
    handleDetailComponentConditionUpdate:
      componentOps.updateDetailComponentCondition,
    handleDetailComponentCostUpdate: componentOps.updateDetailComponentCost,
    handleDetailComponentCostResponsibilityUpdate:
      componentOps.updateDetailComponentCostResponsibility,

    // Fetched component operations (keyed by componentId)
    handleComponentConditionUpdate: componentOps.updateComponentCondition,
    handleComponentActionUpdate: componentOps.updateComponentAction,
    handleComponentNoteUpdateById: componentOps.updateComponentNote,
    handleComponentPhotoAddById: componentOps.addComponentPhoto,
    handleComponentPhotoRemoveById: componentOps.removeComponentPhoto,
    handleComponentCostUpdateById: componentOps.updateComponentCostById,
    handleComponentCostResponsibilityUpdateById:
      componentOps.updateComponentCostResponsibilityById,
    handleMarkRoomNoRemarks: componentOps.markRoomNoRemarks,
    handleRoomHandledSet: componentOps.setRoomHandled,

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
