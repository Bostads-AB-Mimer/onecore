import { useCallback, useState } from 'react'

import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import {
  createAdHocRoom,
  EMPTY_COMPONENT_COST_RESPONSIBILITIES,
  initializeInspectionData,
  initialRoomData,
} from '../lib/initialFormData'

type Inspection = components['schemas']['InternalInspection']
type InspectionRoom = components['schemas']['InspectionRoom']

export interface UseInspectionFormStateReturn {
  rooms: Room[]
  inspectionData: Record<string, InspectionRoom>
  setInspectionData: React.Dispatch<
    React.SetStateAction<Record<string, InspectionRoom>>
  >
  addAdHocRoom: (name: string) => Room
  completedRooms: number
  totalRooms: number
  isAllRoomsComplete: boolean
}

export function useInspectionFormState(
  initialRooms: Room[],
  existingInspection?: Inspection
): UseInspectionFormStateReturn {
  // Rooms list is stateful so the inspector can append ad-hoc rooms via
  // InspectionMoreMenu. Rehydration also appends any ad-hoc rooms from the
  // persisted draft that aren't in the Xpand-sourced `initialRooms`.
  const [rooms, setRooms] = useState<Room[]>(() => {
    if (!existingInspection?.rooms?.length) return initialRooms
    const knownIds = new Set(initialRooms.map((r) => r.id))
    const adHocRooms = existingInspection.rooms
      .filter((r) => !knownIds.has(r.roomId))
      .map((r) => createAdHocRoom(r.name ?? 'Okänt rum', r.roomId))
    return [...initialRooms, ...adHocRooms]
  })

  const [inspectionData, setInspectionData] = useState<
    Record<string, InspectionRoom>
  >(() => {
    if (existingInspection?.rooms && existingInspection.rooms.length > 0) {
      // Convert array of rooms to Record keyed by roomId
      // Ensure detailComponents / componentCostResponsibilities defaults for rooms
      // saved before those fields existed
      return existingInspection.rooms.reduce(
        (acc, room) => {
          acc[room.roomId] = {
            ...room,
            detailComponents: room.detailComponents ?? [],
            componentCostResponsibilities:
              room.componentCostResponsibilities ?? {
                ...EMPTY_COMPONENT_COST_RESPONSIBILITIES,
              },
          }
          return acc
        },
        {} as Record<string, InspectionRoom>
      )
    }
    return initializeInspectionData(initialRooms)
  })

  const addAdHocRoom = useCallback((name: string): Room => {
    const newRoom = createAdHocRoom(name)
    setRooms((prev) => [...prev, newRoom])
    setInspectionData((prev) => ({
      ...prev,
      [newRoom.id]: {
        ...initialRoomData,
        roomId: newRoom.id,
        name,
      },
    }))
    return newRoom
  }, [])

  // Calculate completion metrics
  const completedRooms = Object.values(inspectionData).filter(
    (room) => room.isHandled
  ).length

  const totalRooms = rooms.length
  const isAllRoomsComplete = completedRooms === totalRooms

  return {
    rooms,
    inspectionData,
    setInspectionData,
    addAdHocRoom,
    completedRooms,
    totalRooms,
    isAllRoomsComplete,
  }
}
