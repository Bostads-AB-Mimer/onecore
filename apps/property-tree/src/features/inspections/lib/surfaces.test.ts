import { describe, expect, it } from 'vitest'

import type { components as apiTypes } from '@/services/api/core/generated/api-types'
import type { ComponentSubtype } from '@/services/types'

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

const subtype = (s: {
  id: string
  subTypeName: string
  code?: string | null
  typeName?: string
}) =>
  ({
    id: s.id,
    subTypeName: s.subTypeName,
    componentType: { code: s.code, typeName: s.typeName },
  }) as unknown as ComponentSubtype

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
  it('groups subtypes by surface code, sorted by name', () => {
    const groups = groupSurfaceSubtypes([
      subtype({
        id: 's2',
        subTypeName: 'Målning väggar',
        code: 'WALL',
        typeName: 'Vägg',
      }),
      subtype({
        id: 's1',
        subTypeName: 'Kakel',
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

  it('puts the Ospecificerad subtype first', () => {
    const groups = groupSurfaceSubtypes([
      subtype({ id: 's1', subTypeName: 'Kakel', code: 'WALL' }),
      subtype({ id: 's2', subTypeName: 'Ospecificerad vägg', code: 'WALL' }),
      subtype({ id: 's3', subTypeName: 'Tapet', code: 'WALL' }),
    ])

    expect(
      groups.get('WALL')?.subtypes.map((option) => option.subtypeId)
    ).toEqual(['s2', 's1', 's3'])
  })

  it('lists a subtype once even when it appears twice', () => {
    const s = subtype({
      id: 's2',
      subTypeName: 'Målning väggar',
      code: 'WALL',
      typeName: 'Vägg',
    })

    const groups = groupSurfaceSubtypes([s, s])

    expect(groups.get('WALL')?.subtypes).toEqual([
      { subtypeId: 's2', subtypeName: 'Målning väggar' },
    ])
  })

  it('skips subtypes without a surface code', () => {
    const groups = groupSurfaceSubtypes([
      subtype({
        id: 's9',
        subTypeName: 'Diskmaskin 60',
        code: null,
        typeName: 'Diskmaskin',
      }),
    ])

    expect(groups.size).toBe(0)
  })

  it('falls back to the Swedish label when the type has no name', () => {
    const groups = groupSurfaceSubtypes([
      subtype({ id: 's1', subTypeName: 'Parkett', code: 'FLOOR' }),
    ])

    expect(groups.get('FLOOR')?.typeName).toBe('Golv')
  })

  it('skips a subtype without a name', () => {
    const groups = groupSurfaceSubtypes([
      subtype({ id: 's1', subTypeName: '', code: 'WALL', typeName: 'Vägg' }),
    ])

    expect(groups.size).toBe(0)
  })
})

describe('surfaceLabel', () => {
  it('uses the type name from the library when there is one', () => {
    const groups = groupSurfaceSubtypes([
      subtype({
        id: 's1',
        subTypeName: 'Målad vägg',
        code: 'WALL',
        typeName: 'Väggar',
      }),
    ])

    expect(surfaceLabel('WALL', groups)).toBe('Väggar')
  })

  it('falls back to a Swedish label when the library has no subtypes', () => {
    expect(surfaceLabel('CEILING', new Map())).toBe('Tak')
  })
})
