import type { components } from '@/services/api/core/generated/api-types'

import { mergeComponentsWithDefaults } from '../constants/components'

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
  const rows = mergeComponentsWithDefaults(fetched)
  const defaultRows = rows.filter((r) => r.isDefault)
  const equipmentRows = rows.filter((r) => !r.isDefault)

  if (defaultRows.length === 0 && equipmentRows.length === 0) return false

  const componentsById = new Map(
    (room.components ?? []).map((c) => [c.componentId, c])
  )

  const surfacesDone = defaultRows.every((row) => {
    const key = row.key as keyof InspectionRoom['conditions']
    return room.conditions[key]?.trim() !== ''
  })
  const equipmentDone = equipmentRows.every((row) => {
    const id = row.componentId
    if (!id) return false
    return componentsById.get(id)?.condition?.trim() !== ''
  })

  return surfacesDone && equipmentDone
}
