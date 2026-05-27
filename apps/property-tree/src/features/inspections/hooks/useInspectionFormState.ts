import { useCallback, useState } from 'react'

import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import {
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
  addServerRoom: (room: Room) => void
  removeServerRoom: (roomId: string) => void
  completedRooms: number
  totalRooms: number
  isAllRoomsComplete: boolean
}

export function useInspectionFormState(
  initialRooms: Room[],
  existingInspection?: Inspection
): UseInspectionFormStateReturn {
  // Rooms list is stateful so the inspector can append new rooms (created
  // server-side via POST /inspections/internal/:id/rooms) via
  // InspectionMoreMenu without a page reload.
  const [rooms, setRooms] = useState<Room[]>(initialRooms)

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
            // Default costResponsibility: null for components saved before
            // the field existed; Zod's server-side default covers writes.
            components: (room.components ?? []).map((c) => ({
              costResponsibility: null,
              ...c,
            })),
          }
          return acc
        },
        {} as Record<string, InspectionRoom>
      )
    }
    return initializeInspectionData(initialRooms)
  })

  // Append a server-issued Room (created via POST
  // /inspections/internal/:id/rooms) to local state. Idempotent: a duplicate
  // call is silently dropped — the room is already in the list.
  const addServerRoom = useCallback((room: Room): void => {
    setRooms((prev) =>
      prev.some((r) => r.id === room.id) ? prev : [...prev, room]
    )
    setInspectionData((prev) => {
      if (prev[room.id]) return prev
      return {
        ...prev,
        [room.id]: {
          ...initialRoomData,
          roomId: room.id,
          name: room.name ?? undefined,
        },
      }
    })
  }, [])

  // Symmetric to addServerRoom: drops a room from local state after a
  // successful DELETE /inspections/internal/:id/rooms/:roomId. The next
  // draftRooms save naturally omits the room.
  const removeServerRoom = useCallback((roomId: string): void => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId))
    setInspectionData((prev) => {
      if (!prev[roomId]) return prev
      const next = { ...prev }
      delete next[roomId]
      return next
    })
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
    addServerRoom,
    removeServerRoom,
    completedRooms,
    totalRooms,
    isAllRoomsComplete,
  }
}
