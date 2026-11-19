// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LeaseSearchResult } from '@/services/api/core/leaseSearchService'

import LeasesPage from './LeasesPage'

const useLeaseFiltersMock = vi.hoisted(() => vi.fn())

vi.mock('@/entities/lease', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/lease')>()),
  useLeaseFilters: useLeaseFiltersMock,
}))
vi.mock('@/features/properties', () => ({
  usePropertySearch: () => async () => [],
}))
// The SMS and email modals load their schedule config on mount.
vi.mock('@/entities/dispatch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/dispatch')>()),
  useScheduleConfig: () => ({ data: undefined }),
}))
vi.mock('@/features/property-areas', () => ({
  useCostCenters: () => ({ data: [] }),
}))

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

// Only the fields the page renders; the rest of the schema is irrelevant here.
const lease = (leaseId: string) =>
  ({
    leaseId,
    status: 'Current',
    startDate: '2024-01-01',
    lastDebitDate: null,
    address: 'Testgatan 1',
    objectTypeCode: 'BALG',
    contacts: [],
  }) as unknown as LeaseSearchResult

const leases = [lease('100-001-01/1'), lease('100-001-02/1')]

function mockFilters() {
  useLeaseFiltersMock.mockReturnValue({
    leases,
    meta: { totalRecords: 30 },
    totalPages: 2,
    page: 1,
    pageSize: 25,
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    searchInput: '',
    setSearchInput: vi.fn(),
    searchParams: {},
    hasActiveFilters: false,
    clearFilters: vi.fn(),
    setFilterValue: vi.fn(),
    setFilterValues: vi.fn(),
    setDateRange: vi.fn(),
    setObjectAndParkingSpaceType: vi.fn(),
    selectedObjectTypes: [],
    selectedStatuses: [],
    selectedLeaseTypes: [],
    selectedTenantName: '',
    selectedProperties: [],
    selectedDistricts: [],
    selectedBuildingManagers: [],
    selectedParkingSpaceTypes: [],
    searchBuildingManagers: vi.fn(),
    loadParkingSpaceTypes: vi.fn(),
    handleSort: vi.fn(),
    isLoading: false,
    isFetching: false,
    error: null,
    failureCount: 0,
    failureReason: null,
    exportToExcel: vi.fn(),
  })
}

let container: HTMLDivElement
let root: Root

function render(isMobile: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: isMobile,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(MemoryRouter, null, createElement(LeasesPage))
      )
    )
  })
}

const click = (element: Element | null | undefined) => {
  expect(element).toBeTruthy()
  act(() => (element as HTMLElement).click())
}

beforeEach(() => {
  mockFilters()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

describe('LeasesPage on a phone', () => {
  it('selects a lease from its card and shows the bulk actions', () => {
    render(true)

    expect(container.textContent).not.toContain('Skicka SMS')
    click(container.querySelector('[aria-label="Välj 100-001-02/1"]'))

    expect(container.textContent).toContain('1 valda')
    expect(container.textContent).toContain('Skicka SMS')
  })

  it('selects every hit with Välj alla', () => {
    render(true)

    const selectAll = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent?.startsWith('Välj alla 30 träffar')
    )
    click(selectAll?.querySelector('button'))

    expect(container.textContent).toContain('30 valda')
    expect(
      container
        .querySelector('[aria-label="Välj 100-001-01/1"]')
        ?.getAttribute('data-state')
    ).toBe('checked')
  })

  it('shows the phone-only Välj alla only on phones', () => {
    render(false)

    expect(container.textContent).not.toContain('Välj alla 30 träffar')
  })
})
