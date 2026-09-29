import { describe, expect, it } from 'vitest'

import type { GuideSummary } from '../types'
import { filterGuides } from './filterGuides'

const summary = (
  title: string,
  description: string,
  categoryName: string
): GuideSummary => ({
  id: title,
  slug: title,
  title,
  description,
  status: 'published',
  category: {
    id: categoryName,
    name: categoryName,
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

const guides = [
  summary('Registrera uppsägning', 'Så säger du upp ett kontrakt', 'Tenfast'),
  summary('Skapa ströfaktura', 'Fakturera en engångskostnad', 'Ekonomi'),
]

describe('filterGuides', () => {
  it('returns everything for an empty search', () => {
    expect(filterGuides(guides, '   ')).toHaveLength(2)
  })

  it('matches title, description and category regardless of case', () => {
    expect(filterGuides(guides, 'UPPSÄGNING').map((g) => g.title)).toEqual([
      'Registrera uppsägning',
    ])
    expect(filterGuides(guides, 'engångs').map((g) => g.title)).toEqual([
      'Skapa ströfaktura',
    ])
    expect(filterGuides(guides, 'tenfast')).toHaveLength(1)
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterGuides(guides, 'besiktning')).toEqual([])
  })
})
