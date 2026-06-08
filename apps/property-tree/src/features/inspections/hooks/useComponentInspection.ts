import { useCallback } from 'react'

import type { components } from '@/services/api/core/generated/api-types'

import {
  CONDITION_TYPE,
  COST_RESPONSIBILITY,
  type CostResponsibility,
} from '../constants'

import { emptyInspectionComponent } from '../lib/inspectionComponent'

type InspectionRoom = components['schemas']['InspectionRoom']
type InspectionComponent = NonNullable<InspectionRoom['components']>[number]

export interface UseComponentInspectionReturn {
  updateCondition: (
    roomId: string,
    field: keyof InspectionRoom['conditions'],
    value: string
  ) => void
  updateAction: (
    roomId: string,
    field: keyof InspectionRoom['actions'],
    action: string
  ) => void
  updateNote: (
    roomId: string,
    field: keyof InspectionRoom['componentNotes'],
    note: string
  ) => void
  updateComponentCost: (
    roomId: string,
    field: keyof InspectionRoom['componentCosts'],
    cost: number
  ) => void
  addPhoto: (
    roomId: string,
    field: keyof InspectionRoom['componentPhotos'],
    photoPath: string
  ) => void
  removePhoto: (
    roomId: string,
    field: keyof InspectionRoom['componentPhotos'],
    photoIndex: number
  ) => void
  updateComponentCostResponsibility: (
    roomId: string,
    field: keyof InspectionRoom['componentCostResponsibilities'],
    value: CostResponsibility
  ) => void
  addDetailComponent: (
    roomId: string,
    component: { type: string; label: string }
  ) => void
  removeDetailComponent: (roomId: string, componentId: string) => void
  updateDetailComponentNote: (
    roomId: string,
    componentId: string,
    note: string
  ) => void
  updateDetailComponentCondition: (
    roomId: string,
    componentId: string,
    value: string
  ) => void
  updateDetailComponentCost: (
    roomId: string,
    componentId: string,
    cost: number
  ) => void
  updateDetailComponentCostResponsibility: (
    roomId: string,
    componentId: string,
    value: CostResponsibility
  ) => void
  updateComponentCondition: (
    roomId: string,
    componentId: string,
    label: string,
    value: string
  ) => void
  updateComponentAction: (
    roomId: string,
    componentId: string,
    label: string,
    action: string
  ) => void
  updateComponentNote: (
    roomId: string,
    componentId: string,
    label: string,
    note: string
  ) => void
  addComponentPhoto: (
    roomId: string,
    componentId: string,
    label: string,
    photoPath: string
  ) => void
  removeComponentPhoto: (
    roomId: string,
    componentId: string,
    label: string,
    photoIndex: number
  ) => void
  updateComponentCostById: (
    roomId: string,
    componentId: string,
    label: string,
    cost: number
  ) => void
  updateComponentCostResponsibilityById: (
    roomId: string,
    componentId: string,
    label: string,
    value: CostResponsibility
  ) => void
  markRoomNoRemarks: (
    roomId: string,
    components: ReadonlyArray<{ id: string; label: string }>
  ) => void
  setRoomHandled: (roomId: string, isHandled: boolean) => void
}

export function upsertComponent(
  components: readonly InspectionComponent[] | undefined,
  componentId: string,
  label: string,
  update: (existing: InspectionComponent) => InspectionComponent
): InspectionComponent[] {
  const list = components ?? []
  const index = list.findIndex((c) => c.componentId === componentId)
  if (index === -1) {
    return [...list, update(emptyInspectionComponent(componentId, label))]
  }
  // Keep label fresh: the source of truth is the live fetched list.
  return list.map((c, i) => (i === index ? update({ ...c, label }) : c))
}

