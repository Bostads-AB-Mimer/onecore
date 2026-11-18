// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLeaseFilters } from './useLeaseFilters'

const useLeaseSearchMock = vi.hoisted(() => vi.fn())

vi.mock('./useLeaseSearch', () => ({ useLeaseSearch: useLeaseSearchMock }))
vi.mock('@/services/api/core/authService', () => ({
  authService: { getUsersByRole: vi.fn() },
}))
vi.mock('@/services/api/core/leaseSearchService', () => ({
  leaseSearchService: { getParkingSpaceTypes: vi.fn() },
}))

// Lets React know act() is available outside a test renderer.
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
let result: ReturnType<typeof useLeaseFilters>
let location: URLSearchParams

function Harness() {
  result = useLeaseFilters()
  location = new URLSearchParams(useLocation().search)
  return null
}

function render(url: string) {
  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [url] },
        createElement(Harness)
      )
    )
  })
}

/** The page size the last search was made with */
const searchedLimit = () => useLeaseSearchMock.mock.lastCall?.[2]
const searchedPage = () => useLeaseSearchMock.mock.lastCall?.[1]

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  useLeaseSearchMock.mockReturnValue({
    data: [],
    meta: { totalRecords: 600 },
    isLoading: false,
    isFetching: false,
    error: null,
    failureCount: 0,
    failureReason: null,
    exportToExcel: vi.fn(),
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

describe('useLeaseFilters page size', () => {
  it('searches with 100 rows per page by default', () => {
    render('/leases')

    expect(result.pageSize).toBe(100)
    expect(searchedLimit()).toBe(100)
    expect(result.totalPages).toBe(6)
  })

  it('reads the page size from the URL', () => {
    render('/leases?pageSize=250')

    expect(result.pageSize).toBe(250)
    expect(searchedLimit()).toBe(250)
    expect(result.totalPages).toBe(3)
  })

  it('falls back to the default for a page size that is not an option', () => {
    render('/leases?pageSize=10000')

    expect(result.pageSize).toBe(100)
    expect(searchedLimit()).toBe(100)
  })

  it('goes back to page 1 when the page size changes', () => {
    render('/leases?page=4&status=current')
    expect(searchedPage()).toBe(4)

    act(() => result.setPageSize(500))

    expect(location.get('pageSize')).toBe('500')
    expect(location.has('page')).toBe(false)
    expect(location.get('status')).toBe('current')
    expect(searchedLimit()).toBe(500)
    expect(searchedPage()).toBe(1)
  })

  it('leaves the default page size out of the URL', () => {
    render('/leases?pageSize=250')

    act(() => result.setPageSize(100))

    expect(location.has('pageSize')).toBe(false)
    expect(searchedLimit()).toBe(100)
  })

  it('keeps the page size when the filters are cleared', () => {
    render('/leases?pageSize=250&status=current')

    act(() => result.clearFilters())

    expect(location.has('status')).toBe(false)
    expect(location.get('pageSize')).toBe('250')
  })

  it('does not count the page size as an active filter', () => {
    render('/leases?pageSize=250')

    expect(result.hasActiveFilters).toBe(false)
  })
})
