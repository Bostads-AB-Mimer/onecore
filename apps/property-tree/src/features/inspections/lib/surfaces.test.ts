import { describe, expect, it } from 'vitest'

import type { components as apiTypes } from '@/services/api/core/generated/api-types'
import type { ComponentModel } from '@/services/types'

import {
  findMissingSurfaces,
  getSurfaceCode,
  groupSurfaceSubtypes,
  surfaceLabel,
  toActionComponentType,
} from './surfaces'

type FetchedComponent = apiTypes['schemas']['Component']

const component = (code?: string | null) =>
  ({
    id: `component-${code ?? 'none'}`,
    subtype: { componentType: { code } },
  }) as unknown as FetchedComponent

const model = (m: {
  id: string
  modelName: string
  subtypeId: string
  subtypeName: string
  code?: string | null
  typeName?: string
}) =>
  ({
    id: m.id,
    modelName: m.modelName,
    subtype: {
      id: m.subtypeId,
      subTypeName: m.subtypeName,
      componentType: { code: m.code, typeName: m.typeName },
    },
  }) as unknown as ComponentModel

describe('getSurfaceCode', () => {
  it('reads the code from the component type', () => {
    expect(getSurfaceCode(component('WALL'))).toBe('WALL')
  })

  it('is undefined when the type has no code', () => {
    expect(getSurfaceCode(component(null))).toBeUndefined()
    expect(getSurfaceCode({ id: 'x' } as FetchedComponent)).toBeUndefined()
  })
})

describe('toActionComponentType', () => {
  it('maps surface codes to inspection slots', () => {
    expect(toActionComponentType('WALL')).toBe('walls')
    expect(toActionComponentType('FLOOR')).toBe('floor')
    expect(toActionComponentType('CEILING')).toBe('ceiling')
  })

  it('falls back to details for anything else', () => {
    expect(toActionComponentType(undefined)).toBe('details')
    expect(toActionComponentType(null)).toBe('details')
    expect(toActionComponentType('ROOF')).toBe('details')
  })
})

describe('findMissingSurfaces', () => {
  it('lists the surface codes no component covers, in fixed order', () => {
    expect(findMissingSurfaces([component('FLOOR')])).toEqual([
      'WALL',
      'CEILING',
    ])
  })

  it('is empty when every surface is present', () => {
    expect(
      findMissingSurfaces([
        component('WALL'),
        component('FLOOR'),
        component('CEILING'),
      ])
    ).toEqual([])
  })

  it('ignores components without a surface code', () => {
    expect(findMissingSurfaces([component(null)])).toEqual([
      'WALL',
      'FLOOR',
      'CEILING',
    ])
  })
})

describe('groupSurfaceSubtypes', () => {
  it('lists each subtype once, sorted, without a model', () => {
    const groups = groupSurfaceSubtypes([
      model({
        id: 'm1',
        modelName: 'VIT',
        subtypeId: 's2',
        subtypeName: 'Målning väggar',
        code: 'WALL',
        typeName: 'Vägg',
      }),
      model({
        id: 'm2',
        modelName: 'GUL',
        subtypeId: 's2',
        subtypeName: 'Målning väggar',
        code: 'WALL',
        typeName: 'Vägg',
      }),
      model({
        id: 'm3',
        modelName: 'X',
        subtypeId: 's1',
        subtypeName: 'Kakel',
        code: 'WALL',
        typeName: 'Vägg',
      }),
    ])

    expect(groups.get('WALL')).toEqual({
      typeName: 'Vägg',
      subtypes: [
        { subtypeId: 's1', subtypeName: 'Kakel' },
        { subtypeId: 's2', subtypeName: 'Målning väggar' },
      ],
    })
  })

  it('skips models whose subtype has no surface code', () => {
    const groups = groupSurfaceSubtypes([
      model({
        id: 'm1',
        modelName: 'ESF5555',
        subtypeId: 's9',
        subtypeName: 'Diskmaskin 60',
        code: null,
        typeName: 'Diskmaskin',
      }),
    ])

    expect(groups.size).toBe(0)
  })

  it('falls back to the Swedish label when the type has no name', () => {
    const groups = groupSurfaceSubtypes([
      model({
        id: 'm1',
        modelName: 'X',
        subtypeId: 's1',
        subtypeName: 'Parkett',
        code: 'FLOOR',
      }),
    ])

    expect(groups.get('FLOOR')?.typeName).toBe('Golv')
  })
})

describe('surfaceLabel', () => {
  it('uses the type name from the library when there is one', () => {
    const groups = groupSurfaceSubtypes([
      model({
        id: 'm1',
        modelName: 'A',
        subtypeId: 's1',
        subtypeName: 'Målad vägg',
        code: 'WALL',
        typeName: 'Väggar',
      }),
    ])

    expect(surfaceLabel('WALL', groups)).toBe('Väggar')
  })

  it('falls back to a Swedish label when the library has no models', () => {
    expect(surfaceLabel('CEILING', new Map())).toBe('Tak')
  })
})