export function useComponentInspection(
  setInspectionData: React.Dispatch<
    React.SetStateAction<Record<string, InspectionRoom>>
  >
): UseComponentInspectionReturn {
  /**
   * Update condition for a surface in a room.
   * isHandled is computed at save time (see deriveRoomIsHandled) because the
   * set of visible rows depends on fetched components, which this hook cannot
   * see.
   */
  const updateCondition = useCallback(
    (
      roomId: string,
      field: keyof InspectionRoom['conditions'],
      value: string
    ) => {
      setInspectionData((prev) => {
        const updatedRoom = {
          ...prev[roomId],
          conditions: {
            ...prev[roomId].conditions,
            [field]: value,
          },
        }

        // Cost and responsibility only apply to Skadad; clear both whenever
        // the condition is anything else (God/Ok) so stale data isn't
        // persisted. Mirrors updateComponentCondition for the fetched path.
        if (value !== CONDITION_TYPE.DAMAGED) {
          updatedRoom.componentCostResponsibilities = {
            ...updatedRoom.componentCostResponsibilities,
            [field]: null,
          }
          updatedRoom.componentCosts = {
            ...updatedRoom.componentCosts,
            [field]: 0,
          }
        }

        return {
          ...prev,
          [roomId]: updatedRoom,
        }
      })
    },
    [setInspectionData]
  )

  /**
   * Toggle an action for a component in a room
   * If action exists, removes it; if not, adds it
   */
  const updateAction = useCallback(
    (
      roomId: string,
      field: keyof InspectionRoom['actions'],
      action: string
    ) => {
      setInspectionData((prev) => {
        const currentActions = prev[roomId].actions[field]
        const newActions = currentActions.includes(action)
          ? currentActions.filter((a) => a !== action)
          : [...currentActions, action]

        return {
          ...prev,
          [roomId]: {
            ...prev[roomId],
            actions: {
              ...prev[roomId].actions,
              [field]: newActions,
            },
          },
        }
      })
    },
    [setInspectionData]
  )

  /**
   * Update note for a component in a room
   */
  const updateNote = useCallback(
    (
      roomId: string,
      field: keyof InspectionRoom['componentNotes'],
      note: string
    ) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          componentNotes: {
            ...prev[roomId].componentNotes,
            [field]: note,
          },
        },
      }))
    },
    [setInspectionData]
  )

  const updateComponentCost = useCallback(
    (
      roomId: string,
      field: keyof InspectionRoom['componentCosts'],
      cost: number
    ) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          componentCosts: {
            ...prev[roomId].componentCosts,
            [field]: cost,
          },
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Add photo to a component in a room
   */
  const addPhoto = useCallback(
    (
      roomId: string,
      field: keyof InspectionRoom['componentPhotos'],
      photoPath: string
    ) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          componentPhotos: {
            ...prev[roomId].componentPhotos,
            [field]: [...prev[roomId].componentPhotos[field], photoPath],
          },
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Remove photo from a component in a room
   */
  const removePhoto = useCallback(
    (
      roomId: string,
      field: keyof InspectionRoom['componentPhotos'],
      photoIndex: number
    ) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          componentPhotos: {
            ...prev[roomId].componentPhotos,
            [field]: prev[roomId].componentPhotos[field].filter(
              (_, i) => i !== photoIndex
            ),
          },
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Update cost responsibility for a component in a room
   */
  const updateComponentCostResponsibility = useCallback(
    (
      roomId: string,
      field: keyof InspectionRoom['componentCostResponsibilities'],
      value: CostResponsibility
    ) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          componentCostResponsibilities: {
            ...prev[roomId].componentCostResponsibilities,
            [field]: value,
          },
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Add a detail component to a room
   */
  const addDetailComponent = useCallback(
    (roomId: string, component: { type: string; label: string }) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          detailComponents: [
            ...(prev[roomId].detailComponents ?? []),
            {
              id: crypto.randomUUID(),
              type: component.type,
              label: component.label,
              note: '',
            },
          ],
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Remove a detail component from a room
   */
  const removeDetailComponent = useCallback(
    (roomId: string, componentId: string) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          detailComponents: (prev[roomId].detailComponents ?? []).filter(
            (c) => c.id !== componentId
          ),
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Update the note for a detail component
   */
  const updateDetailComponentNote = useCallback(
    (roomId: string, componentId: string, note: string) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          detailComponents: (prev[roomId].detailComponents ?? []).map((c) =>
            c.id === componentId ? { ...c, note } : c
          ),
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Update condition for a detail component. Mirrors updateComponentCondition:
   * when condition is anything other than Skadad, clear cost+responsibility so
   * stale Skadad values don't get persisted into the draft.
   */
  const updateDetailComponentCondition = useCallback(
    (roomId: string, componentId: string, value: string) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          detailComponents: (prev[roomId].detailComponents ?? []).map((c) =>
            c.id === componentId
              ? {
                  ...c,
                  condition: value,
                  ...(value !== CONDITION_TYPE.DAMAGED
                    ? { cost: 0, costResponsibility: null }
                    : {}),
                }
              : c
          ),
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Update cost (kr) for a detail component.
   */
  const updateDetailComponentCost = useCallback(
    (roomId: string, componentId: string, cost: number) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          detailComponents: (prev[roomId].detailComponents ?? []).map((c) =>
            c.id === componentId ? { ...c, cost } : c
          ),
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Update cost responsibility for a detail component. Landlord-borne costs
   * aren't entered by the inspector, so clear any previously entered cost when
   * switching to landlord (mirrors updateComponentCostResponsibilityById).
   */
  const updateDetailComponentCostResponsibility = useCallback(
    (roomId: string, componentId: string, value: CostResponsibility) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          detailComponents: (prev[roomId].detailComponents ?? []).map((c) =>
            c.id === componentId
              ? {
                  ...c,
                  costResponsibility: value,
                  ...(value === COST_RESPONSIBILITY.LANDLORD
                    ? { cost: 0 }
                    : {}),
                }
              : c
          ),
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Update condition for a fetched component (keyed by componentId).
   * Cost responsibility only applies to Skadad; clear it (and any cost) when
   * the condition becomes anything else so stale data isn't persisted. Mirrors
   * the surface-keyed rule in updateCondition.
   */
  const updateComponentCondition = useCallback(
    (roomId: string, componentId: string, label: string, value: string) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          components: upsertComponent(
            prev[roomId].components,
            componentId,
            label,
            (c) => ({
              ...c,
              condition: value,
              ...(value !== CONDITION_TYPE.DAMAGED
                ? { costResponsibility: null, cost: 0 }
                : {}),
            })
          ),
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Toggle an action on a fetched component.
   */
  const updateComponentAction = useCallback(
    (roomId: string, componentId: string, label: string, action: string) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          components: upsertComponent(
            prev[roomId].components,
            componentId,
            label,
            (c) => ({
              ...c,
              action: c.action.includes(action)
                ? c.action.filter((a) => a !== action)
                : [...c.action, action],
            })
          ),
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Update note on a fetched component.
   */
  const updateComponentNote = useCallback(
    (roomId: string, componentId: string, label: string, note: string) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          components: upsertComponent(
            prev[roomId].components,
            componentId,
            label,
            (c) => ({ ...c, note })
          ),
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Append a photo to a fetched component.
   */
  const addComponentPhoto = useCallback(
    (roomId: string, componentId: string, label: string, photoPath: string) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          components: upsertComponent(
            prev[roomId].components,
            componentId,
            label,
            (c) => ({ ...c, photos: [...c.photos, photoPath] })
          ),
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Explicitly set isHandled for a room. Driven by RoomInspectionEditor which
   * is the only place that sees both surface state and fetched components.
   * Guarded against no-op updates to prevent render loops.
   */
  const setRoomHandled = useCallback(
    (roomId: string, isHandled: boolean) => {
      setInspectionData((prev) => {
        if (!prev[roomId] || prev[roomId].isHandled === isHandled) return prev
        return {
          ...prev,
          [roomId]: { ...prev[roomId], isHandled },
        }
      })
    },
    [setInspectionData]
  )

  /**
   * Remove a photo by index from a fetched component.
   */
  const removeComponentPhoto = useCallback(
    (
      roomId: string,
      componentId: string,
      label: string,
      photoIndex: number
    ) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          components: upsertComponent(
            prev[roomId].components,
            componentId,
            label,
            (c) => ({
              ...c,
              photos: c.photos.filter((_, i) => i !== photoIndex),
            })
          ),
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Update cost for a fetched component (keyed by componentId).
   */
  const updateComponentCostById = useCallback(
    (roomId: string, componentId: string, label: string, cost: number) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          components: upsertComponent(
            prev[roomId].components,
            componentId,
            label,
            (c) => ({ ...c, cost })
          ),
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Update cost responsibility for a fetched component (keyed by componentId).
   */
  const updateComponentCostResponsibilityById = useCallback(
    (
      roomId: string,
      componentId: string,
      label: string,
      value: CostResponsibility
    ) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          components: upsertComponent(
            prev[roomId].components,
            componentId,
            label,
            (c) => ({
              ...c,
              costResponsibility: value,
              // Landlord-borne costs aren't entered by the inspector — clear
              // any previously entered tenant cost so it isn't persisted.
              ...(value === COST_RESPONSIBILITY.LANDLORD ? { cost: 0 } : {}),
            })
          ),
        },
      }))
    },
    [setInspectionData]
  )

  /**
   * Mark every still-ungraded fetched component in a room as God in one
   * update — "the rest of the room is clean, fill in the unfilled". Components
   * the inspector has already graded (Ok/Skadad) are left alone so the action
   * is non-destructive; a Skadad cost/responsibility won't get silently wiped.
   */
  const markRoomNoRemarks = useCallback(
    (
      roomId: string,
      components: ReadonlyArray<{ id: string; label: string }>
    ) => {
      setInspectionData((prev) => {
        let next = prev[roomId].components ?? []
        const gradedIds = new Set(
          next
            .filter((c) => c.condition.trim().length > 0)
            .map((c) => c.componentId)
        )
        for (const { id, label } of components) {
          if (gradedIds.has(id)) continue
          next = upsertComponent(next, id, label, (c) => ({
            ...c,
            condition: CONDITION_TYPE.GOOD,
            costResponsibility: null,
            cost: 0,
          }))
        }
        return {
          ...prev,
          [roomId]: {
            ...prev[roomId],
            components: next,
          },
        }
      })
    },
    [setInspectionData]
  )

  return {
    updateCondition,
    updateAction,
    updateNote,
    updateComponentCost,
    addPhoto,
    removePhoto,
    updateComponentCostResponsibility,
    addDetailComponent,
    removeDetailComponent,
    updateDetailComponentNote,
    updateDetailComponentCondition,
    updateDetailComponentCost,
    updateDetailComponentCostResponsibility,
    updateComponentCondition,
    updateComponentAction,
    updateComponentNote,
    addComponentPhoto,
    removeComponentPhoto,
    updateComponentCostById,
    updateComponentCostResponsibilityById,
    markRoomNoRemarks,
    setRoomHandled,
  }
}
