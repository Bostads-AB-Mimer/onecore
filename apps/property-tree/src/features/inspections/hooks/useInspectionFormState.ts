import { useState } from 'react'
import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'
import { initializeInspectionData } from '../lib/initialFormData'

type Inspection = components['schemas']['Inspection']
type InspectionRoom = components['schemas']['InspectionRoom']

export interface UseInspectionFormStateReturn {
  inspectionData: Record<string, InspectionRoom>
  setInspectionData: React.Dispatch<
    React.SetStateAction<Record<string, InspectionRoom>>
  >
  completedRooms: number
  totalRooms: number
  isAllRoomsComplete: boolean
}

export function useInspectionFormState(
  rooms: Room[],
  existingInspection?: Inspection
): UseInspectionFormStateReturn {
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

  // Calculate completion metrics
  const completedRooms = Object.values(inspectionData).filter(
    (room) => room.isHandled
  ).length

  const totalRooms = rooms.length
  const isAllRoomsComplete = completedRooms === totalRooms

  return {
    inspectionData,
    setInspectionData,
    completedRooms,
    totalRooms,
    isAllRoomsComplete,
  }
}
