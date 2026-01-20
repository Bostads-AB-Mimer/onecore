import type { components } from '@/services/api/core/generated/api-types'

type InspectionRoom = components['schemas']['InspectionRoom']

export const initialRoomData: InspectionRoom = {
  roomId: '',
  conditions: {
    wall1: '',
    wall2: '',
    wall3: '',
    wall4: '',
    floor: '',
    ceiling: '',
    details: '',
  },
  actions: {
    wall1: [],
    wall2: [],
    wall3: [],
    wall4: [],
    floor: [],
    ceiling: [],
    details: [],
  },
  componentNotes: {
    wall1: '',
    wall2: '',
    wall3: '',
    wall4: '',
    floor: '',
    ceiling: '',
    details: '',
  },
  componentPhotos: {
    wall1: [],
    wall2: [],
    wall3: [],
    wall4: [],
    floor: [],
    ceiling: [],
    details: [],
  },
  photos: [],
  isApproved: false,
  isHandled: false,
}

export const initializeInspectionData = (rooms: { id: string }[]) => {
  const initialData: Record<string, InspectionRoom> = {}
  rooms.forEach((room) => {
    initialData[room.id] = {
      ...initialRoomData,
      roomId: room.id,
    }
  })
  return initialData
}
