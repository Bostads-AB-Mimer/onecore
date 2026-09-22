import type { GuideSummary } from '../types'
import { groupByCategory } from './groupByCategory'

const summary = (
  title: string,
  category: { id: string; name: string }
): GuideSummary => ({
  id: title,
  slug: title,
  title,
  description: '',
  status: 'published',
  category: { ...category, createdAt: '', updatedAt: '' },
  stepCount: 1,
  createdBy: 'a',
  updatedBy: 'a',
  publishedAt: null,
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

  it('returns an empty list for no guides', () => {
    expect(groupByCategory([])).toEqual([])
  })
})
