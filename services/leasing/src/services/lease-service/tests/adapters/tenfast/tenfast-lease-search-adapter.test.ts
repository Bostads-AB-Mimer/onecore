import { leasing, LeaseType, LeaseStatus } from '@onecore/types'

import * as tenfastLeaseSearchAdapter from '../../../adapters/tenfast/tenfast-lease-search-adapter'
import * as xpandLeaseSearchAdapter from '../../../adapters/xpand/lease-search-adapter'
import * as tenfastAdapter from '../../../adapters/tenfast/tenfast-adapter'
import * as leaseCache from '../../../../../common/lease-cache'
import config from '../../../../../common/config'
import * as factory from '../../factories'

jest.mock('../../../../../common/lease-cache', () => ({
  getAll: jest.fn(),
  refreshIfStale: jest.fn().mockResolvedValue(undefined),
  ensureReady: jest.fn().mockResolvedValue(false),
}))

jest.mock('../../../adapters/xpand/lease-search-adapter', () => ({
  getRentalObjectCodesByBuildingManager: jest.fn(),
  getRentalObjectCodesByBuildingCodes: jest.fn(),
  getRentalObjectCodesByAreaCodes: jest.fn(),
  getRentalObjectCodesByDistrictNames: jest.fn(),
  getRentalObjectCodesByKvvAreaCodes: jest.fn(),
  getParkingSpaceTypesByRentalObjectCode: jest.fn(),
}))

jest.mock('../../../adapters/xpand/tenant-lease-adapter', () => ({
  getContacts: jest.fn().mockResolvedValue([]),
}))

const mockedGetAll = leaseCache.getAll as jest.MockedFunction<
  typeof leaseCache.getAll
>

const mockedRefreshIfStale = leaseCache.refreshIfStale as jest.MockedFunction<
  typeof leaseCache.refreshIfStale
>

const mockedEnsureReady = leaseCache.ensureReady as jest.MockedFunction<
  typeof leaseCache.ensureReady
>

const mockedGetRentalObjectCodesByBuildingManager =
  xpandLeaseSearchAdapter.getRentalObjectCodesByBuildingManager as jest.MockedFunction<
    typeof xpandLeaseSearchAdapter.getRentalObjectCodesByBuildingManager
  >

const mockedGetRentalObjectCodesByBuildingCodes =
  xpandLeaseSearchAdapter.getRentalObjectCodesByBuildingCodes as jest.MockedFunction<
    typeof xpandLeaseSearchAdapter.getRentalObjectCodesByBuildingCodes
  >

const mockedGetRentalObjectCodesByAreaCodes =
  xpandLeaseSearchAdapter.getRentalObjectCodesByAreaCodes as jest.MockedFunction<
    typeof xpandLeaseSearchAdapter.getRentalObjectCodesByAreaCodes
  >

const mockedGetRentalObjectCodesByDistrictNames =
  xpandLeaseSearchAdapter.getRentalObjectCodesByDistrictNames as jest.MockedFunction<
    typeof xpandLeaseSearchAdapter.getRentalObjectCodesByDistrictNames
  >

const mockedGetRentalObjectCodesByKvvAreaCodes =
  xpandLeaseSearchAdapter.getRentalObjectCodesByKvvAreaCodes as jest.MockedFunction<
    typeof xpandLeaseSearchAdapter.getRentalObjectCodesByKvvAreaCodes
  >

const mockedGetParkingSpaceTypesByRentalObjectCode =
  xpandLeaseSearchAdapter.getParkingSpaceTypesByRentalObjectCode as jest.MockedFunction<
    typeof xpandLeaseSearchAdapter.getParkingSpaceTypesByRentalObjectCode
  >

const makeLeaseResult = (
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
  startDate: new Date('2024-01-01'),
  endDate: null,
  lastDebitDate: null,
  signedAt: null,
  status: LeaseStatus.Current,
  ...overrides,
})

const mockCtx = {
  query: { page: '1', limit: '20' },
  request: { URL: new URL('http://localhost:5020/api/leases/search') },
  throw: jest.fn().mockImplementation((status: number, msg: string) => {
    throw Object.assign(new Error(msg), { status })
  }),
} as any

