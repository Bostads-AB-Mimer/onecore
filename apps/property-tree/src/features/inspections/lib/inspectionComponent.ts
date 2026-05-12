import type { components } from '@/services/api/core/generated/api-types'

type InspectionRoom = components['schemas']['InspectionRoom']
type InspectionComponent = NonNullable<InspectionRoom['components']>[number]
type FetchedComponent = components['schemas']['Component']

export function emptyInspectionComponent(
  componentId: string,
  label: string
): InspectionComponent {
  return {
    componentId,
    label,
    condition: '',
    action: [],
    note: '',
    photos: [],
  }
}

/**
 * A room is handled when every visible row has a condition set.
 *
 * Visible rows are surface defaults (wall1–4, floor, ceiling) minus the ones
 * superseded by fetched components, plus the fetched components themselves.
 * Detail components (manual entries) are not counted.
 */
export function deriveRoomIsHandled(
  room: InspectionRoom,
  fetched: readonly FetchedComponent[]
): boolean {
  // No components = nothing to handle
  if (fetched.length === 0) return false

  const componentsById = new Map(
    (room.components ?? []).map((c) => [c.componentId, c])
  )

  // Every fetched component must have a non‑empty condition on the room
  return fetched.every((comp) => {
    const stored = componentsById.get(comp.id)
    return stored?.condition?.trim() !== ''
  })
}
