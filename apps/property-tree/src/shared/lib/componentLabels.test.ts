import { describe, expect, it } from 'vitest'

import { formatComponentModelName, sortModelsByName } from './componentLabels'

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

describe('sortModelsByName', () => {
  it('sorts by the shown name and puts names without letters last', () => {
    const models = [
      { id: 'b', manufacturer: 'ELECTROLUX', modelName: '947941434' },
      { id: 'c', manufacturer: 'Unknown', modelName: '10' },
      { id: 'a', manufacturer: 'CYLINDA', modelName: 'IH 60' },
      { id: 'e', manufacturer: 'Unknown', modelName: '%' },
      { id: 'd', manufacturer: 'Unknown', modelName: '5' },
    ]
    expect(sortModelsByName(models).map((m) => m.id)).toEqual([
      'a',
      'b',
      'e',
      'd',
      'c',
    ])
  })

  it('sorts by the given label', () => {
    const models = [
      { id: 'b', manufacturer: 'ABB', modelName: 'Z 60' },
      { id: 'a', manufacturer: 'ZANUSSI', modelName: 'A 60' },
    ]
    expect(
      sortModelsByName(models, (model) => model.modelName).map((m) => m.id)
    ).toEqual(['a', 'b'])
  })

  it('leaves the input untouched', () => {
    const models = [
      { id: 'b', modelName: 'B' },
      { id: 'a', modelName: 'A' },
    ]
    sortModelsByName(models)
    expect(models[0].id).toBe('b')
  })
})