describe('tenfast-lease-search-adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('searchLeases', () => {
    beforeEach(() => {
      mockedGetAll.mockReturnValue([makeLeaseResult('default-lease')])
    })

    // Basic
    it('returns paginated results from cache', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-1'),
        makeLeaseResult('lease-2'),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(2)
      expect(result._meta.totalRecords).toBe(2)
      expect(result._meta.page).toBe(1)
    })

    it('returns 503 when cache is empty', async () => {
      mockedGetAll.mockReturnValue([])

      await expect(
        tenfastLeaseSearchAdapter.searchLeases({ page: 1, limit: 20 }, mockCtx)
      ).rejects.toMatchObject({ status: 503 })

      expect(mockCtx.throw).toHaveBeenCalledWith(
        503,
        expect.any(String),
        expect.any(Object)
      )
    })

    it('returns all leases when no filters applied', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-1'),
        makeLeaseResult('lease-2'),
        makeLeaseResult('lease-3'),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(3)
      expect(result._meta.totalRecords).toBe(3)
    })

    // q search
    it('filters by q matching leaseId substring', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('TF/2024/001'),
        makeLeaseResult('TF/2024/002', {
          rentalObjectCode: 'ROC-002',
          contacts: [
            {
              name: 'Test Tenant',
              contactCode: 'P222222',
              email: null,
              phone: null,
              contactType: 'tenant' as const,
            },
          ],
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { q: '001', page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('TF/2024/001')
    })

    it('filters by q matching contact code substring', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-1', {
          contacts: [
            {
              name: 'Anna',
              contactCode: 'P965339',
              email: null,
              phone: null,
              contactType: 'tenant',
            },
          ],
        }),
        makeLeaseResult('lease-2', {
          contacts: [
            {
              name: 'Bob',
              contactCode: 'P111111',
              email: null,
              phone: null,
              contactType: 'tenant',
            },
          ],
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { q: 'P965339', page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-1')
    })

    it('filters by q matching address substring', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-1', { address: 'Kungsgatan 12' }),
        makeLeaseResult('lease-2', { address: 'Drottninggatan 5' }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { q: 'Kungsgatan', page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-1')
    })

    it('filters by q matching tenant name substring', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-1', {
          contacts: [
            {
              name: 'Anna Andersson',
              contactCode: 'P000001',
              email: null,
              phone: null,
              contactType: 'tenant',
            },
          ],
        }),
        makeLeaseResult('lease-2', {
          contacts: [
            {
              name: 'Bob Bengtsson',
              contactCode: 'P000002',
              email: null,
              phone: null,
              contactType: 'tenant',
            },
          ],
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { q: 'Anna', page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-1')
    })

    it('excludes leases that do not match q', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-1', {
          leaseId: 'lease-1',
          address: 'Storgatan 1',
          rentalObjectCode: 'ROC-AAA',
          contacts: [
            {
              name: 'Anna',
              contactCode: 'P000001',
              email: null,
              phone: null,
              contactType: 'tenant',
            },
          ],
        }),
        makeLeaseResult('lease-2', {
          leaseId: 'lease-2',
          address: 'Lillgatan 2',
          rentalObjectCode: 'ROC-BBB',
          contacts: [
            {
              name: 'Bob',
              contactCode: 'P000002',
              email: null,
              phone: null,
              contactType: 'tenant',
            },
          ],
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { q: 'ZZZNOMATCH', page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(0)
    })

    // Explicit filters
    it('filters by name param (tenant name substring)', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-1', {
          contacts: [
            {
              name: 'Anna Andersson',
              contactCode: 'P000001',
              email: null,
              phone: null,
              contactType: 'tenant',
            },
          ],
        }),
        makeLeaseResult('lease-2', {
          contacts: [
            {
              name: 'Bob Bengtsson',
              contactCode: 'P000002',
              email: null,
              phone: null,
              contactType: 'tenant',
            },
          ],
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { name: 'andersson', page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-1')
    })

    it('filters by address param', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-1', { address: 'Kungsgatan 12' }),
        makeLeaseResult('lease-2', { address: 'Vasagatan 5' }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { address: 'Vasagatan', page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-2')
    })

    // Status
    it('filters by status current', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('current-lease', { status: LeaseStatus.Current }),
        makeLeaseResult('ended-lease', { status: LeaseStatus.Ended }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { status: ['current'], page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('current-lease')
    })

    it('filters by status upcoming', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('upcoming-lease', {
          status: LeaseStatus.Upcoming,
          startDate: new Date('2027-01-01'),
        }),
        makeLeaseResult('current-lease', { status: LeaseStatus.Current }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { status: ['upcoming'], page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('upcoming-lease')
    })

    // ObjectType
    it('filters by single objectType', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('bostad-lease', {
          leaseType: LeaseType.HousingContract,
        }),
        makeLeaseResult('parkering-lease', {
          objectTypeCode: 'Parkering',
          leaseType: LeaseType.ParkingSpaceContract,
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { objectType: ['bostad'], page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('bostad-lease')
    })

    it('filters by multiple objectTypes', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('bostad-lease', {
          leaseType: LeaseType.HousingContract,
        }),
        makeLeaseResult('parkering-lease', {
          objectTypeCode: 'Parkering',
          leaseType: LeaseType.ParkingSpaceContract,
        }),
        makeLeaseResult('lokal-lease', {
          objectTypeCode: 'Lokal',
          leaseType: LeaseType.CommercialTenantContract,
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { objectType: ['bostad', 'parkering'], page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(2)
      const ids = result.content.map((l) => l.leaseId)
      expect(ids).toContain('bostad-lease')
      expect(ids).toContain('parkering-lease')
    })

    // parkingSpaceType
    it('filters by parkingSpaceType only', async () => {
      mockedGetParkingSpaceTypesByRentalObjectCode.mockResolvedValueOnce(
        new Map([['ROC-100', 'Kallgarage']])
      )
      mockedGetAll.mockReturnValue([
        makeLeaseResult('kallgarage-lease', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: 'ROC-100',
        }),
        makeLeaseResult('other-parking-lease', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: 'ROC-200',
        }),
        makeLeaseResult('bostad-lease'),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { parkingSpaceType: ['KALLGAR'], page: 1, limit: 20 },
        mockCtx
      )

      expect(mockedGetParkingSpaceTypesByRentalObjectCode).toHaveBeenCalledWith(
        ['KALLGAR']
      )
      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('kallgarage-lease')
    })

    it('combines objectType and parkingSpaceType as a union (Bostad + Kallgarage)', async () => {
      mockedGetParkingSpaceTypesByRentalObjectCode.mockResolvedValueOnce(
        new Map([['ROC-100', 'Kallgarage']])
      )
      mockedGetAll.mockReturnValue([
        makeLeaseResult('bostad-lease', { rentalObjectCode: 'ROC-001' }),
        makeLeaseResult('kallgarage-lease', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: 'ROC-100',
        }),
        makeLeaseResult('other-parking-lease', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: 'ROC-200',
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        {
          objectType: ['bostad'],
          parkingSpaceType: ['KALLGAR'],
          page: 1,
          limit: 20,
        },
        mockCtx
      )

      expect(result.content).toHaveLength(2)
      const ids = result.content.map((l) => l.leaseId)
      expect(ids).toContain('bostad-lease')
      expect(ids).toContain('kallgarage-lease')
    })

    it('a parkingSpaceType filter replaces plain "parkering" matching, even if both are sent', async () => {
      mockedGetParkingSpaceTypesByRentalObjectCode.mockResolvedValueOnce(
        new Map([['ROC-100', 'Kallgarage']])
      )
      mockedGetAll.mockReturnValue([
        makeLeaseResult('kallgarage-lease', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: 'ROC-100',
        }),
        makeLeaseResult('other-parking-lease', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: 'ROC-200',
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        {
          objectType: ['parkering'],
          parkingSpaceType: ['KALLGAR'],
          page: 1,
          limit: 20,
        },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('kallgarage-lease')
    })

    it('returns empty when parkingSpaceType matches no rental objects', async () => {
      mockedGetParkingSpaceTypesByRentalObjectCode.mockResolvedValueOnce(
        new Map()
      )
      mockedGetAll.mockReturnValue([
        makeLeaseResult('parkering-lease', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: 'ROC-200',
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { parkingSpaceType: ['__no_match__'], page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(0)
      expect(result._meta.totalRecords).toBe(0)
    })

    it('returns every housing lease when Bostad is combined with a parkingSpaceType that resolves to no rental objects', async () => {
      // Regression test: a type that only exists in company 999 (excluded
      // by the Xpand helper's company filter) must not make the whole
      // search return nothing — Bostad should still match its own leases.
      mockedGetParkingSpaceTypesByRentalObjectCode.mockResolvedValueOnce(
        new Map()
      )
      mockedGetAll.mockReturnValue([
        makeLeaseResult('bostad-lease-1', { rentalObjectCode: 'ROC-001' }),
        makeLeaseResult('bostad-lease-2', { rentalObjectCode: 'ROC-002' }),
        makeLeaseResult('parkering-lease', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: 'ROC-200',
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        {
          objectType: ['bostad'],
          parkingSpaceType: ['__company-999-only__'],
          page: 1,
          limit: 20,
        },
        mockCtx
      )

      expect(result.content).toHaveLength(2)
      const ids = result.content.map((l) => l.leaseId)
      expect(ids).toContain('bostad-lease-1')
      expect(ids).toContain('bostad-lease-2')
    })

    it('intersects parkingSpaceType with districtNames', async () => {
      mockedGetParkingSpaceTypesByRentalObjectCode.mockResolvedValueOnce(
        new Map([
          ['ROC-100', 'Kallgarage'],
          ['ROC-300', 'Kallgarage'],
        ])
      )
      mockedGetRentalObjectCodesByDistrictNames.mockResolvedValueOnce([
        'ROC-100',
      ])
      mockedGetAll.mockReturnValue([
        makeLeaseResult('in-district', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: 'ROC-100',
        }),
        makeLeaseResult('outside-district', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: 'ROC-300',
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        {
          districtNames: ['Distrikt Norr'],
          parkingSpaceType: ['KALLGAR'],
          page: 1,
          limit: 20,
        },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('in-district')
    })

    it('a lease without a rental object code never matches a parkingSpaceType filter', async () => {
      mockedGetParkingSpaceTypesByRentalObjectCode.mockResolvedValueOnce(
        new Map([['ROC-100', 'Kallgarage']])
      )
      mockedGetAll.mockReturnValue([
        makeLeaseResult('no-rental-object-code', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: null,
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { parkingSpaceType: ['KALLGAR'], page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(0)
    })

    // Date ranges
    it('filters by startDate range', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-2024', { startDate: new Date('2024-06-01') }),
        makeLeaseResult('lease-2020', { startDate: new Date('2020-01-01') }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        {
          startDateFrom: '2024-01-01',
          startDateTo: '2024-12-31',
          page: 1,
          limit: 20,
        },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-2024')
    })

    it('excludes leases without end date when endDate range filter is set', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-ending', {
          lastDebitDate: new Date('2026-09-15'),
          status: LeaseStatus.AboutToEnd,
        }),
        makeLeaseResult('lease-ongoing', {
          lastDebitDate: null,
          status: LeaseStatus.Current,
        }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        {
          endDateFrom: '2026-07-27',
          endDateTo: '2026-11-30',
          page: 1,
          limit: 20,
        },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-ending')
    })

    it('filters by endDate range', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-sep', { lastDebitDate: new Date('2026-09-01') }),
        makeLeaseResult('lease-dec', { lastDebitDate: new Date('2026-12-01') }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        {
          endDateFrom: '2026-08-01',
          endDateTo: '2026-10-01',
          page: 1,
          limit: 20,
        },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-sep')
    })

    // Sort
    it('sorts by leaseStartDate descending by default', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('older', { startDate: new Date('2020-01-01') }),
        makeLeaseResult('newer', { startDate: new Date('2024-01-01') }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content[0].leaseId).toBe('newer')
      expect(result.content[1].leaseId).toBe('older')
    })

    it('sorts ascending when sortOrder=asc', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('older', { startDate: new Date('2020-01-01') }),
        makeLeaseResult('newer', { startDate: new Date('2024-01-01') }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { sortBy: 'leaseStartDate', sortOrder: 'asc', page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content[0].leaseId).toBe('older')
      expect(result.content[1].leaseId).toBe('newer')
    })

    // Xpand-based filters
    it('filters by districtNames using rental object codes from Xpand', async () => {
      mockedGetRentalObjectCodesByDistrictNames.mockResolvedValueOnce([
        'ROC-500',
      ])
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-dist-1', { rentalObjectCode: 'ROC-500' }),
        makeLeaseResult('lease-other', { rentalObjectCode: 'ROC-999' }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { districtNames: ['Distrikt Norr'], page: 1, limit: 20 },
        mockCtx
      )

      expect(mockedGetRentalObjectCodesByDistrictNames).toHaveBeenCalledWith([
        'Distrikt Norr',
      ])
      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-dist-1')
    })

    it('filters by buildingManager using rental object codes from Xpand', async () => {
      mockedGetRentalObjectCodesByBuildingManager.mockResolvedValueOnce([
        'ROC-001',
        'ROC-002',
      ])
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-1', { rentalObjectCode: 'ROC-001' }),
        makeLeaseResult('lease-2', { rentalObjectCode: 'ROC-002' }),
        makeLeaseResult('lease-3', { rentalObjectCode: 'ROC-999' }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { buildingManager: ['Anna Andersson'], page: 1, limit: 20 },
        mockCtx
      )

      expect(mockedGetRentalObjectCodesByBuildingManager).toHaveBeenCalledWith([
        'Anna Andersson',
      ])
      expect(result.content).toHaveLength(2)
      expect(result._meta.totalRecords).toBe(2)
    })

    it('returns empty when buildingManager matches no rental objects', async () => {
      mockedGetRentalObjectCodesByBuildingManager.mockResolvedValueOnce([])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { buildingManager: ['Unknown Manager'], page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(0)
      expect(result._meta.totalRecords).toBe(0)
    })

    it('filters by kvvAreaCodes using rental object codes from Xpand', async () => {
      mockedGetRentalObjectCodesByKvvAreaCodes.mockResolvedValueOnce([
        'ROC-700',
      ])
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-kvv-1', { rentalObjectCode: 'ROC-700' }),
        makeLeaseResult('lease-other', { rentalObjectCode: 'ROC-999' }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { kvvAreaCodes: ['KVV21'], page: 1, limit: 20 },
        mockCtx
      )

      expect(mockedGetRentalObjectCodesByKvvAreaCodes).toHaveBeenCalledWith([
        'KVV21',
      ])
      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-kvv-1')
    })

    it('returns empty when kvvAreaCodes matches no rental objects', async () => {
      mockedGetRentalObjectCodesByKvvAreaCodes.mockResolvedValueOnce([])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { kvvAreaCodes: ['__no_match__'], page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(0)
      expect(result._meta.totalRecords).toBe(0)
    })

    it('filters by buildingCodes using rental object codes from Xpand', async () => {
      mockedGetRentalObjectCodesByBuildingCodes.mockResolvedValueOnce([
        'ROC-100',
      ])
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-bc-1', { rentalObjectCode: 'ROC-100' }),
        makeLeaseResult('lease-other', { rentalObjectCode: 'ROC-999' }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { buildingCodes: ['BYG-001'], page: 1, limit: 20 },
        mockCtx
      )

      expect(mockedGetRentalObjectCodesByBuildingCodes).toHaveBeenCalledWith([
        'BYG-001',
      ])
      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-bc-1')
    })

    it('filters by areaCodes using rental object codes from Xpand', async () => {
      mockedGetRentalObjectCodesByAreaCodes.mockResolvedValueOnce(['ROC-200'])
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-ac-1', { rentalObjectCode: 'ROC-200' }),
        makeLeaseResult('lease-other', { rentalObjectCode: 'ROC-999' }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { areaCodes: ['AREA-01'], page: 1, limit: 20 },
        mockCtx
      )

      expect(mockedGetRentalObjectCodesByAreaCodes).toHaveBeenCalledWith([
        'AREA-01',
      ])
      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-ac-1')
    })

    it('intersects codes when multiple Xpand filters are active', async () => {
      mockedGetRentalObjectCodesByBuildingManager.mockResolvedValueOnce([
        'ROC-001',
        'ROC-002',
      ])
      mockedGetRentalObjectCodesByBuildingCodes.mockResolvedValueOnce([
        'ROC-002',
        'ROC-003',
      ])
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-intersect', { rentalObjectCode: 'ROC-002' }),
        makeLeaseResult('lease-only-mgr', { rentalObjectCode: 'ROC-001' }),
        makeLeaseResult('lease-only-bld', { rentalObjectCode: 'ROC-003' }),
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        {
          buildingManager: ['Anna Andersson'],
          buildingCodes: ['BYG-002'],
          page: 1,
          limit: 20,
        },
        mockCtx
      )

      expect(mockedGetRentalObjectCodesByBuildingManager).toHaveBeenCalledWith([
        'Anna Andersson',
      ])
      expect(mockedGetRentalObjectCodesByBuildingCodes).toHaveBeenCalledWith([
        'BYG-002',
      ])
      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-intersect')
    })

    it('returns empty when intersected codes are empty', async () => {
      mockedGetRentalObjectCodesByBuildingManager.mockResolvedValueOnce([
        'ROC-001',
      ])
      mockedGetRentalObjectCodesByBuildingCodes.mockResolvedValueOnce([
        'ROC-999',
      ])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        {
          buildingManager: ['Anna Andersson'],
          buildingCodes: ['BYG-999'],
          page: 1,
          limit: 20,
        },
        mockCtx
      )

      expect(result.content).toHaveLength(0)
      expect(result._meta.totalRecords).toBe(0)
    })

    // Pagination
    it('paginates results correctly (page 2)', async () => {
      const allLeases = Array.from({ length: 5 }, (_, i) =>
        makeLeaseResult(`lease-${i}`, {
          startDate: new Date(`202${i}-01-01`),
        })
      )
      mockedGetAll.mockReturnValue(allLeases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { page: 2, limit: 2 },
        mockCtx
      )

      expect(result.content).toHaveLength(2)
      expect(result._meta.totalRecords).toBe(5)
      expect(result._meta.page).toBe(2)
      expect(result._meta.limit).toBe(2)
    })
  })

  describe('fetchAllLeasesForExport', () => {
    beforeEach(() => {
      mockedGetAll.mockReturnValue([makeLeaseResult('default-lease')])
      mockedGetParkingSpaceTypesByRentalObjectCode.mockResolvedValue(new Map())
    })

    it('refreshes a stale cache before reading it, same as searchLeases', async () => {
      await tenfastLeaseSearchAdapter.fetchAllLeasesForExport(
        { page: 1, limit: 500 },
        mockCtx
      )

      expect(mockedRefreshIfStale).toHaveBeenCalledWith(60_000, 10_000)
    })

    it('returns leases filtered and sorted from the cache', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-1'),
        makeLeaseResult('lease-2'),
      ])

      const result = await tenfastLeaseSearchAdapter.fetchAllLeasesForExport(
        { page: 1, limit: 500 },
        mockCtx
      )

      expect(result).toHaveLength(2)
    })

    it('throws 503 when the cache is empty and does not warm up in time, same as searchLeases', async () => {
      mockedGetAll.mockReturnValue([])
      mockedEnsureReady.mockResolvedValue(false)

      await expect(
        tenfastLeaseSearchAdapter.fetchAllLeasesForExport(
          { page: 1, limit: 500 },
          mockCtx
        )
      ).rejects.toMatchObject({ status: 503 })
    })

    it('fills parkingSpaceType on parking rows from a single Xpand lookup, without mutating cached rows', async () => {
      const cachedParkingLease = makeLeaseResult('parking-lease', {
        objectTypeCode: 'Parkering',
        rentalObjectCode: 'ROC-100',
      })
      const cachedHousingLease = makeLeaseResult('housing-lease', {
        rentalObjectCode: 'ROC-900',
      })
      mockedGetAll.mockReturnValue([cachedParkingLease, cachedHousingLease])
      mockedGetParkingSpaceTypesByRentalObjectCode.mockResolvedValueOnce(
        new Map([['ROC-100', 'Kallgarage']])
      )

      const result = await tenfastLeaseSearchAdapter.fetchAllLeasesForExport(
        { page: 1, limit: 500 },
        mockCtx
      )

      expect(
        mockedGetParkingSpaceTypesByRentalObjectCode
      ).toHaveBeenCalledWith()
      const parkingRow = result.find((l) => l.leaseId === 'parking-lease')
      const housingRow = result.find((l) => l.leaseId === 'housing-lease')
      expect(parkingRow?.parkingSpaceType).toBe('Kallgarage')
      expect(housingRow?.parkingSpaceType).toBeUndefined()
      expect(cachedParkingLease.parkingSpaceType).toBeUndefined()
    })

    it('exports without parkingSpaceType when the Xpand lookup fails, rather than failing the export', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('parking-lease', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: 'ROC-100',
        }),
      ])
      mockedGetParkingSpaceTypesByRentalObjectCode.mockRejectedValueOnce(
        new Error('Xpand unreachable')
      )

      const result = await tenfastLeaseSearchAdapter.fetchAllLeasesForExport(
        { page: 1, limit: 500 },
        mockCtx
      )

      expect(result).toHaveLength(1)
      expect(result[0].parkingSpaceType).toBeUndefined()
    })

    it('includes every housing lease when Bostad is combined with a parkingSpaceType that resolves to no rental objects, same as searchLeases', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('bostad-lease-1', { rentalObjectCode: 'ROC-001' }),
        makeLeaseResult('bostad-lease-2', { rentalObjectCode: 'ROC-002' }),
        makeLeaseResult('parkering-lease', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: 'ROC-200',
        }),
      ])
      // Default from beforeEach already resolves to an empty Map for both
      // the filtered (filter) and unfiltered (export column) lookups.

      const result = await tenfastLeaseSearchAdapter.fetchAllLeasesForExport(
        {
          objectType: ['bostad'],
          parkingSpaceType: ['__company-999-only__'],
          page: 1,
          limit: 500,
        },
        mockCtx
      )

      expect(result).toHaveLength(2)
      const ids = result.map((l) => l.leaseId)
      expect(ids).toContain('bostad-lease-1')
      expect(ids).toContain('bostad-lease-2')
    })
  })

  describe('fetchContactsForLeaseSearch', () => {
    const contact = (
      contactCode: string,
      name: string
    ): leasing.v1.ContactInfo => ({
      name,
      contactCode,
      email: null,
      phone: null,
      contactType: 'tenant',
    })

    // One lease per status the list can filter on, each with its own tenant.
    // 'ended' also reads the Xpand ended leases and is covered in
    // tenfast-lease-search-ended-xpand.test.ts.
    const leasesByStatus: [string, LeaseStatus, string][] = [
      ['current', LeaseStatus.Current, 'P000010'],
      ['upcoming', LeaseStatus.Upcoming, 'P000020'],
      ['abouttoend', LeaseStatus.AboutToEnd, 'P000030'],
      ['pendingsignature', LeaseStatus.PendingSignature, 'P000050'],
      ['preliminaryterminated', LeaseStatus.PreliminaryTerminated, 'P000060'],
      ['notsent', LeaseStatus.NotSent, 'P000070'],
    ]

    const contactCodesInList = async (
      params: Partial<leasing.v1.LeaseSearchQueryParams>
    ) => {
      const list = await tenfastLeaseSearchAdapter.searchLeases(
        { page: 1, limit: 500, ...params },
        mockCtx
      )
      return [
        ...new Set(
          list.content.flatMap(
            (lease) => lease.contacts?.map((c) => c.contactCode) ?? []
          )
        ),
      ].sort()
    }

    const contactCodesForSelectAll = async (
      params: Partial<leasing.v1.LeaseSearchQueryParams>
    ) => {
      const contacts =
        await tenfastLeaseSearchAdapter.fetchContactsForLeaseSearch(
          { page: 1, limit: 20, ...params },
          mockCtx
        )
      return contacts.map((c) => c.contactCode).sort()
    }

    beforeEach(() => {
      mockedGetAll.mockReturnValue(
        leasesByStatus.map(([param, status, contactCode]) =>
          makeLeaseResult(`lease-${param}`, {
            status,
            contacts: [contact(contactCode, `Tenant ${param}`)],
          })
        )
      )
    })

    it.each(leasesByStatus)(
      'returns only the contacts on the listed leases for status %s',
      async (param, _status, contactCode) => {
        const selectAll = await contactCodesForSelectAll({ status: [param] })

        expect(selectAll).toEqual([contactCode])
        expect(selectAll).toEqual(await contactCodesInList({ status: [param] }))
      }
    )

    it('narrows the contacts by tenant name, same as the list', async () => {
      const params = { name: 'tenant notsent' }

      const selectAll = await contactCodesForSelectAll(params)

      expect(selectAll).toEqual(['P000070'])
      expect(selectAll).toEqual(await contactCodesInList(params))
    })

    it('returns a contact once when it is on several leases', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-1', {
          contacts: [contact('P000001', 'Anna'), contact('P000002', 'Bob')],
        }),
        makeLeaseResult('lease-2', { contacts: [contact('P000001', 'Anna')] }),
      ])

      const contacts =
        await tenfastLeaseSearchAdapter.fetchContactsForLeaseSearch(
          { page: 1, limit: 20 },
          mockCtx
        )

      expect(contacts).toEqual([
        contact('P000001', 'Anna'),
        contact('P000002', 'Bob'),
      ])
    })

    it('returns a contact once when its code differs only in case or padding', async () => {
      mockedGetAll.mockReturnValue([
        makeLeaseResult('lease-1', { contacts: [contact('P000001', 'Anna')] }),
        makeLeaseResult('lease-2', { contacts: [contact('p000001 ', 'Anna')] }),
      ])

      const contacts =
        await tenfastLeaseSearchAdapter.fetchContactsForLeaseSearch(
          { page: 1, limit: 20, sortBy: 'leaseId', sortOrder: 'asc' },
          mockCtx
        )

      expect(contacts).toEqual([contact('P000001', 'Anna')])
    })

    it('returns contacts from every lease, not just the first page', async () => {
      mockedGetAll.mockReturnValue(
        Array.from({ length: 45 }, (_, i) =>
          makeLeaseResult(`lease-${i}`, {
            contacts: [
              contact(`P${String(i).padStart(6, '0')}`, `Tenant ${i}`),
            ],
          })
        )
      )

      const contacts =
        await tenfastLeaseSearchAdapter.fetchContactsForLeaseSearch(
          { page: 1, limit: 20 },
          mockCtx
        )

      expect(contacts).toHaveLength(45)
    })

    it('returns no contacts when an Xpand-bridged filter matches no rental object', async () => {
      mockedGetRentalObjectCodesByDistrictNames.mockResolvedValueOnce([])

      const contacts =
        await tenfastLeaseSearchAdapter.fetchContactsForLeaseSearch(
          { page: 1, limit: 20, districtNames: ['Nowhere'] },
          mockCtx
        )

      expect(contacts).toEqual([])
    })

    it('includes contacts from every housing lease when Bostad is combined with a parkingSpaceType that resolves to no rental objects, same as searchLeases', async () => {
      mockedGetParkingSpaceTypesByRentalObjectCode.mockResolvedValue(new Map())
      mockedGetAll.mockReturnValue([
        makeLeaseResult('bostad-lease-1', {
          rentalObjectCode: 'ROC-001',
          contacts: [contact('P000001', 'Anna')],
        }),
        makeLeaseResult('bostad-lease-2', {
          rentalObjectCode: 'ROC-002',
          contacts: [contact('P000002', 'Bob')],
        }),
        makeLeaseResult('parkering-lease', {
          objectTypeCode: 'Parkering',
          rentalObjectCode: 'ROC-200',
          contacts: [contact('P000003', 'Cecilia')],
        }),
      ])

      const selectAll = await contactCodesForSelectAll({
        objectType: ['bostad'],
        parkingSpaceType: ['__company-999-only__'],
      })

      expect(selectAll).toEqual(['P000001', 'P000002'])
    })

    it('throws 503 when the cache is empty and does not warm up in time, same as searchLeases', async () => {
      mockedGetAll.mockReturnValue([])
      mockedEnsureReady.mockResolvedValue(false)

      await expect(
        tenfastLeaseSearchAdapter.fetchContactsForLeaseSearch(
          { page: 1, limit: 20 },
          mockCtx
        )
      ).rejects.toMatchObject({ status: 503 })
    })
  })

  describe('fetchLeasesUpdatedSinceForCache', () => {
    it('puts archived leases in removedLeaseIds instead of changed', async () => {
      const active = factory.tenfastLease.build({
        externalId: 'lease-active',
        stage: 'active',
      })
      const archived = factory.tenfastLease.build({
        externalId: 'lease-archived',
        stage: 'archived',
      })

      jest.spyOn(tenfastAdapter, 'getLeasesUpdatedSince').mockResolvedValue({
        ok: true,
        data: [active, archived],
      })

      const result =
        await tenfastLeaseSearchAdapter.fetchLeasesUpdatedSinceForCache(
          new Date('2024-01-01')
        )

      expect(result.changed.map((l) => l.leaseId)).toEqual(['lease-active'])
      expect(result.removedLeaseIds).toEqual(['lease-archived'])
    })

    it('uses the preliminary end date while a notice awaits signing', async () => {
      const preliminaryEndDate = new Date('2027-02-28T00:00:00.000Z')

      jest.spyOn(tenfastAdapter, 'getLeasesUpdatedSince').mockResolvedValue({
        ok: true,
        data: [
          factory.tenfastLease.build({
            stage: 'terminationSigningInProgress',
            endDate: null,
            simplesignTermination: { signatures: [], preliminaryEndDate },
          }),
        ],
      })

      const result =
        await tenfastLeaseSearchAdapter.fetchLeasesUpdatedSinceForCache(
          new Date('2024-01-01')
        )

      expect(result.changed[0]).toMatchObject({
        endDate: preliminaryEndDate,
        lastDebitDate: preliminaryEndDate,
        status: LeaseStatus.PreliminaryTerminated,
      })
    })

    it.each(['förråd', 'Förråd', 'Forrad'])(
      'labels a "%s" lease as Lokal and types it as a commercial lease, like Xpand',
      async (typ) => {
        const lease = factory.tenfastLease.build({
          stage: 'active',
          hyresobjekt: [factory.tenfastRentalObject.build({ typ })],
        })

        jest.spyOn(tenfastAdapter, 'getLeasesUpdatedSince').mockResolvedValue({
          ok: true,
          data: [lease],
        })

        const result =
          await tenfastLeaseSearchAdapter.fetchLeasesUpdatedSinceForCache(
            new Date('2024-01-01')
          )

        expect(result.changed[0]).toMatchObject({
          objectTypeCode: 'Lokal',
          leaseType: LeaseType.CommercialTenantContract,
        })
      }
    )

    it('maps the Tenfast _id to an externalUrl', async () => {
      const originalAppUrl = config.tenfast.appUrl
      config.tenfast.appUrl = 'https://tenfast.example.com'

      jest.spyOn(tenfastAdapter, 'getLeasesUpdatedSince').mockResolvedValue({
        ok: true,
        data: [factory.tenfastLease.build({ _id: 'mongo-id-1' })],
      })

      const result =
        await tenfastLeaseSearchAdapter.fetchLeasesUpdatedSinceForCache(
          new Date('2024-01-01')
        )

      config.tenfast.appUrl = originalAppUrl

      expect(result.changed[0].externalUrl).toBe(
        'https://tenfast.example.com/hyresvard/avtal/mongo-id-1'
      )
    })

    it('throws when the adapter call fails', async () => {
      jest.spyOn(tenfastAdapter, 'getLeasesUpdatedSince').mockResolvedValue({
        ok: false,
        err: 'unknown',
      })

      await expect(
        tenfastLeaseSearchAdapter.fetchLeasesUpdatedSinceForCache(
          new Date('2024-01-01')
        )
      ).rejects.toThrow('fetchLeasesUpdatedSinceForCache')
    })
  })
})
