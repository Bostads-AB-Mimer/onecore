import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

type InspectionRoom = components['schemas']['InspectionRoom']

export const EMPTY_COMPONENT_COST_RESPONSIBILITIES: InspectionRoom['componentCostResponsibilities'] =
  {
    wall1: null,
    wall2: null,
    wall3: null,
    wall4: null,
    floor: null,
    ceiling: null,
    details: null,
  }

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
  componentCosts: {
    wall1: 0,
    wall2: 0,
    wall3: 0,
    wall4: 0,
    floor: 0,
    ceiling: 0,
    details: 0,
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

/**
 * Build a synthetic Room for an ad-hoc inspection room. Used both when
 * the inspector adds a room on the fly (new UUID) and when rehydrating
 * an ad-hoc room from a persisted draft (existing id). Only `id` and
 * `name` drive the UI — the remaining fields exist to satisfy the `Room`
 * type shape and are zero-valued placeholders (the synthetic room has no
 * matching Xpand record).
 */
export const createAdHocRoom = (
  name: string,
  id: string = crypto.randomUUID()
): Room => ({
  id,
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
