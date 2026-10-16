import { describe, expect, it } from 'vitest'

import type { GuideCategory, GuideSummary } from '../types'
import { groupByCategory, groupBySubcategory } from './groupByCategory'

const summary = (
  title: string,
  category: { id: string; name: string; parentId?: string }
): GuideSummary => ({
  id: title,
  slug: title,
  title,
  description: '',
  status: 'published',
  category: {
    parentId: null,
    ...category,
    createdAt: '',
    updatedAt: '',
  },
  stepCount: 1,
  createdBy: 'a',
  updatedBy: 'a',
  publishedAt: null,
  createdAt: '',
  updatedAt: '',
})

const category = (id: string, name: string): GuideCategory => ({
  id,
  name,
  parentId: null,
  createdAt: '',
  updatedAt: '',
})

describe('groupByCategory', () => {
  it('groups guides under their category in first-seen order', () => {
    const tenfast = { id: 'c1', name: 'Tenfast' }
    const invoices = { id: 'c2', name: 'Ströfakturor' }

    const groups = groupByCategory([
      summary('a', tenfast),
      summary('b', invoices),
      summary('c', tenfast),
    ])

    expect(groups.map((g) => g.name)).toEqual(['Tenfast', 'Ströfakturor'])
    expect(groups[0].guides.map((g) => g.title)).toEqual(['a', 'c'])
    expect(groups[1].guides.map((g) => g.title)).toEqual(['b'])
  })

  it('counts the guides in each category', () => {
    const tenfast = { id: 'c1', name: 'Tenfast' }
    const odoo = { id: 'c2', name: 'Odoo' }

    const groups = groupByCategory([
      summary('a', tenfast),
      summary('b', tenfast),
      summary('c', odoo),
      summary('d', tenfast),
    ])

    expect(groups.map((g) => [g.name, g.guides.length])).toEqual([
      ['Tenfast', 3],
      ['Odoo', 1],
    ])
  })

  it('counts the guides of a subcategory under its parent', () => {
    const tenfast = { id: 'c1', name: 'Tenfast' }
    const contracts = { id: 'c3', name: 'Avtal', parentId: 'c1' }
    const odoo = { id: 'c2', name: 'Odoo' }

    const groups = groupByCategory(
      [
        summary('a', tenfast),
        summary('b', contracts),
        summary('c', contracts),
        summary('d', odoo),
      ],
      [category('c1', 'Tenfast'), category('c2', 'Odoo')]
    )

    expect(groups.map((g) => [g.id, g.name, g.guides.length])).toEqual([
      ['c1', 'Tenfast', 3],
      ['c2', 'Odoo', 1],
    ])
  })

  it('names the parent of a subcategory whose parent has no own guides', () => {
    const groups = groupByCategory(
      [summary('a', { id: 'c3', name: 'Avtal', parentId: 'c1' })],
      [category('c1', 'Tenfast')]
    )

    expect(groups.map((g) => [g.id, g.name, g.parentId])).toEqual([
      ['c1', 'Tenfast', null],
    ])
  })

  it('falls back to the subcategory name while the parent is unknown', () => {
    const groups = groupByCategory([
      summary('a', { id: 'c3', name: 'Avtal', parentId: 'c1' }),
    ])

    expect(groups.map((g) => [g.id, g.name])).toEqual([['c1', 'Avtal']])
  })

  it('returns an empty list for no guides', () => {
    expect(groupByCategory([])).toEqual([])
  })
})

describe('groupBySubcategory', () => {
  it('groups the guides of the given parent by subcategory', () => {
    const tenfast = { id: 'c1', name: 'Tenfast' }
    const contracts = { id: 'c3', name: 'Avtal', parentId: 'c1' }
    const objects = { id: 'c4', name: 'Hyresobjekt', parentId: 'c1' }
    const elsewhere = { id: 'c5', name: 'Order', parentId: 'c2' }

    const groups = groupBySubcategory(
      [
        summary('a', tenfast),
        summary('b', contracts),
        summary('c', objects),
        summary('d', contracts),
        summary('e', elsewhere),
      ],
      'c1'
    )

    expect(
      groups.map((g) => [g.name, g.parentId, g.guides.map((x) => x.title)])
    ).toEqual([
      ['Avtal', 'c1', ['b', 'd']],
      ['Hyresobjekt', 'c1', ['c']],
    ])
  })
})
