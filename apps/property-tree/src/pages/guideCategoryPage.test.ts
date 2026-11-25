// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { paths, routes } from '@/shared/routes'

import { GuideCategoryPage } from './GuideCategoryPage'

const useGuideCategoriesMock = vi.hoisted(() => vi.fn())

vi.mock('@/entities/guide', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/guide')>()),
  useGuideCategories: useGuideCategoriesMock,
  useGuides: () => ({ data: [], isLoading: false, isError: false }),
}))

vi.mock('@/entities/user', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/user')>()),
  useHasRole: () => false,
  useUser: () => ({ tag: 'success' }),
}))

const categories = [
  { id: 'c1', name: 'Tenfast', parentId: null, createdAt: '', updatedAt: '' },
  { id: 'c3', name: 'Avtal', parentId: 'c1', createdAt: '', updatedAt: '' },
]

// Lets React know act() is available outside a test renderer.
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function render(categoryId: string) {
  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        {
          initialEntries: [paths.guideCategory(categoryId)],
          future: { v7_startTransition: true, v7_relativeSplatPath: true },
        },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: routes.guideCategory,
            element: createElement(GuideCategoryPage),
          })
        )
      )
    )
  })
}

const breadcrumb = () =>
  [...container.querySelectorAll('nav li')]
    .map((item) => item.textContent?.trim())
    .filter(Boolean)

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  useGuideCategoriesMock.mockReturnValue({
    data: categories,
    isLoading: false,
    isError: false,
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('GuideCategoryPage', () => {
  it('puts the parent between the guides and a subcategory', () => {
    render('c3')

    expect(breadcrumb()).toEqual(['Guider', 'Tenfast', 'Avtal'])
    const back = container.querySelector(
      `a[href="${paths.guideCategory('c1')}"]:not(nav a)`
    )
    expect(back?.textContent).toBe('Tillbaka till Tenfast')
  })

  it('links a top-level category back to all guides', () => {
    render('c1')

    expect(breadcrumb()).toEqual(['Guider', 'Tenfast'])
    expect(container.textContent).toContain('Alla kategorier')
  })
})
