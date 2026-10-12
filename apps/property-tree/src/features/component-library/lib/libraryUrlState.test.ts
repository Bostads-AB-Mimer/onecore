import { describe, expect, it } from 'vitest'

import {
  isLegacyLibraryUrl,
  parseViewState,
  toSearchParams,
  type ViewState,
  levelSearch,
  levelTitle,
  withCategoryType,
} from './libraryUrlState'

const base = {
  categoryId: 'cat-1',
  categoryName: 'Vitvaror',
  typeId: 'type-1',
  typeName: 'Spis',
  subtypeId: 'sub-1',
  subtypeName: 'Spis, 4 plattor',
}

const params = (record: Record<string, string>) => new URLSearchParams(record)

describe('parseViewState', () => {
  it('defaults to categories', () => {
    expect(parseViewState(params({}))).toEqual({ level: 'categories' })
  })

  it('falls back to categories when names are missing', () => {
    expect(
      parseViewState(params({ level: 'types', categoryId: 'cat-1' }))
    ).toEqual({ level: 'categories' })
  })

  it('reads the subtype page with the components tab by default', () => {
    expect(parseViewState(params({ level: 'subtype', ...base }))).toEqual({
      level: 'subtype',
      ...base,
      tab: 'components',
    })
  })

  it('reads the models tab and the model filter', () => {
    expect(
      parseViewState(
        params({ level: 'subtype', ...base, tab: 'models', modelId: 'm-1' })
      )
    ).toEqual({ level: 'subtype', ...base, tab: 'models', modelId: 'm-1' })
  })

  it('maps a legacy models link to the models tab', () => {
    expect(parseViewState(params({ level: 'models', ...base }))).toEqual({
      level: 'subtype',
      ...base,
      tab: 'models',
    })
  })

  it('maps a legacy instances link to the components tab filtered by model', () => {
    expect(
      parseViewState(
        params({
          level: 'instances',
          ...base,
          modelId: 'm-1',
          modelName: 'LKI6200S2W',
        })
      )
    ).toEqual({ level: 'subtype', ...base, tab: 'components', modelId: 'm-1' })
  })
})

describe('toSearchParams', () => {
  const roundTrip = (state: ViewState) => parseViewState(toSearchParams(state))

  it('round-trips every level', () => {
    const states: ViewState[] = [
      { level: 'categories' },
      { level: 'types', categoryId: 'cat-1', categoryName: 'Vitvaror' },
      {
        level: 'subtypes',
        categoryId: 'cat-1',
        categoryName: 'Vitvaror',
        typeId: 'type-1',
        typeName: 'Spis',
      },
      { level: 'subtype', ...base, tab: 'components' },
      { level: 'subtype', ...base, tab: 'models', modelId: 'm-1' },
    ]
    for (const state of states) expect(roundTrip(state)).toEqual(state)
  })

  it('leaves the default tab out of the URL', () => {
    expect(
      toSearchParams({ level: 'subtype', ...base, tab: 'components' }).has(
        'tab'
      )
    ).toBe(false)
  })
})

describe('isLegacyLibraryUrl', () => {
  it('flags the removed levels only', () => {
    expect(isLegacyLibraryUrl(params({ level: 'models' }))).toBe(true)
    expect(isLegacyLibraryUrl(params({ level: 'instances' }))).toBe(true)
    expect(isLegacyLibraryUrl(params({ level: 'subtype' }))).toBe(false)
    expect(isLegacyLibraryUrl(params({}))).toBe(false)
  })
})

describe('withCategoryType', () => {
  const subtype: ViewState = {
    level: 'subtype',
    ...base,
    tab: 'models',
    modelId: 'model-1',
  }

  it('sends a surface subtype to the components tab without a model filter', () => {
    expect(withCategoryType(subtype, 'SURFACE')).toEqual({
      level: 'subtype',
      ...base,
      tab: 'components',
    })
  })

  it('keeps an equipment subtype as it is', () => {
    expect(withCategoryType(subtype, 'EQUIPMENT')).toBe(subtype)
  })

  it('keeps the state while the category type is loading', () => {
    expect(withCategoryType(subtype, undefined)).toBe(subtype)
  })
})

describe('levelTitle', () => {
  it('names the level being shown', () => {
    expect(levelTitle({ level: 'categories' })).toBe('Komponentbibliotek')
    expect(
      levelTitle({ level: 'types', categoryId: 'c', categoryName: 'Vitvaror' })
    ).toBe('Vitvaror')
    expect(levelTitle({ level: 'subtype', ...base, tab: 'components' })).toBe(
      'Spis, 4 plattor'
    )
  })
})

describe('levelSearch', () => {
  it('is the query string for a level', () => {
    expect(
      levelSearch({ level: 'types', categoryId: 'c', categoryName: 'Vitvaror' })
    ).toBe('?level=types&categoryId=c&categoryName=Vitvaror')
  })
})
