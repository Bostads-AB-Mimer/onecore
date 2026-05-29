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

type RemarkSeed = {
  remarkId: string
  buildingComponent: string
  notes: string
  cost: number
  costResponsibility: 'tenant' | 'landlord' | null
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

// Display mapping for condition strings that surface in the protocol PDF
// (Åtgärd column, when no explicit action was set). The stored value stays
// "Acceptabel" so we don't migrate historical data, but every user-facing
// surface — frontend label, PDF — renders it as "Ok".
const CONDITION_DISPLAY_LABEL: Record<string, string> = {
  Acceptabel: 'Ok',
}

const displayCondition = (condition: string): string =>
  CONDITION_DISPLAY_LABEL[condition] ?? condition

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
    // action list; fall back to the user-facing condition label so non-OK rows
    // without an explicit action still surface their state (and read as "Ok"
    // not "Acceptabel").
    remarkStatus: actionText || displayCondition(seed.condition),
    cost: seed.cost,
    costResponsibility: seed.costResponsibility,
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
  costResponsibility: component.costResponsibility ?? null,
  condition: component.condition,
  actions: component.action,
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
 * Flattens the components[] array inside an internal `InspectionRoom` into the
 * flat `DetailedXpandInspectionRoom` shape the PDF renderer already understands.
 *
 * Filters to surviving entries — those with a cost, an action, or a non-OK
 * condition — so the protocol doesn't degenerate into a list of OK components.
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
    ]

    const remarks = seeds.filter(shouldKeep).map(seedToRemark)

    return {
      room: resolveRoomLabel(room, roomsById),
      remarks,
    }
  })
}
