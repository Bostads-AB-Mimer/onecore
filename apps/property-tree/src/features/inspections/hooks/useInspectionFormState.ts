import { useCallback, useState } from 'react'

import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import {
  createAdHocRoom,
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

// Build a synthetic Room object for an ad-hoc room recovered from persisted
// draft data. Used when the draft contains a roomId that isn't in the current
// Xpand rooms list — e.g. a room the inspector created on the fly in a
// previous session.
const rehydrateAdHocRoom = (
  roomId: string,
  name: string | undefined
): Room => ({
  id: roomId,
  propertyObjectId: '',
  code: '',
  // Fallback label if persisted data somehow lacks a name (e.g. draft saved
  // before this field existed).
  name: name ?? 'Okänt rum',
  usage: { shared: false, allowPeriodicWorks: false, spaceType: 0 },
  features: {
    hasToilet: false,
    isHeated: false,
    hasThermostatValve: false,
    orientation: 0,
  },
  dates: {
    installation: null,
    from: '',
    to: '',
    availableFrom: null,
    availableTo: null,
  },
  sortingOrder: 0,
  deleted: false,
  timestamp: '',
  roomType: null,
})

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
      .map((r) => rehydrateAdHocRoom(r.roomId, r.name))
    return [...initialRooms, ...adHocRooms]
  })

  const [inspectionData, setInspectionData] = useState<
    Record<string, InspectionRoom>
  >(() => {
    if (existingInspection?.rooms && existingInspection.rooms.length > 0) {
      // Convert array of rooms to Record keyed by roomId
      // Ensure detailComponents defaults for rooms saved before the field existed
      return existingInspection.rooms.reduce(
        (acc, room) => {
          acc[room.roomId] = {
            ...room,
            detailComponents: room.detailComponents ?? [],
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
