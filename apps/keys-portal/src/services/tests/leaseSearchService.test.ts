import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/core/base-api', () => ({
  GET: vi.fn(),
}))

import { GET } from '../api/core/base-api'
import {
  dedupeLeases,
  equalPnr,
  fetchLeasesByRentalPropertyId,
  fetchTenantAndLeasesByPnr,
  fetchTenantAndLeasesByContactCode,
} from '../api/leaseSearchService'
import { makeLease, makeTenant } from './fixtures'

describe('dedupeLeases', () => {
  it('removes duplicate leases by leaseId', () => {
    const leases = [
      makeLease({ leaseId: 'prop-1/01' }),
      makeLease({ leaseId: 'prop-1/01' }),
      makeLease({ leaseId: 'prop-2/01' }),
    ]

    const result = dedupeLeases(leases)

    expect(result).toHaveLength(2)
    expect(result[0].leaseId).toBe('prop-1/01')
    expect(result[1].leaseId).toBe('prop-2/01')
  })

  it('falls back to rentalPropertyId/leaseNumber composite key when leaseId is missing', () => {
    const leases = [
      makeLease({
        leaseId: undefined,
        rentalPropertyId: 'prop-1',
        leaseNumber: '01',
      }),
      makeLease({
        leaseId: undefined,
        rentalPropertyId: 'prop-1',
        leaseNumber: '01',
      }),
      makeLease({
        leaseId: undefined,
        rentalPropertyId: 'prop-1',
        leaseNumber: '02',
      }),
    ]

    const result = dedupeLeases(leases)

    expect(result).toHaveLength(2)
    expect(result[0].leaseNumber).toBe('01')
    expect(result[1].leaseNumber).toBe('02')
  })
})

describe('equalPnr', () => {
  it('matches 12-digit and 10-digit PNR by comparing last 10 digits', () => {
    expect(equalPnr('200001011234', '0001011234')).toBe(true)
    expect(equalPnr('19900101-1234', '9001011234')).toBe(true)
    expect(equalPnr('0001011234', '0001019999')).toBe(false)
  })
})

const mockedGet = vi.mocked(GET)

const MERIEM = makeTenant({
  contactCode: 'P146763',
  nationalRegistrationNumber: '198809101325',
})

function respondWith(leases: ReturnType<typeof makeLease>[]) {
  mockedGet.mockResolvedValue({
    data: { content: leases },
    error: undefined,
  } as never)
}

describe('lease search queries', () => {
  beforeEach(() => {
    mockedGet.mockReset()
  })

  it('requests contacts when searching by rental object code', async () => {
    respondWith([makeLease()])

    await fetchLeasesByRentalPropertyId('406-061-04-0201')

    expect(mockedGet).toHaveBeenCalledWith(
      '/leases/by-rental-object-code/{rentalObjectCode}',
      {
        params: {
          path: { rentalObjectCode: '406-061-04-0201' },
          query: { includeContacts: true },
        },
      }
    )
  })

  it('requests contacts when searching by pnr', async () => {
    respondWith([makeLease({ tenants: [MERIEM] })])

    await fetchTenantAndLeasesByPnr('198809101325')

    expect(mockedGet).toHaveBeenCalledWith('/leases/by-pnr/{pnr}', {
      params: {
        path: { pnr: '198809101325' },
        query: { includeContacts: true },
      },
    })
  })

  it('requests contacts when searching by contact code', async () => {
    respondWith([makeLease({ tenants: [MERIEM] })])

    await fetchTenantAndLeasesByContactCode('P146763')

    expect(mockedGet).toHaveBeenCalledWith(
      '/leases/by-contact-code/{contactCode}',
      {
        params: {
          path: { contactCode: 'P146763' },
          query: { includeContacts: true },
        },
      }
    )
  })

  it('picks the tenant matching the searched pnr', async () => {
    respondWith([
      makeLease({
        tenants: [
          makeTenant({
            contactCode: 'P077658',
            nationalRegistrationNumber: '197706256919',
          }),
          MERIEM,
        ],
      }),
    ])

    const result = await fetchTenantAndLeasesByPnr('198809101325')

    expect(result?.tenant.contactCode).toBe('P146763')
    expect(result?.contracts).toHaveLength(1)
  })

  it('resolves to null when the response carries no tenants', async () => {
    respondWith([makeLease({ tenants: undefined })])

    await expect(
      fetchTenantAndLeasesByContactCode('P146763')
    ).resolves.toBeNull()
  })
})
