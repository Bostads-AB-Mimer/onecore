// @vitest-environment jsdom
// jsdom because the API client reads window.__ENV as soon as it is imported.
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type LeaseSearchResult,
  leaseSearchService,
  type LeaseStatusFilter,
} from '@/services/api/core/leaseSearchService'

import { fetchPropertyTenants, type OccupantTenant } from './useOccupantData'

const PROPERTY = 'ALMEN 1'
const APARTMENT = '101-001-01-0101'
const PARKING_SPACE = '101-001-99-0001'

const anna: OccupantTenant = { contactCode: 'P100001', name: 'Anna Berg' }
const erik: OccupantTenant = { contactCode: 'P100002', name: 'Erik Dahl' }

// A complete search row, so the fixture keeps compiling against the generated
// API type. fetchPropertyTenants only reads rentalObjectCode and contacts.
const lease = (
  rentalObjectCode: string | null,
  ...tenants: OccupantTenant[]
): LeaseSearchResult => ({
  leaseId: '000-000-00-0000/01',
  objectTypeCode: 'Bostad',
  leaseType: 'Bostadskontrakt',
  contacts: tenants.map((tenant) => ({ ...tenant, email: null, phone: null })),
  address: null,
  postalCode: null,
  city: null,
  startDate: null,
  endDate: null,
  lastDebitDate: null,
  signedAt: null,
  status: 0, // Current
  rentalObjectCode,
})

/**
 * Stands in for the lease search: answers page n with `pages[n - 1]` and
 * reports `totalRecords` as the total. A request past the last page fails the
 * test instead of reaching the network.
 */
function stubSearch(
  pages: LeaseSearchResult[][],
  totalRecords = pages.flat().length
) {
  const search = vi.spyOn(leaseSearchService, 'search')
  // Same defaults as the real search.
  search.mockImplementation(async (_params, page = 1, limit = 50) => {
    const content = pages[page - 1]
    if (!content) throw new Error(`Unexpected request for page ${page}`)
    return {
      content,
      _meta: { totalRecords, page, limit, count: content.length },
      _links: [],
    }
  })
  return search
}

describe('fetchPropertyTenants', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks only for the leases where someone still rents the object', async () => {
    const search = stubSearch([[]])

    await fetchPropertyTenants(PROPERTY)

    // Spelled out here, not imported from the hook, so the test states the
    // rule itself: 'ended' would list former tenants, and leaving out a
    // status under notice would show a rented object as vacant.
    const stillRented: LeaseStatusFilter[] = [
      'current',
      'abouttoend',
      'preliminaryterminated',
    ]
    const [params] = search.mock.calls[0]
    expect(params.property).toEqual([PROPERTY])
    expect(new Set(params.status)).toEqual(new Set(stillRented))
  })

  it('lists each tenant once per rental object and skips leases without an object', async () => {
    const leases = [
      lease(APARTMENT, anna, erik),
      // The same person on a second lease for the same object.
      lease(APARTMENT, anna),
      lease(PARKING_SPACE, anna),
      // Not tied to a rental object, so there is no row to list it on.
      lease(null, erik),
    ]
    stubSearch([leases])

    const { tenantsByCode } = await fetchPropertyTenants(PROPERTY)

    expect(tenantsByCode).toEqual({
      [APARTMENT]: [anna, erik],
      [PARKING_SPACE]: [anna],
    })
  })

  it('reads every page and merges the tenants across pages', async () => {
    stubSearch([[lease(APARTMENT, anna)], [lease(APARTMENT, erik)]])

    const { tenantsByCode } = await fetchPropertyTenants(PROPERTY)

    expect(tenantsByCode).toEqual({ [APARTMENT]: [anna, erik] })
  })

  it('stops at an empty page even when the total promises more leases', async () => {
    // The total says five leases, but the second page comes back empty.
    stubSearch([[lease(APARTMENT, anna)], []], 5)

    const { tenantsByCode } = await fetchPropertyTenants(PROPERTY)

    expect(tenantsByCode).toEqual({ [APARTMENT]: [anna] })
  })
})
