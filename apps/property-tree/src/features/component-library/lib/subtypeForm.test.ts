import { describe, expect, it } from 'vitest'

import { buildSubtypeFields, subtypeNamePlaceholder } from './subtypeForm'

describe('subtypeNamePlaceholder', () => {
  it('uses the first two sibling names in Swedish order', () => {
    expect(subtypeNamePlaceholder(['Övrigt', 'Elspis 60 cm', 'Bänkspis'])).toBe(
      'T.ex. Bänkspis, Elspis 60 cm'
    )
  })

  it('asks for a name when the type has no subtypes yet', () => {
    expect(subtypeNamePlaceholder([])).toBe('Namn på undertypen')
    expect(subtypeNamePlaceholder(['  '])).toBe('Namn på undertypen')
  })
})

describe('buildSubtypeFields', () => {
  it('only changes the name placeholder', () => {
    const fields = buildSubtypeFields(['Kylskåp'])
    expect(fields.find((f) => f.name === 'subTypeName')?.placeholder).toBe(
      'T.ex. Kylskåp'
    )
    expect(fields.map((f) => f.name)).toContain('quantityType')
  })
})
