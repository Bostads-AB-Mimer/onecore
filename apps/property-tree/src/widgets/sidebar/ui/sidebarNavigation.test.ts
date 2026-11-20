import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { routes } from '@/shared/routes'
import { SidebarProvider } from '@/shared/ui/Sidebar'

import { SidebarNavigation } from './SidebarNavigation'

// The selection hook and the company list fetch data; the nav links don't
// depend on them, so they are stubbed out.
vi.mock('../hooks/useHierarchicalSelection', () => ({
  useHierarchicalSelection: () => ({
    selectionState: {
      selectedResidenceId: null,
      selectedStaircaseCode: null,
      selectedBuildingCode: null,
      selectedPropertyCode: null,
      selectedOrganizationNumber: null,
    },
  }),
}))
vi.mock('./CompanyList', () => ({ CompanyList: () => null }))
// RequireRole reads the signed-in user, whose API client needs window. The
// role-gated links are not what these tests are about, so they are shown.
vi.mock('@/entities/user', () => ({
  RequireRole: ({ children }: { children: unknown }) => children,
  HOME_INSURANCE_READ_ROLE: 'home-insurance:read',
  OPEN_INVOICES_READ_ROLE: 'open-invoices:read',
}))
// The test runs in node, where window.matchMedia doesn't exist.
vi.mock('@/shared/hooks/useMobile', () => ({
  useIsMobile: () => false,
  useIsSmallMobile: () => false,
}))

const renderAt = (pathname: string) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [pathname] },
      createElement(SidebarProvider, null, createElement(SidebarNavigation))
    )
  )

const propertyAreasLink = (html: string) =>
  html.match(/<a[^>]*href="\/forvaltningsomraden"[^>]*>.*?<\/a>/)?.[0]

describe('SidebarNavigation', () => {
  it('links to the property areas page', () => {
    const link = propertyAreasLink(renderAt(routes.dashboard))

    expect(link).toBeDefined()
    expect(link).toContain('Förvaltningsområden')
  })

  it('marks the property areas link active on its page', () => {
    const html = renderAt(routes.propertyAreas)
    const link = propertyAreasLink(html)

    expect(link).toContain('data-active="true"')
    expect(propertyAreasLink(renderAt(routes.dashboard))).toContain(
      'data-active="false"'
    )
  })
})
