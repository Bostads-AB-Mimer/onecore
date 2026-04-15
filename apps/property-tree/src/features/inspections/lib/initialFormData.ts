import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

type InspectionRoom = components['schemas']['InspectionRoom']

// 'details' fields are initialized for backward compatibility with existing persisted data.
// New detail inspections use the detailComponents array instead.
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
  detailComponents: [],
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

/**
 * Build a synthetic Room for an ad-hoc inspection room. Used when the
 * inspector adds a room on the fly via InspectionMoreMenu because the
 * Xpand-sourced room list is incomplete. Only `id` and `name` drive the
 * UI — the remaining fields exist to satisfy the `Room` type shape and
 * are zero-valued placeholders (the synthetic room has no matching Xpand
 * record).
 */
export const createAdHocRoom = (name: string): Room => ({
  id: crypto.randomUUID(),
  propertyObjectId: '',
  code: '',
  name,
  usage: {
    shared: false,
    allowPeriodicWorks: false,
    spaceType: 0,
  },
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
