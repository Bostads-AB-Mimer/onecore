import { useCallback } from 'react'
import type { components } from '@/services/api/core/generated/api-types'

type InspectionRoom = components['schemas']['InspectionRoom']

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
  addPhoto: (
    roomId: string,
    field: keyof InspectionRoom['componentPhotos'],
    photoDataUrl: string
  ) => void
  removePhoto: (
    roomId: string,
    field: keyof InspectionRoom['componentPhotos'],
    photoIndex: number
  ) => void
}

export function useComponentInspection(
  setInspectionData: React.Dispatch<
    React.SetStateAction<Record<string, InspectionRoom>>
  >
): UseComponentInspectionReturn {
  /**
   * Update condition for a component in a room
   * Auto-calculates isHandled based on whether all conditions are set
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

        // Auto-calculate isHandled based on conditions
        const allConditionsSet = Object.values(updatedRoom.conditions).every(
          (condition) => condition && condition.trim() !== ''
        )
        updatedRoom.isHandled = allConditionsSet

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

  /**
   * Add photo to a component in a room
   */
  const addPhoto = useCallback(
    (
      roomId: string,
      field: keyof InspectionRoom['componentPhotos'],
      photoDataUrl: string
    ) => {
      setInspectionData((prev) => ({
        ...prev,
        [roomId]: {
          ...prev[roomId],
          componentPhotos: {
            ...prev[roomId].componentPhotos,
            [field]: [...prev[roomId].componentPhotos[field], photoDataUrl],
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

  return {
    updateCondition,
    updateAction,
    updateNote,
    addPhoto,
    removePhoto,
  }
}
