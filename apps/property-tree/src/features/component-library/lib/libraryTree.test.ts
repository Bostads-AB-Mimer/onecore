import { describe, expect, it } from 'vitest'

import {
  libraryHref,
  libraryViewFromLocation,
  treeNodeState,
} from './libraryTree'
import type { ViewState } from './libraryUrlState'

const category = { categoryId: 'cat-1', categoryName: 'Vitvaror' }
const type = { ...category, typeId: 'type-1', typeName: 'Spis' }
const subtype = {
  ...type,
  subtypeId: 'sub-1',
  subtypeName: 'Elspis bredd 60 cm / 230v',
}

const onCategories: ViewState = { level: 'categories' }
const onCategory: ViewState = { level: 'types', ...category }
const onType: ViewState = { level: 'subtypes', ...type }
const onSubtype: ViewState = { level: 'subtype', ...subtype, tab: 'components' }

describe('treeNodeState', () => {
  it('marks nothing when the library is not open', () => {
    expect(treeNodeState(undefined, { level: 'categories' })).toBe('none')
    expect(
      treeNodeState(undefined, { level: 'category', categoryId: 'cat-1' })
    ).toBe('none')
  })

  it('makes Kategorier active on the categories page and on the path below it', () => {
    expect(treeNodeState(onCategories, { level: 'categories' })).toBe('active')
    expect(treeNodeState(onSubtype, { level: 'categories' })).toBe('in-path')
  })

  it('makes a category active on its own page and on the path below it', () => {
    const node = { level: 'category', categoryId: 'cat-1' } as const
    expect(treeNodeState(onCategory, node)).toBe('active')
    expect(treeNodeState(onType, node)).toBe('in-path')
    expect(treeNodeState(onSubtype, node)).toBe('in-path')
    expect(treeNodeState(onCategories, node)).toBe('none')
  })

  it('leaves other categories alone', () => {
    expect(
      treeNodeState(onSubtype, { level: 'category', categoryId: 'cat-2' })
    ).toBe('none')
  })

  it('makes a type active on its own page and on the path below it', () => {
    const node = { level: 'type', typeId: 'type-1' } as const
    expect(treeNodeState(onType, node)).toBe('active')
    expect(treeNodeState(onSubtype, node)).toBe('in-path')
    expect(treeNodeState(onCategory, node)).toBe('none')
    expect(
      treeNodeState(onSubtype, { level: 'type', typeId: 'type-2' })
    ).toBe('none')
  })

  it('makes a subtype active on its page, whichever tab is open', () => {
    const node = { level: 'subtype', subtypeId: 'sub-1' } as const
    expect(treeNodeState(onSubtype, node)).toBe('active')
    expect(treeNodeState({ ...onSubtype, tab: 'models' }, node)).toBe('active')
    expect(treeNodeState(onType, node)).toBe('none')
    expect(
      treeNodeState(onSubtype, { level: 'subtype', subtypeId: 'sub-2' })
    ).toBe('none')
  })
})

describe('libraryHref', () => {
  it('links the categories page to the bare route', () => {
    expect(libraryHref(onCategories)).toBe('/komponenter')
  })

  it('links a subtype to its components tab without a tab param', () => {
    const href = libraryHref(onSubtype)
    expect(href.startsWith('/komponenter?')).toBe(true)
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('level')).toBe('subtype')
    expect(params.get('subtypeId')).toBe('sub-1')
    expect(params.get('tab')).toBeNull()
  })
})

describe('libraryViewFromLocation', () => {
  it('returns undefined outside the library', () => {
    expect(libraryViewFromLocation('/fastigheter', '')).toBeUndefined()
  })

  it('reads the view state from the query on the library route', () => {
    expect(libraryViewFromLocation('/komponenter', '')).toEqual(onCategories)
    expect(
      libraryViewFromLocation(
        '/komponenter',
        libraryHref(onType).split('/komponenter')[1]
      )
    ).toEqual(onType)
  })
})
