import { leasing, LeaseType, LeaseStatus } from '@onecore/types'

import * as tenfastLeaseSearchAdapter from '../../../adapters/tenfast/tenfast-lease-search-adapter'
import * as xpandLeaseSearchAdapter from '../../../adapters/xpand/lease-search-adapter'
import * as leaseCache from '../../../../../common/lease-cache'
import * as xpandEndedLeaseCache from '../../../../../common/xpand-ended-lease-cache'

jest.mock('../../../../../common/lease-cache', () => ({
  getAll: jest.fn(),
  refreshIfStale: jest.fn().mockResolvedValue(undefined),
  ensureReady: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../../../../common/xpand-ended-lease-cache', () => ({
  getAll: jest.fn(),
  isReady: jest.fn(),
}))

jest.mock('../../../adapters/xpand/lease-search-adapter', () => ({
  getRentalObjectCodesByBuildingManager: jest.fn(),
  getRentalObjectCodesByBuildingCodes: jest.fn(),
  getRentalObjectCodesByAreaCodes: jest.fn(),
  getRentalObjectCodesByDistrictNames: jest.fn(),
  getRentalObjectCodesByKvvAreaCodes: jest.fn(),
}))

jest.mock('../../../adapters/xpand/tenant-lease-adapter', () => ({
  getContacts: jest.fn().mockResolvedValue([]),
}))

const xpandCache = xpandEndedLeaseCache as unknown as {
  getAll: jest.Mock
  isReady: jest.Mock
}

const mockedTenfastGetAll = leaseCache.getAll as jest.MockedFunction<
  typeof leaseCache.getAll
>

const makeResult = (
  id: string,
  overrides: Partial<leasing.v1.LeaseSearchResult> = {}
): leasing.v1.LeaseSearchResult => ({
  leaseId: id,
  objectTypeCode: 'Bostad',
  leaseType: LeaseType.HousingContract,
  contacts: [
    {
      name: 'Test Tenant',
      contactCode: 'P000001',
      email: null,
      phone: null,
      contactType: 'tenant' as const,
    },
  ],
  address: 'Testgatan 1',
  rentalObjectCode: 'ROC-001',
  postalCode: null,
  city: null,
  property: null,
  districtName: null,
  startDate: new Date('2010-01-01'),
  endDate: null,
  lastDebitDate: null,
  signedAt: null,
  status: LeaseStatus.Current,
  ...overrides,
})

const makeXpandEnded = (
  id: string,
  overrides: Partial<leasing.v1.LeaseSearchResult> = {}
) =>
  makeResult(id, {
    status: LeaseStatus.Ended,
    endDate: new Date('2020-06-30'),
    lastDebitDate: new Date('2020-06-30'),
    ...overrides,
  })

const mockCtx = {
  query: { page: '1', limit: '20' },
  request: { URL: new URL('http://localhost:5020/api/leases/search') },
  throw: jest.fn().mockImplementation((status: number, msg: string) => {
    throw Object.assign(new Error(msg), { status })
  }),
} as any

type SearchParams = Partial<leasing.v1.LeaseSearchQueryParams>

const paged = (params: SearchParams): leasing.v1.LeaseSearchQueryParams => ({
  page: 1,
  limit: 100,
  ...params,
})

const search = async (params: SearchParams) =>
  (await tenfastLeaseSearchAdapter.searchLeases(paged(params), mockCtx)).content

const ids = (rows: leasing.v1.LeaseSearchResult[]) => rows.map((r) => r.leaseId)

