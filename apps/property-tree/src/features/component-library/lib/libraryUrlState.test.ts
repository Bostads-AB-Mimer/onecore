import { describe, expect, it } from 'vitest'

import {
  ancestorViewStates,
  isLegacyLibraryUrl,
  levelSearch,
  levelTitle,
  parentViewState,
  parseComponentFilters,
  parseInstalledBeforeYear,
  parseSort,
  parseViewState,
  sortUrlParams,
  toSearchParams,
  toViewKey,
  type ViewState,
  withCategoryType,
  withFreshNames,
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

describe('parentViewState', () => {
  it('goes one level up from each page', () => {
    expect(parentViewState({ level: 'categories' })).toEqual({
      level: 'categories',
    })
    expect(
      parentViewState({
        level: 'types',
        categoryId: base.categoryId,
        categoryName: base.categoryName,
      })
    ).toEqual({ level: 'categories' })
    expect(
      parentViewState({
        level: 'subtypes',
        categoryId: base.categoryId,
        categoryName: base.categoryName,
        typeId: base.typeId,
        typeName: base.typeName,
      })
    ).toEqual({
      level: 'types',
      categoryId: base.categoryId,
      categoryName: base.categoryName,
    })
    expect(
      parentViewState({
        level: 'subtype',
        ...base,
        tab: 'models',
        modelId: 'm-1',
      })
    ).toEqual({
      level: 'subtypes',
      categoryId: base.categoryId,
      categoryName: base.categoryName,
      typeId: base.typeId,
      typeName: base.typeName,
    })
  })
})

describe('ancestorViewStates', () => {
  it('has no ancestors on the categories page', () => {
    expect(ancestorViewStates({ level: 'categories' })).toEqual([])
  })

  it('lists every level above a subtype, root first', () => {
    expect(
      ancestorViewStates({
        level: 'subtype',
        ...base,
        tab: 'components',
        modelId: 'm-1',
      })
    ).toEqual([
      { level: 'categories' },
      {
        level: 'types',
        categoryId: base.categoryId,
        categoryName: base.categoryName,
      },
      {
        level: 'subtypes',
        categoryId: base.categoryId,
        categoryName: base.categoryName,
        typeId: base.typeId,
        typeName: base.typeName,
      },
    ])
  })
})

describe('withFreshNames', () => {
  const subtypePage: ViewState = {
    level: 'subtype',
    ...base,
    tab: 'components',
  }

  it('replaces names from the URL with names from data, matched by id', () => {
    expect(
      withFreshNames(subtypePage, {
        categories: [{ id: 'cat-1', categoryName: 'Vitvaror nya' }],
        types: [{ id: 'type-1', typeName: 'Spisar' }],
        subtypes: [{ id: 'sub-1', subTypeName: 'Elspis' }],
      })
    ).toEqual({
      ...subtypePage,
      categoryName: 'Vitvaror nya',
      typeName: 'Spisar',
      subtypeName: 'Elspis',
    })
  })

  it('keeps URL names while data is loading or the id is missing', () => {
    expect(withFreshNames(subtypePage, {})).toEqual(subtypePage)
    expect(
      withFreshNames(subtypePage, {
        types: [{ id: 'type-2', typeName: 'Kyl' }],
      })
    ).toEqual(subtypePage)
  })

  it('leaves the categories page alone', () => {
    expect(
      withFreshNames(
        { level: 'categories' },
        { categories: [{ id: 'cat-1', categoryName: 'X' }] }
      )
    ).toEqual({ level: 'categories' })
  })
})

describe('toViewKey', () => {
  const subtypes: ViewState = {
    level: 'subtypes',
    categoryId: base.categoryId,
    categoryName: base.categoryName,
    typeId: base.typeId,
    typeName: base.typeName,
  }

  it('changes when moving between sibling types', () => {
    expect(toViewKey(subtypes)).not.toBe(
      toViewKey({ ...subtypes, typeId: 'type-2', typeName: 'Kyl' })
    )
  })

  it('changes when moving between categories', () => {
    expect(
      toViewKey({ level: 'types', categoryId: 'cat-1', categoryName: 'A' })
    ).not.toBe(
      toViewKey({ level: 'types', categoryId: 'cat-2', categoryName: 'B' })
    )
  })

  it('changes with the subtype and the tab', () => {
    const subtype: ViewState = { ...base, level: 'subtype', tab: 'components' }
    expect(toViewKey(subtype)).not.toBe(
      toViewKey({ ...subtype, subtypeId: 'sub-2' })
    )
    expect(toViewKey(subtype)).not.toBe(
      toViewKey({ ...subtype, tab: 'models' })
    )
  })

  it('ignores names and the model filter', () => {
    const subtype: ViewState = { ...base, level: 'subtype', tab: 'components' }
    expect(
      toViewKey({ ...subtype, typeName: 'Renamed', modelId: 'model-1' })
    ).toBe(toViewKey(subtype))
  })
})

describe('parseSort', () => {
  it('reads the sort column and direction', () => {
    expect(
      parseSort(new URLSearchParams('sortBy=count&sortOrder=desc'))
    ).toEqual({ key: 'count', order: 'desc' })
  })

  it('defaults the direction to ascending', () => {
    expect(parseSort(new URLSearchParams('sortBy=name'))).toEqual({
      key: 'name',
      order: 'asc',
    })
  })

  it('ignores a missing column or one the table does not allow', () => {
    expect(parseSort(new URLSearchParams('sortOrder=desc'))).toBeUndefined()
    expect(
      parseSort(new URLSearchParams('sortBy=location'), ['installed', 'model'])
    ).toBeUndefined()
  })
})

describe('sortUrlParams', () => {
  it('writes the sort, and clears it when it is the default', () => {
    const fallback = { key: 'installed', order: 'desc' as const }
    expect(sortUrlParams({ key: 'model', order: 'asc' }, fallback)).toEqual({
      sortBy: 'model',
      sortOrder: 'asc',
    })
    expect(sortUrlParams(fallback, fallback)).toEqual({
      sortBy: undefined,
      sortOrder: undefined,
    })
  })
})

describe('parseComponentFilters', () => {
  it('reads the installation filter and the year', () => {
    expect(
      parseComponentFilters(
        new URLSearchParams('installation=installed&installedBefore=2010')
      )
    ).toEqual({ installation: 'installed', installedBefore: 2010 })
  })

  it('drops unknown values and years without known dates', () => {
    expect(
      parseComponentFilters(
        new URLSearchParams('installation=broken&installedBefore=1901')
      )
    ).toEqual({})
    expect(
      parseComponentFilters(new URLSearchParams('installedBefore=20x0'))
    ).toEqual({})
  })

  it('drops the year for components that are not installed', () => {
    expect(
      parseComponentFilters(
        new URLSearchParams('installation=notInstalled&installedBefore=2010')
      )
    ).toEqual({ installation: 'notInstalled' })
  })
})

describe('parseInstalledBeforeYear', () => {
  it('takes a four-digit year after the placeholder year', () => {
    expect(parseInstalledBeforeYear(' 2010 ')).toBe(2010)
    expect(parseInstalledBeforeYear('1902')).toBe(1902)
  })

  it('refuses partial, placeholder and non-numeric years', () => {
    expect(parseInstalledBeforeYear('201')).toBeUndefined()
    expect(parseInstalledBeforeYear('1901')).toBeUndefined()
    expect(parseInstalledBeforeYear('20x0')).toBeUndefined()
    expect(parseInstalledBeforeYear('')).toBeUndefined()
  })
})
