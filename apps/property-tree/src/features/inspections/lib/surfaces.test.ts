import { describe, expect, it } from 'vitest'

import type { components as apiTypes } from '@/services/api/core/generated/api-types'
import type { ComponentModel } from '@/services/types'

import {
  findMissingSurfaces,
  getSurfaceCode,
  groupSurfaceModels,
  surfaceLabel,
  toActionComponentType,
} from './surfaces'

type FetchedComponent = apiTypes['schemas']['Component']

const component = (code?: string | null) =>
  ({
    id: `component-${code ?? 'none'}`,
    model: { subtype: { componentType: { code } } },
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

describe('groupSurfaceModels', () => {
  const painted = {
    subtypeId: 's1',
    subtypeName: 'Målad vägg',
    code: 'WALL',
    typeName: 'Vägg',
  }

  it('groups subtypes under the type code with the type name as label', () => {
    const groups = groupSurfaceModels([
      model({ id: 'm1', modelName: 'MÅLAS VIT', ...painted }),
      model({
        id: 'm2',
        modelName: 'Ekparkett',
        subtypeId: 's2',
        subtypeName: 'Parkett',
        code: 'FLOOR',
        typeName: 'Golv',
      }),
    ])

    expect(groups.get('WALL')).toEqual({
      typeName: 'Vägg',
      subtypes: [
        { subtypeId: 's1', subtypeName: 'Målad vägg', representativeModelId: 'm1' },
      ],
    })
    expect(groups.get('FLOOR')?.typeName).toBe('Golv')
  })

  it('picks the model named like its subtype as representative', () => {
    const groups = groupSurfaceModels([
      model({ id: 'm1', modelName: 'MÅLAS VIT', ...painted }),
      model({ id: 'm2', modelName: 'Målad vägg', ...painted }),
    ])

    expect(groups.get('WALL')?.subtypes[0].representativeModelId).toBe('m2')
  })

  it('falls back to the alphabetically first model', () => {
    const groups = groupSurfaceModels([
      model({ id: 'm1', modelName: 'NCS S 0500-N', ...painted }),
      model({ id: 'm2', modelName: 'Beige', ...painted }),
    ])

    expect(groups.get('WALL')?.subtypes[0].representativeModelId).toBe('m2')
  })

  it('sorts subtypes by name', () => {
    const groups = groupSurfaceModels([
      model({ id: 'm1', modelName: 'A', subtypeId: 's2', subtypeName: 'Tapet', code: 'WALL', typeName: 'Vägg' }),
      model({ id: 'm2', modelName: 'B', ...painted }),
    ])

    expect(groups.get('WALL')?.subtypes.map((s) => s.subtypeName)).toEqual([
      'Målad vägg',
      'Tapet',
    ])
  })

  it('skips models whose type has no surface code', () => {
    const groups = groupSurfaceModels([
      model({ id: 'm1', modelName: 'Bosch', subtypeId: 's9', subtypeName: 'Diskmaskin 60', code: null, typeName: 'Diskmaskin' }),
    ])

    expect(groups.size).toBe(0)
  })
})

describe('surfaceLabel', () => {
  it('uses the type name from the library when there is one', () => {
    const groups = groupSurfaceModels([
      model({ id: 'm1', modelName: 'A', subtypeId: 's1', subtypeName: 'Målad vägg', code: 'WALL', typeName: 'Väggar' }),
    ])

    expect(surfaceLabel('WALL', groups)).toBe('Väggar')
  })

  it('falls back to a Swedish label when the library has no models', () => {
    expect(surfaceLabel('CEILING', new Map())).toBe('Tak')
  })
})
