import { describe, expect, it } from 'vitest'

import type { ComponentSubtype } from '@/services/types'

import { formatSubtypePath } from './subtypePath'

const subtype = (componentType?: unknown) =>
  ({ id: 's1', subTypeName: 'Kylskåp', componentType }) as ComponentSubtype

describe('formatSubtypePath', () => {
  it('names the category and the type', () => {
    expect(
      formatSubtypePath(
        subtype({ typeName: 'Kyl', category: { categoryName: 'Vitvaror' } })
      )
    ).toBe('Vitvaror / Kyl')
  })

  it('leaves out what the response lacks', () => {
    expect(formatSubtypePath(subtype({ typeName: 'Kyl' }))).toBe('Kyl')
    expect(formatSubtypePath(subtype())).toBe('')
  })
})
