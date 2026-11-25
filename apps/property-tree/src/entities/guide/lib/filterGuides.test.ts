import { describe, expect, it } from 'vitest'

import type { GuideSummary } from '../types'
import { filterGuides } from './filterGuides'

const category = (name: string, parentId: string | null = null) => ({
  id: name,
  name,
  parentId,
  createdAt: '',
  updatedAt: '',
})

const summary = (
  title: string,
  description: string,
  ...categoryNames: string[]
): GuideSummary => ({
  id: title,
  slug: title,
  title,
  description,
  status: 'published',
  categories: categoryNames.map((name) => category(name)),
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
      expect(
        filterGuides(withOdoo, '', { categoryId: 'Odoo' }).map((g) => g.title)
      ).toEqual(['Registrera felanmälan'])
    })

    it('searches within the category only', () => {
      expect(filterGuides(withOdoo, 'registrera')).toHaveLength(2)
      expect(
        filterGuides(withOdoo, 'registrera', { categoryId: 'Tenfast' }).map(
          (g) => g.title
        )
      ).toEqual(['Registrera uppsägning'])
      expect(
        filterGuides(withOdoo, 'faktura', { categoryId: 'Tenfast' })
      ).toEqual([])
    })

    it('includes the guides of its subcategories', () => {
      const inSubcategory: GuideSummary = {
        ...summary('Säga upp avtal', ''),
        categories: [category('Avtal', 'Tenfast')],
      }

      expect(
        filterGuides([...withOdoo, inSubcategory], '', {
          categoryId: 'Tenfast',
        }).map((g) => g.title)
      ).toEqual(['Registrera uppsägning', 'Säga upp avtal'])
    })

    it("matches a subcategory guide on its parent's name", () => {
      const inSubcategory: GuideSummary = {
        ...summary('Säga upp avtal', ''),
        categories: [category('Avtal', 'Tenfast')],
      }
      const categories = [category('Tenfast'), category('Avtal', 'Tenfast')]

      expect(
        filterGuides([inSubcategory], 'tenfast', { categories }).map(
          (g) => g.title
        )
      ).toEqual(['Säga upp avtal'])
      // Without the categories the parent's name is unknown.
      expect(filterGuides([inSubcategory], 'tenfast')).toEqual([])
    })

    it('includes a guide in any of its categories', () => {
      const inBoth = summary('Koppla ärende', '', 'Odoo', 'Tenfast')

      for (const categoryId of ['Odoo', 'Tenfast']) {
        expect(
          filterGuides([inBoth], '', { categoryId }).map((g) => g.title)
        ).toEqual(['Koppla ärende'])
      }
      expect(filterGuides([inBoth], '', { categoryId: 'Ekonomi' })).toEqual([])
    })

    it('matches the name of any of its categories', () => {
      const inBoth = summary('Koppla ärende', '', 'Odoo', 'Tenfast')

      expect(filterGuides([inBoth], 'odoo')).toHaveLength(1)
      expect(filterGuides([inBoth], 'tenfast')).toHaveLength(1)
    })

    it('returns an empty list for an unknown category', () => {
      expect(filterGuides(withOdoo, '', { categoryId: 'okänd' })).toEqual([])
    })
  })
})
