// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GuideSummary } from '@/entities/guide'

import { paths } from '@/shared/routes'

import { GuidesOverview } from './GuidesOverview'

const useGuidesMock = vi.hoisted(() => vi.fn())
const useGuideCategoriesMock = vi.hoisted(() => vi.fn())

vi.mock('@/entities/guide', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/guide')>()),
  useGuides: useGuidesMock,
  useGuideCategories: useGuideCategoriesMock,
}))

type Category = { id: string; name: string; parentId?: string }

const summary = (title: string, category: Category): GuideSummary => ({
  id: title,
  slug: title.toLowerCase().replace(/\s+/g, '-'),
  title,
  description: '',
  status: 'published',
  category: { parentId: null, ...category, createdAt: '', updatedAt: '' },
  stepCount: 1,
  createdBy: 'a',
  updatedBy: 'a',
  publishedAt: null,
  createdAt: '',
  updatedAt: '',
})

const tenfast = { id: 'c1', name: 'Tenfast' }
const odoo = { id: 'c2', name: 'Odoo' }
const contracts = { id: 'c3', name: 'Avtal', parentId: 'c1' }

const categories = [tenfast, odoo, contracts].map((category) => ({
  parentId: null,
  ...category,
  createdAt: '',
  updatedAt: '',
}))

const guides = [
  summary('Registrera uppsägning', tenfast),
  summary('Skapa hyresobjekt', tenfast),
  summary('Registrera felanmälan', odoo),
]

// Lets React know act() is available outside a test renderer.
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function render(props: { categoryId?: string } = {}) {
  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        { future: { v7_startTransition: true, v7_relativeSplatPath: true } },
        createElement(GuidesOverview, { includeDrafts: false, ...props })
      )
    )
  })
  return container.innerHTML
}

function search(text: string) {
  const input = container.querySelector<HTMLInputElement>('input[type=search]')
  if (!input) throw new Error('No search field')
  // React tracks the value itself; set it through the native setter so the
  // input event is seen as a change.
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set
  act(() => {
    setValue?.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  return container.innerHTML
}

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('GuidesOverview', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    useGuidesMock.mockReturnValue({
      data: guides,
      isLoading: false,
      isError: false,
    })
    useGuideCategoriesMock.mockReturnValue({
      data: categories,
      isLoading: false,
      isError: false,
    })
  })

  it('shows one card per category, linking to the category, without a search', () => {
    const html = render()

    expect(html).toContain(`href="${paths.guideCategory('c1')}"`)
    expect(html).toContain(`href="${paths.guideCategory('c2')}"`)
    expect(html).toContain('2 guider')
    expect(html).toContain('1 guide')
    expect(html).not.toContain('Registrera uppsägning')
    expect(html).not.toContain(`href="${paths.guide('skapa-hyresobjekt')}"`)
  })

  it('lists matching guides from every category while searching', () => {
    render()
    const html = search('registrera')

    expect(html).toContain('Registrera uppsägning')
    expect(html).toContain('Registrera felanmälan')
    expect(html).not.toContain('Skapa hyresobjekt')
    expect(html).not.toContain(`href="${paths.guideCategory('c1')}"`)
  })

  it('lists only the guides of the given category', () => {
    const html = render({ categoryId: 'c1' })

    // A flat list: the page heading already names the category.
    expect(container.querySelector('h2')).toBeNull()

    expect(html).toContain('Registrera uppsägning')
    expect(html).toContain('Skapa hyresobjekt')
    expect(html).not.toContain('Registrera felanmälan')
    expect(html).not.toContain(`href="${paths.guideCategory('c1')}"`)
  })

  it('searches within the given category', () => {
    render({ categoryId: 'c2' })
    const html = search('registrera')

    expect(html).toContain('Registrera felanmälan')
    expect(html).not.toContain('Registrera uppsägning')
  })

  it('tells the reader when the category has no guides', () => {
    const html = render({ categoryId: 'tom' })

    expect(html).toContain('Inga guider i kategorin')
  })

  describe('with subcategories', () => {
    beforeEach(() => {
      useGuidesMock.mockReturnValue({
        data: [
          ...guides,
          summary('Säga upp avtal', contracts),
          summary('Förlänga avtal', contracts),
        ],
        isLoading: false,
        isError: false,
      })
    })

    it('shows only top-level categories, counting their subcategories', () => {
      const html = render()

      expect(html).toContain(`href="${paths.guideCategory('c1')}"`)
      expect(html).not.toContain(`href="${paths.guideCategory('c3')}"`)
      expect(html).toContain('4 guider')
    })

    it('shows the subcategories above the guides of the category', () => {
      const html = render({ categoryId: 'c1' })

      expect(html).toContain(`href="${paths.guideCategory('c3')}"`)
      expect(html).toContain('2 guider')
      expect(html).toContain('Registrera uppsägning')
      expect(html).not.toContain('Säga upp avtal')
      expect(html.indexOf('Underkategorier')).toBeLessThan(
        html.indexOf('Registrera uppsägning')
      )
    })

    it('searches the subcategories too', () => {
      render({ categoryId: 'c1' })
      const html = search('avtal')

      expect(html).toContain('Säga upp avtal')
      expect(html).toContain('Förlänga avtal')
      expect(html).not.toContain(`href="${paths.guideCategory('c3')}"`)
    })

    it('lists the guides of a subcategory', () => {
      const html = render({ categoryId: 'c3' })

      expect(html).toContain('Säga upp avtal')
      expect(html).not.toContain('Registrera uppsägning')
      expect(container.querySelector('h2')).toBeNull()
    })
  })
})
