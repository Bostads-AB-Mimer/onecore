import { inspection } from '@onecore/types'

import type { components as propertyBaseComponents } from '../../../adapters/property-base-adapter/generated/api-types'

type DetailedXpandInspectionRemark = inspection.DetailedXpandInspectionRemark
type DetailedXpandInspectionRoom = inspection.DetailedXpandInspectionRoom
type InspectionComponent = inspection.InspectionComponent
type InspectionRoom = inspection.InspectionRoom
type PropertyBaseRoom = propertyBaseComponents['schemas']['Room']

// Display labels for the legacy fixed-key data model. These match the labels
// the frontend uses (apps/property-tree/src/features/inspections/constants/components.ts)
// so the protocol reads identically across the two surfaces.
const FIXED_KEY_LABELS: Record<FixedKey, string> = {
  wall1: 'Vägg 1',
  wall2: 'Vägg 2',
  wall3: 'Vägg 3',
  wall4: 'Vägg 4',
  floor: 'Golv',
  ceiling: 'Tak',
  details: 'Övrigt',
}

const FIXED_KEYS = [
  'wall1',
  'wall2',
  'wall3',
  'wall4',
  'floor',
  'ceiling',
  'details',
] as const

type FixedKey = (typeof FIXED_KEYS)[number]

type RemarkSeed = {
  remarkId: string
  buildingComponent: string
  notes: string
  cost: number
  condition: string
  actions: string[]
}

// Mirrors apps/property-tree/.../ui/InspectionSummary.tsx#isReportable — the
// canonical convention for what counts as a remark in the internal vocabulary.
// "God" is the no-issue grade and is never reportable; only "Acceptabel" and
// "Skadad" carry a remark by virtue of their condition. An empty condition is
// treated as no grade (drop). Other reasons to keep — cost, action, note —
// still apply via `shouldKeep`.
const isReportableCondition = (condition: string): boolean => {
  const trimmed = condition.trim().toLowerCase()
  return trimmed === 'acceptabel' || trimmed === 'skadad'
}

const shouldKeep = (seed: RemarkSeed): boolean =>
  seed.cost > 0 ||
  seed.actions.length > 0 ||
  isReportableCondition(seed.condition) ||
  seed.notes.trim().length > 0

const seedToRemark = (seed: RemarkSeed): DetailedXpandInspectionRemark => {
  const actionText = seed.actions.filter((a) => a.trim().length > 0).join(', ')
  return {
    remarkId: seed.remarkId,
    location: null,
    buildingComponent: seed.buildingComponent,
    notes: seed.notes,
    remarkGrade: 0,
    // The PDF renders `remarkStatus` in the "Åtgärd" column. Prefer the joined
    // action list; fall back to the condition text so non-OK rows without an
    // explicit action still surface their state.
    remarkStatus: actionText || seed.condition,
    cost: seed.cost,
    invoice: false,
    quantity: 1,
    isMissing: false,
    fixedDate: null,
    workOrderCreated: false,
    workOrderStatus: null,
  }
}

const componentToSeed = (
  roomId: string,
  component: InspectionComponent
): RemarkSeed => ({
  remarkId: `${roomId}:${component.componentId}`,
  buildingComponent: component.label,
  notes: component.note,
  cost: component.cost ?? 0,
  condition: component.condition,
  actions: component.action,
})

const fixedKeyToSeed = (
  roomId: string,
  key: FixedKey,
  room: InspectionRoom
): RemarkSeed => ({
  remarkId: `${roomId}:${key}`,
  buildingComponent: FIXED_KEY_LABELS[key],
  notes: room.componentNotes[key] ?? '',
  cost: room.componentCosts[key] ?? 0,
  condition: room.conditions[key] ?? '',
  actions: room.actions[key] ?? [],
})

const resolveRoomLabel = (
  room: InspectionRoom,
  propertyBaseRoomsById: Map<string, PropertyBaseRoom>
): string => {
  if (room.name && room.name.trim().length > 0) return room.name
  const propertyRoom = propertyBaseRoomsById.get(room.roomId)
  if (propertyRoom?.name && propertyRoom.name.trim().length > 0) {
    return propertyRoom.name
  }
  return room.roomId
}

/**
 * Flattens the two parallel data models inside an internal `InspectionRoom`
 * (legacy `wall1..wall4`/`floor`/`ceiling`/`details` fixed keys, plus the
 * extensible `components[]` array) into the flat `DetailedXpandInspectionRoom`
 * shape the PDF renderer already understands.
 *
 * Filters to surviving entries — those with a cost, an action, or a non-OK
 * condition — so the protocol doesn't degenerate into a list of OK walls.
 *
 * Rooms with zero surviving entries still emit, but with an empty `remarks`
 * array; the renderer renders these as "Utan anmärkning" rows.
 */
export const mapInternalRoomsToProtocolRooms = (
  rooms: InspectionRoom[],
  propertyBaseRooms: PropertyBaseRoom[]
): DetailedXpandInspectionRoom[] => {
  const roomsById = new Map(propertyBaseRooms.map((r) => [r.id, r]))

  return rooms.map((room) => {
    const components: InspectionComponent[] = room.components ?? []
    const seeds: RemarkSeed[] = [
      ...components.map((c) => componentToSeed(room.roomId, c)),
      ...FIXED_KEYS.map((k) => fixedKeyToSeed(room.roomId, k, room)),
    ]

    const remarks = seeds.filter(shouldKeep).map(seedToRemark)

    return {
      room: resolveRoomLabel(room, roomsById),
      remarks,
    }
  })
}
