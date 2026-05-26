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
 * A room is handled when every fetched component has a non-empty `condition`.
 */
export function deriveRoomIsHandled(
  room: InspectionRoom,
  fetched: readonly FetchedComponent[]
): boolean {
  // No components to inspect (uteplats, balkong, etc) = nothing to handle, room is done
  if (fetched.length === 0) return true

  const componentsById = new Map(
    (room.components ?? []).map((c) => [c.componentId, c])
  )

  // Every fetched component must have a non‑empty condition on the room
  return fetched.every((comp) => {
    const stored = componentsById.get(comp.id)
    return Boolean(stored?.condition?.trim())
  })
}
