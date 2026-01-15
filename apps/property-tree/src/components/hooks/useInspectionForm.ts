import { useState, useCallback } from 'react'
import { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'
import { initializeInspectionData } from '@/components/residence/inspection/form/initialData'

type Inspection = components['schemas']['Inspection']
type InspectionRoom = components['schemas']['InspectionRoom']

export function useInspectionForm(
  rooms: Room[],
  existingInspection?: Inspection
) {
  const [inspectorName, setInspectorName] = useState(
    existingInspection?.inspector || ''
  )
  const [inspectionTime, setInspectionTime] = useState(() => {
    if (existingInspection?.date) {
      // Try to extract time from existing inspection
      return '10:00' // Default time if not available
    }
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  })
  const [needsMasterKey, setNeedsMasterKey] = useState(
    existingInspection?.masterKeyAccess || false
  )
  const [apartmentInfo, setApartmentInfo] = useState<{
    address: string
    masterKeyAccess: string
  }>({
    address: existingInspection?.address || 'Odenplan 5, lägenhet 1001',
    masterKeyAccess: existingInspection?.masterKeyAccess || 'true',
  })
  const [expandedRoomIds, setExpandedRoomIds] = useState<string[]>([])
  const [inspectionData, setInspectionData] = useState<
    Record<string, InspectionRoom>
  >(() => {
    if (existingInspection?.rooms && existingInspection.rooms.length > 0) {
      // Convert array of rooms to Record keyed by roomId
      return existingInspection.rooms.reduce(
        (acc, room) => {
          acc[room.roomId] = room
          return acc
        },
        {} as Record<string, InspectionRoom>
      )
    }
    return initializeInspectionData(rooms)
  })

  const handleCancel = () => {
    setInspectorName('')
    setExpandedRoomIds([])
    return
  }

  const handleToggleRoom = (roomId: string) => {
    setExpandedRoomIds((prev) => {
      if (prev.includes(roomId)) {
        return prev.filter((id) => id !== roomId)
      }
      return [...prev, roomId]
    })
  }

  const handleConditionUpdate = (
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

      // Check if all conditions are set to determine if room is handled
      const allConditionsSet = Object.values(updatedRoom.conditions).every(
        (condition) => condition && condition.trim() !== ''
      )

      updatedRoom.isHandled = allConditionsSet

      return {
        ...prev,
        [roomId]: updatedRoom,
      }
    })
  }

  const handleActionUpdate = (
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
  }

  const handleComponentNoteUpdate = (
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
  }

  const handleComponentPhotoAdd = useCallback(
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
    []
  )

  const handleComponentPhotoRemove = useCallback(
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
    []
  )

  return {
    inspectorName,
    setInspectorName,
    inspectionTime,
    setInspectionTime,
    needsMasterKey,
    setNeedsMasterKey,
    apartmentInfo,
    setApartmentInfo,
    expandedRoomIds,
    inspectionData,
    handleCancel,
    handleToggleRoom,
    handleConditionUpdate,
    handleActionUpdate,
    handleComponentNoteUpdate,
    handleComponentPhotoAdd,
    handleComponentPhotoRemove,
  }
}
