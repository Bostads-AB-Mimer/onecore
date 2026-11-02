import { describe, expect, it } from 'vitest'

import type { components as apiTypes } from '@/services/api/core/generated/api-types'

import { getFetchedComponentLabel } from './inspectionComponent'

type FetchedComponent = apiTypes['schemas']['Component']

describe('getFetchedComponentLabel', () => {
  it('uses the subtype name', () => {
    const c = {
      id: 'c1',
      subtype: { subTypeName: 'Målning väggar' },
    } as unknown as FetchedComponent
    expect(getFetchedComponentLabel(c)).toBe('Målning väggar')
  })

  it('falls back to the model name, then the id', () => {
    const withModel = {
      id: 'c1',
      model: { modelName: 'ESF5555' },
    } as unknown as FetchedComponent
    const bare = { id: 'c1' } as unknown as FetchedComponent
    expect(getFetchedComponentLabel(withModel)).toBe('ESF5555')
    expect(getFetchedComponentLabel(bare)).toBe('c1')
  })

  it('prefers the subtype name over the model name', () => {
    const c = {
      id: 'c1',
      subtype: { subTypeName: 'Diskmaskin 60 cm' },
      model: { modelName: 'ESF5555' },
    } as unknown as FetchedComponent
    expect(getFetchedComponentLabel(c)).toBe('Diskmaskin 60 cm')
  })
})
