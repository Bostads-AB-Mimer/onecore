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
    parentId: null,
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

  describe('with a category', () => {
    const withOdoo = [
      ...guides,
      summary('Registrera felanmälan', 'Felanmälan i Odoo', 'Odoo'),
    ]

    it('returns only that category for an empty search', () => {
      expect(filterGuides(withOdoo, '', 'Odoo').map((g) => g.title)).toEqual([
        'Registrera felanmälan',
      ])
    })

    it('searches within the category only', () => {
      expect(filterGuides(withOdoo, 'registrera')).toHaveLength(2)
      expect(
        filterGuides(withOdoo, 'registrera', 'Tenfast').map((g) => g.title)
      ).toEqual(['Registrera uppsägning'])
      expect(filterGuides(withOdoo, 'faktura', 'Tenfast')).toEqual([])
    })

    it('includes the guides of its subcategories', () => {
      const inSubcategory: GuideSummary = {
        ...summary('Säga upp avtal', '', 'Avtal'),
        category: {
          id: 'Avtal',
          name: 'Avtal',
          parentId: 'Tenfast',
          createdAt: '',
          updatedAt: '',
        },
      }

      expect(
        filterGuides([...withOdoo, inSubcategory], '', 'Tenfast').map(
          (g) => g.title
        )
      ).toEqual(['Registrera uppsägning', 'Säga upp avtal'])
    })

    it('returns an empty list for an unknown category', () => {
      expect(filterGuides(withOdoo, '', 'okänd')).toEqual([])
    })
  })
})
