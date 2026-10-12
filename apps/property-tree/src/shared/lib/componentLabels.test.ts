import { describe, expect, it } from 'vitest'

import { formatComponentModelName } from './componentLabels'

describe('formatComponentModelName', () => {
  it('joins manufacturer and model name', () => {
    expect(
      formatComponentModelName({
        manufacturer: 'Electrolux',
        modelName: 'LKI6200S2W',
      })
    ).toBe('Electrolux LKI6200S2W')
  })

  it('leaves out the placeholder manufacturer', () => {
    expect(
      formatComponentModelName({
        manufacturer: 'Unknown',
        modelName: 'Okänd modell',
      })
    ).toBe('Okänd modell')
  })

  it('returns an empty string without a model', () => {
    expect(formatComponentModelName(null)).toBe('')
  })
})
