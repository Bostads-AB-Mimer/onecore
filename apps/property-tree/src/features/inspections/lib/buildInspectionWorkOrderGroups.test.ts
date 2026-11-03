import { describe, expect, it } from 'vitest'

import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { CONDITION_TYPE } from '../constants/conditions'
import {
  buildInspectionWorkOrderGroups,
  componentAssignmentKey,
  getDamagedComponents,
  workOrderGroupSignature,
} from './buildInspectionWorkOrderGroups'

type InspectionRoom = components['schemas']['InspectionRoom']

const rooms = [
  { id: 'r1', name: 'Kök', code: 'KOK' },
  { id: 'r2', name: 'Badrum', code: 'BAD' },
] as unknown as Room[]

const damaged = (componentId: string, label: string) => ({
  componentId,
  label,
  condition: CONDITION_TYPE.DAMAGED,
})

const inspectionData = {
  r1: {
    components: [
      damaged('comp-a', 'Diskmaskin'),
      damaged('comp-b', 'Spis'),
      { componentId: 'comp-ok', label: 'Fläkt', condition: 'good' },
    ],
    detailComponents: [
      {
        id: 'detail-1',
        label: 'Golvsockel',
        condition: CONDITION_TYPE.DAMAGED,
      },
    ],
  },
  r2: {
    components: [damaged('comp-c', 'Handfat')],
  },
} as unknown as Record<string, InspectionRoom>

const teams = [
  { id: 1, name: 'Snickare' },
  { id: 2, name: 'VVS' },
]

const key = (roomId: string, source: 'component' | 'detail', id: string) =>
  componentAssignmentKey(roomId, source, id)

describe('getDamagedComponents', () => {
  it('exposes the component id and its source', () => {
    const result = getDamagedComponents(inspectionData, rooms)

    expect(
      result.map(({ componentId, source }) => ({ componentId, source }))
    ).toEqual([
      { componentId: 'comp-a', source: 'component' },
      { componentId: 'comp-b', source: 'component' },
      { componentId: 'detail-1', source: 'detail' },
      { componentId: 'comp-c', source: 'component' },
    ])
  })
})

describe('buildInspectionWorkOrderGroups', () => {
  const meta = { id: 'INSP-1', address: 'Gatan 1' }

  it('gives each resursgrupp only its own component ids', () => {
    const assignments = {
      [key('r1', 'component', 'comp-a')]: 1,
      [key('r1', 'component', 'comp-b')]: 1,
      [key('r2', 'component', 'comp-c')]: 2,
    }

    const groups = buildInspectionWorkOrderGroups(
      getDamagedComponents(inspectionData, rooms),
      assignments,
      teams,
      meta
    )

    expect(
      groups.map(({ maintenanceTeamId, componentIds }) => ({
        maintenanceTeamId,
        componentIds,
      }))
    ).toEqual([
      { maintenanceTeamId: 1, componentIds: ['comp-a', 'comp-b'] },
      { maintenanceTeamId: 2, componentIds: ['comp-c'] },
    ])
  })

  it('excludes detail components, which are not OneCore components', () => {
    const assignments = {
      [key('r1', 'component', 'comp-a')]: 1,
      [key('r1', 'detail', 'detail-1')]: 1,
    }

    const [group] = buildInspectionWorkOrderGroups(
      getDamagedComponents(inspectionData, rooms),
      assignments,
      teams,
      meta
    )

    expect(group.componentIds).toEqual(['comp-a'])
    // The detail still appears in the description text.
    expect(group.componentLabels).toEqual(['Diskmaskin', 'Golvsockel'])
  })

  it('gives a group of only detail components no component ids', () => {
    const [group] = buildInspectionWorkOrderGroups(
      getDamagedComponents(inspectionData, rooms),
      { [key('r1', 'detail', 'detail-1')]: 1 },
      teams,
      meta
    )

    expect(group.componentIds).toEqual([])
  })

  it('deduplicates a component id that appears in two rooms', () => {
    const sharedData = {
      r1: { components: [damaged('comp-shared', 'Ventilation')] },
      r2: { components: [damaged('comp-shared', 'Ventilation')] },
    } as unknown as Record<string, InspectionRoom>

    const [group] = buildInspectionWorkOrderGroups(
      getDamagedComponents(sharedData, rooms),
      {
        [key('r1', 'component', 'comp-shared')]: 1,
        [key('r2', 'component', 'comp-shared')]: 1,
      },
      teams,
      meta
    )

    expect(group.componentIds).toEqual(['comp-shared'])
  })

  it('keeps the description text unchanged', () => {
    const [group] = buildInspectionWorkOrderGroups(
      getDamagedComponents(inspectionData, rooms),
      {
        [key('r1', 'component', 'comp-a')]: 1,
        [key('r1', 'detail', 'detail-1')]: 1,
        [key('r2', 'component', 'comp-c')]: 1,
      },
      teams,
      meta
    )

    expect(group.descriptionHtml).toBe(
      'Besiktning INSP-1 – Gatan 1<br><br>' +
        'Kök:<br>- Diskmaskin<br>- Golvsockel<br><br>' +
        'Badrum:<br>- Handfat'
    )
  })
})

describe('workOrderGroupSignature', () => {
  it('differs when only the component ids change', () => {
    // Two damaged components with the same label give the same description.
    const description = 'Besiktning INSP-1<br><br>Kök:<br>- Fönster'

    expect(
      workOrderGroupSignature({
        descriptionHtml: description,
        componentIds: ['window-1'],
      })
    ).not.toBe(
      workOrderGroupSignature({
        descriptionHtml: description,
        componentIds: ['window-2'],
      })
    )
  })

  it('is equal for the same description and ids', () => {
    const group = { descriptionHtml: 'A', componentIds: ['comp-a'] }

    expect(workOrderGroupSignature(group)).toBe(
      workOrderGroupSignature({ ...group, componentIds: ['comp-a'] })
    )
  })
})
