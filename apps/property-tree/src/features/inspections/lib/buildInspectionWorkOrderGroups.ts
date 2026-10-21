import type { MaintenanceTeam } from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { getActionLabel } from '../constants/actions'
import { CONDITION_TYPE } from '../constants/conditions'
import { COST_RESPONSIBILITY_LABEL } from '../constants/costResponsibility'

type InspectionRoom = components['schemas']['InspectionRoom']

export interface DamagedComponent {
  key: string
  // 'component' ids are OneCore component instance ids; 'detail' ids are
  // generated in the browser and must never reach Odoo.
  componentId: string
  source: 'component' | 'detail'
  roomName: string
  label: string
  actions: string[]
  note: string
  cost: number
  costResponsibility: 'tenant' | 'landlord' | null
}

export interface InspectionWorkOrderGroup {
  maintenanceTeamId: number
  maintenanceTeamName: string
  descriptionHtml: string
  componentLabels: string[]
  // OneCore component ids only (no detail components), deduplicated — Odoo
  // turns them into component rows on the request.
  componentIds: string[]
}

/**
 * What a group was submitted with. A group whose signature differs from the
 * one last sent is re-submitted. The ids are part of it because two damaged
 * components with the same label produce the same description.
 */
export const workOrderGroupSignature = (group: {
  descriptionHtml: string
  componentIds?: string[]
}): string => JSON.stringify([group.descriptionHtml, group.componentIds ?? []])

/**
 * Stable per-component key used both for the resursgrupp dropdown state in the
 * summary and for grouping at submit time. Scoped by room so the same component
 * id in two rooms doesn't collide.
 */
export const componentAssignmentKey = (
  roomId: string,
  source: 'component' | 'detail',
  componentId: string
): string => `${roomId}:${source}:${componentId}`

/**
 * Enumerates every Skadad component (fetched components + detail components)
 * across all rooms of the in-progress inspection form state.
 */
export const getDamagedComponents = (
  inspectionData: Record<string, InspectionRoom>,
  rooms: Room[]
): DamagedComponent[] => {
  const result: DamagedComponent[] = []

  for (const room of rooms) {
    const roomData = inspectionData[room.id]
    if (!roomData) continue
    const roomName = room.name ?? room.code

    for (const component of roomData.components ?? []) {
      if (component.condition !== CONDITION_TYPE.DAMAGED) continue
      result.push({
        key: componentAssignmentKey(
          room.id,
          'component',
          component.componentId
        ),
        componentId: component.componentId,
        source: 'component',
        roomName,
        label: component.label || component.componentId,
        actions: component.action ?? [],
        note: component.note ?? '',
        cost: component.cost ?? 0,
        costResponsibility: component.costResponsibility ?? null,
      })
    }

    for (const detail of roomData.detailComponents ?? []) {
      if (detail.condition !== CONDITION_TYPE.DAMAGED) continue
      result.push({
        key: componentAssignmentKey(room.id, 'detail', detail.id),
        componentId: detail.id,
        source: 'detail',
        roomName,
        label: detail.label || detail.id,
        actions: [],
        note: detail.note ?? '',
        cost: detail.cost ?? 0,
        costResponsibility: detail.costResponsibility ?? null,
      })
    }
  }

  return result
}

// descriptionHtml lands in an Odoo Html field — free-text values (labels,
// notes, room names, address) must be escaped or a stray `<` truncates the
// rendered work order when Odoo sanitizes the markup.
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const formatLine = (component: DamagedComponent): string => {
  let line = escapeHtml(component.label)
  if (component.actions.length > 0)
    line += ` – ${component.actions.map(getActionLabel).join(', ')}`
  if (component.note.trim()) line += `: ${escapeHtml(component.note.trim())}`

  if (component.cost > 0) {
    const responsibility = component.costResponsibility
      ? ` (${COST_RESPONSIBILITY_LABEL[component.costResponsibility]})`
      : ''
    line += `. Kostnad: ${component.cost} kr${responsibility}`
  }

  return `- ${line}`
}

/**
 * Groups the damaged components the inspector assigned to a resursgrupp into one
 * work order per team. The description is HTML (`<br>`-joined — Odoo's field is
 * Html), grouped by room. Components with no team assigned are excluded.
 */
export const buildInspectionWorkOrderGroups = (
  damaged: DamagedComponent[],
  assignments: Record<string, number>,
  teams: MaintenanceTeam[],
  meta: { id: string; address?: string }
): InspectionWorkOrderGroup[] => {
  const teamName = (id: number) =>
    teams.find((team) => team.id === id)?.name ?? `Resursgrupp ${id}`

  const byTeam = new Map<number, DamagedComponent[]>()
  for (const component of damaged) {
    const teamId = assignments[component.key]
    if (!teamId) continue
    byTeam.set(teamId, [...(byTeam.get(teamId) ?? []), component])
  }

  const header = meta.address
    ? `Besiktning ${meta.id} – ${escapeHtml(meta.address)}`
    : `Besiktning ${meta.id}`

  return [...byTeam.entries()].map(([teamId, components]) => {
    const byRoom = new Map<string, DamagedComponent[]>()
    for (const component of components) {
      byRoom.set(component.roomName, [
        ...(byRoom.get(component.roomName) ?? []),
        component,
      ])
    }

    const roomBlocks = [...byRoom.entries()].map(
      ([roomName, roomComponents]) =>
        `${escapeHtml(roomName)}:<br>${roomComponents.map(formatLine).join('<br>')}`
    )

    return {
      maintenanceTeamId: teamId,
      maintenanceTeamName: teamName(teamId),
      descriptionHtml: `${header}<br><br>${roomBlocks.join('<br><br>')}`,
      componentLabels: components.map((component) => component.label),
      componentIds: [
        ...new Set(
          components
            .filter((component) => component.source === 'component')
            .map((component) => component.componentId)
        ),
      ],
    }
  })
}
