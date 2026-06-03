import type { components } from '@/services/api/core/generated/api-types'

type InspectionRoom = components['schemas']['InspectionRoom']

export const EMPTY_COMPONENT_COST_RESPONSIBILITIES = {
  details: null,
}

// 'details' fields are initialized for backward compatibility with existing persisted data.
// New detail inspections use the detailComponents array instead.
export const initialRoomData: InspectionRoom = {
  roomId: '',
  conditions: {
    details: '',
  },
  actions: {
    details: [],
  },
  componentNotes: {
    details: '',
  },
  componentCosts: {
    details: 0,
  },
  componentPhotos: {
    details: [],
  },
  componentCostResponsibilities: { ...EMPTY_COMPONENT_COST_RESPONSIBILITIES },
  photos: [],
  isApproved: false,
  isHandled: false,
  detailComponents: [],
  components: [],
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
