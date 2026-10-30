import { describe, expect, it } from 'vitest'

import type { Component } from '@/services/types'

import {
  componentLibraryHref,
  markedComponentUrl,
} from './componentLibraryLink'
import { libraryViewFromLocation } from './libraryTree'

const subtype = {
  id: 'sub-1',
  subTypeName: 'Kyl- och frysskåp',
  componentType: {
    id: 'type-1',
    typeName: 'Kylskåp',
    category: { id: 'cat-1', categoryName: 'Vitvaror' },
  },
}

const component = (c: Partial<Component>) =>
  ({ id: 'c1', subtype, model: null, ...c }) as unknown as Component

const viewOf = (href: string) => {
  const url = new URL(href, 'http://localhost')
  return libraryViewFromLocation(url.pathname, url.search)
}

describe('componentLibraryHref', () => {
  it('opens the subtype page on its components tab', () => {
    expect(viewOf(componentLibraryHref(component({}))!)).toEqual({
      level: 'subtype',
      categoryId: 'cat-1',
      categoryName: 'Vitvaror',
      typeId: 'type-1',
      typeName: 'Kylskåp',
      subtypeId: 'sub-1',
      subtypeName: 'Kyl- och frysskåp',
      tab: 'components',
    })
  })

  it('filters on the model when the component has one', () => {
    const href = componentLibraryHref(
      component({ model: { id: 'model-1' } as never })
    )
    expect(viewOf(href!)).toMatchObject({
      tab: 'components',
      modelId: 'model-1',
    })
  })

  it('names the component to mark in the list', () => {
    const href = componentLibraryHref(component({}))!
    expect(
      new URL(href, 'http://localhost').searchParams.get('componentId')
    ).toBe('c1')
  })

  it('has no link without the full hierarchy', () => {
    expect(componentLibraryHref(component({ subtype: undefined }))).toBeNull()
    expect(
      componentLibraryHref(
        component({
          subtype: { ...subtype, componentType: undefined } as never,
        })
      )
    ).toBeNull()
    expect(
      componentLibraryHref(
        component({
          subtype: {
            ...subtype,
            componentType: { ...subtype.componentType, category: undefined },
          } as never,
        })
      )
    ).toBeNull()
  })
})

describe('markedComponentUrl', () => {
  const view =
    'https://onecore.test/komponenter?level=subtype&subtypeId=sub-1&modelId=model-1&page=2'

  it('keeps the current view and marks the component', () => {
    const url = new URL(markedComponentUrl(view, 'c1'))
    expect(url.origin + url.pathname).toBe('https://onecore.test/komponenter')
    expect(url.searchParams.get('modelId')).toBe('model-1')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('componentId')).toBe('c1')
  })

  it('replaces a component that was already marked', () => {
    const url = new URL(markedComponentUrl(`${view}&componentId=old`, 'c2'))
    expect(url.searchParams.getAll('componentId')).toEqual(['c2'])
  })
})