describe('lease search with ended Xpand leases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedTenfastGetAll.mockReturnValue([makeResult('tenfast-current')])
    xpandCache.isReady.mockReturnValue(true)
    xpandCache.getAll.mockReturnValue([makeXpandEnded('xpand-ended')])
  })

  describe('searchLeases', () => {
    it('adds the Xpand lease when status includes ended', async () => {
      const rows = await search({ status: ['ended'] })
      expect(ids(rows)).toEqual(['xpand-ended'])
      expect(rows[0].status).toBe(LeaseStatus.Ended)
    })

    it('adds the Xpand lease when status has Ended in any case, next to other statuses', async () => {
      const rows = await search({ status: ['Current', 'ENDED'] })
      expect(ids(rows).sort()).toEqual(['tenfast-current', 'xpand-ended'])
    })

    it('adds the Xpand lease when includeEnded is true', async () => {
      const rows = await search({ includeEnded: true } as any)
      expect(ids(rows).sort()).toEqual(['tenfast-current', 'xpand-ended'])
    })

    it('does not add Xpand leases to a default search', async () => {
      const rows = await search({})
      expect(ids(rows)).toEqual(['tenfast-current'])
    })

    it('does not add Xpand leases when status leaves out ended', async () => {
      const rows = await search({ status: ['current'] })
      expect(ids(rows)).toEqual(['tenfast-current'])
    })

    it('does not add Xpand leases when includeEnded is false', async () => {
      const rows = await search({ includeEnded: false } as any)
      expect(ids(rows)).toEqual(['tenfast-current'])
    })

    it('lists a lease found in both sources once, with the Tenfast status', async () => {
      mockedTenfastGetAll.mockReturnValue([
        makeResult('same-lease', { status: LeaseStatus.Ended }),
      ])
      xpandCache.getAll.mockReturnValue([makeXpandEnded('same-lease')])

      const rows = await search({ status: ['ended'] })
      expect(rows).toHaveLength(1)
      expect(rows[0].status).toBe(LeaseStatus.Ended)
      expect(rows[0].endDate).toBeNull()
    })

    it('matches ids ignoring padding and case', async () => {
      mockedTenfastGetAll.mockReturnValue([makeResult('ABC-1/01')])
      xpandCache.getAll.mockReturnValue([makeXpandEnded(' abc-1/01  ')])

      const rows = await search({ includeEnded: true } as any)
      expect(rows).toHaveLength(1)
    })

    it('does not show a lease Tenfast calls current as ended from Xpand', async () => {
      mockedTenfastGetAll.mockReturnValue([
        makeResult('same-lease', { status: LeaseStatus.Current }),
      ])
      xpandCache.getAll.mockReturnValue([makeXpandEnded('same-lease')])

      const rows = await search({ status: ['ended'] })
      expect(rows).toEqual([])
    })

    it('keeps the Xpand lease under a property filter', async () => {
      xpandCache.getAll.mockReturnValue([
        makeXpandEnded('xpand-ended', { property: 'Fastighet 1' }),
      ])
      const rows = await search({
        status: ['ended'],
        property: ['Fastighet 1'],
      })
      expect(ids(rows)).toEqual(['xpand-ended'])
    })

    it('keeps the Xpand lease under a rental object code filter', async () => {
      ;(
        xpandLeaseSearchAdapter.getRentalObjectCodesByBuildingCodes as jest.Mock
      ).mockResolvedValue(['ROC-001'])
      const rows = await search({
        status: ['ended'],
        buildingCodes: ['B1'],
      })
      expect(ids(rows)).toEqual(['xpand-ended'])
    })

    it('finds the Xpand lease by a q on the contact code', async () => {
      xpandCache.getAll.mockReturnValue([
        makeXpandEnded('xpand-ended', {
          contacts: [
            {
              name: '',
              contactCode: 'P777777',
              email: null,
              phone: null,
              contactType: 'tenant',
            },
          ],
        }),
      ])
      const rows = await search({ status: ['ended'], q: 'p777777' })
      expect(ids(rows)).toEqual(['xpand-ended'])
    })

    it('keeps a parking Xpand lease under objectType=parkering', async () => {
      xpandCache.getAll.mockReturnValue([
        makeXpandEnded('xpand-parking', {
          objectTypeCode: 'Parkering',
          leaseType: LeaseType.ParkingSpaceContract,
        }),
        makeXpandEnded('xpand-housing'),
      ])
      const rows = await search({
        status: ['ended'],
        objectType: ['parkering'],
      })
      expect(ids(rows)).toEqual(['xpand-parking'])
    })

    it('counts Xpand rows in the paging totals', async () => {
      xpandCache.getAll.mockReturnValue([
        makeXpandEnded('x1'),
        makeXpandEnded('x2'),
        makeXpandEnded('x3'),
      ])
      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { status: ['ended'], limit: 2, page: 1 },
        mockCtx
      )
      expect(result._meta.totalRecords).toBe(3)
      expect(result.content).toHaveLength(2)
    })

    it('answers 503 when the Xpand cache is not ready and ended is requested', async () => {
      xpandCache.isReady.mockReturnValue(false)
      await expect(
        tenfastLeaseSearchAdapter.searchLeases(
          paged({ status: ['ended'] }),
          mockCtx
        )
      ).rejects.toMatchObject({ status: 503 })
      expect(mockCtx.throw).toHaveBeenCalledWith(
        503,
        expect.any(String),
        expect.objectContaining({ headers: { 'Retry-After': '30' } })
      )
    })

    it('answers 503 for includeEnded when the Xpand cache is not ready', async () => {
      xpandCache.isReady.mockReturnValue(false)
      await expect(
        tenfastLeaseSearchAdapter.searchLeases(
          { includeEnded: true } as any,
          mockCtx
        )
      ).rejects.toMatchObject({ status: 503 })
    })

    it('serves the Tenfast result when the Xpand cache is not ready and ended is not requested', async () => {
      xpandCache.isReady.mockReturnValue(false)
      const rows = await search({ status: ['current'] })
      expect(ids(rows)).toEqual(['tenfast-current'])
    })
  })

  describe('fetchAllLeasesForExport', () => {
    it('includes Xpand leases when ended is requested', async () => {
      const rows = await tenfastLeaseSearchAdapter.fetchAllLeasesForExport(
        paged({ status: ['ended'] }),
        mockCtx
      )
      expect(ids(rows)).toEqual(['xpand-ended'])
    })

    it('leaves Xpand leases out when ended is not requested', async () => {
      const rows = await tenfastLeaseSearchAdapter.fetchAllLeasesForExport(
        paged({}),
        mockCtx
      )
      expect(ids(rows)).toEqual(['tenfast-current'])
    })

    it('answers 503 when the Xpand cache is not ready and ended is requested', async () => {
      xpandCache.isReady.mockReturnValue(false)
      await expect(
        tenfastLeaseSearchAdapter.fetchAllLeasesForExport(
          paged({ status: ['ended'] }),
          mockCtx
        )
      ).rejects.toMatchObject({ status: 503 })
    })
  })
})
