// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LEASE_TYPE_FILTER_OPTIONS } from '../lib/leaseType'
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

describe('useLeaseFilters contract type (Kontraktstyp)', () => {
  /** The leaseType the last search was made with */
  const searchedLeaseTypes = () =>
    useLeaseSearchMock.mock.lastCall?.[0].leaseType

  it('offers exactly the five contract types the search can tell apart', () => {
    expect(LEASE_TYPE_FILTER_OPTIONS.map((o) => o.value)).toEqual([
      'Bostadskontrakt',
      'Lokalkontrakt',
      'Garagekontrakt',
      'P-Platskontrakt',
      'Övrigt',
    ])
  })

  it('searches with the contract types in a saved link', () => {
    render('/leases?leaseType=Garagekontrakt&leaseType=Bostadskontrakt')

    expect(result.selectedLeaseTypes).toEqual([
      'Garagekontrakt',
      'Bostadskontrakt',
    ])
    expect(searchedLeaseTypes()).toEqual(['Garagekontrakt', 'Bostadskontrakt'])
  })

  it('drops a contract type the filter does not offer instead of filtering on it unseen', () => {
    render('/leases?leaseType=Campuskontrakt&leaseType=Lokalkontrakt')

    expect(result.selectedLeaseTypes).toEqual(['Lokalkontrakt'])
    expect(searchedLeaseTypes()).toEqual(['Lokalkontrakt'])
  })

  it('searches without a contract type when the link only holds ones it does not offer', () => {
    render('/leases?leaseType=Campuskontrakt')

    expect(searchedLeaseTypes()).toBeUndefined()
  })

  it('writes the chosen contract types to the URL and goes back to page 1', () => {
    render('/leases?page=3&status=current')

    act(() =>
      result.setFilterValues('leaseType', ['Garagekontrakt', 'Lokalkontrakt'])
    )

    expect(location.getAll('leaseType')).toEqual([
      'Garagekontrakt',
      'Lokalkontrakt',
    ])
    expect(location.has('page')).toBe(false)
    expect(location.get('status')).toBe('current')
    expect(searchedLeaseTypes()).toEqual(['Garagekontrakt', 'Lokalkontrakt'])
    expect(searchedPage()).toBe(1)
  })

  it('clears the contract type with the other filters', () => {
    render('/leases?leaseType=Garagekontrakt')
    expect(result.hasActiveFilters).toBe(true)

    act(() => result.clearFilters())

    expect(location.has('leaseType')).toBe(false)
    expect(searchedLeaseTypes()).toBeUndefined()
  })
})

describe('useLeaseFilters object type / parking space type', () => {
  it('two setFilterValues calls in the same tick lose the first write', () => {
    // Demonstrates the bug this card fixes: ObjectTypeFilter used to call
    // onObjectTypeChange and onParkingSpaceTypeChange back to back, and both
    // built their new URL from the same pre-update searchParams snapshot.
    render('/leases')

    act(() => {
      result.setFilterValues('objectType', ['parkering'])
      result.setFilterValues('parkingSpaceType', [])
    })

    expect(location.getAll('objectType')).toEqual([])
  })

  it('setObjectAndParkingSpaceType writes both filters in one step', () => {
    render('/leases')

    act(() => {
      result.setObjectAndParkingSpaceType(['bostad'], ['KALLGAR'])
    })

    expect(location.getAll('objectType')).toEqual(['bostad'])
    expect(location.getAll('parkingSpaceType')).toEqual(['KALLGAR'])
  })

  it('setObjectAndParkingSpaceType clears both filters together', () => {
    render('/leases?objectType=parkering&parkingSpaceType=KALLGAR')

    act(() => {
      result.setObjectAndParkingSpaceType([], [])
    })

    expect(location.has('objectType')).toBe(false)
    expect(location.has('parkingSpaceType')).toBe(false)
  })
})
