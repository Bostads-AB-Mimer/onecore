import { leasing, LeaseType, LeaseStatus } from '@onecore/types'
import { logger } from '@onecore/utilities'

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
  getParkingSpaceTypesByRentalObjectCode: jest.fn(),
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

const mockedGetParkingSpaceTypesByRentalObjectCode =
  xpandLeaseSearchAdapter.getParkingSpaceTypesByRentalObjectCode as jest.MockedFunction<
    typeof xpandLeaseSearchAdapter.getParkingSpaceTypesByRentalObjectCode
  >

// Stands in for Xpand's parking spaces: rental object code -> babpt code and
// caption. Like the real lookup, passing type codes returns only those types.
const mockXpandParkingSpaces = (
  spaces: Record<string, { code: string; caption: string }>
) =>
  mockedGetParkingSpaceTypesByRentalObjectCode.mockImplementation(
    async (typeCodes) =>
      new Map(
        Object.entries(spaces)
          .filter(([, type]) => !typeCodes || typeCodes.includes(type.code))
          .map(([rentalObjectCode, type]) => [rentalObjectCode, type.caption])
      )
  )

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
    jest.spyOn(logger, 'warn').mockImplementation()
    mockedTenfastGetAll.mockReturnValue([makeResult('tenfast-current')])
    xpandCache.isReady.mockReturnValue(true)
    xpandCache.getAll.mockReturnValue([makeXpandEnded('xpand-ended')])
    // The export always looks up the garage spaces; one garage keeps the
    // "no garage at all" warning out of tests that count warnings.
    mockXpandParkingSpaces({
      'GARAGE-0': { code: 'VARMGAR', caption: 'Varmgarage' },
    })
  })

  describe('contract type (leaseType)', () => {
    const parking = (
      make: typeof makeResult,
      id: string,
      rentalObjectCode: string,
      leaseType: LeaseType
    ) => make(id, { objectTypeCode: 'Parkering', rentalObjectCode, leaseType })

    beforeEach(() => {
      // Spaces GARAGE-1 and GARAGE-2 have a garage type today.
      mockXpandParkingSpaces({
        'GARAGE-1': { code: 'VARMGAR', caption: 'Varmgarage' },
        'GARAGE-2': { code: 'KALLGAR', caption: 'Kallgarage' },
        'OPEN-1': { code: 'PPLUEL', caption: 'P-plats utan el' },
      })
      mockedTenfastGetAll.mockReturnValue([
        parking(
          makeResult,
          'tenfast-garage',
          'GARAGE-1',
          LeaseType.ParkingSpaceContract
        ),
      ])
      xpandCache.getAll.mockReturnValue([
        // Was a P-Platskontrakt in Xpand although the space is a garage now.
        parking(
          makeXpandEnded,
          'xpand-p-plats',
          'GARAGE-2',
          LeaseType.ParkingSpaceContract
        ),
        // Was a Garagekontrakt in Xpand on a space that has no garage type.
        parking(
          makeXpandEnded,
          'xpand-garage',
          'OPEN-1',
          LeaseType.GarageContract
        ),
      ])
    })

    const typesById = (rows: leasing.v1.LeaseSearchResult[]) =>
      Object.fromEntries(rows.map((r) => [r.leaseId, r.leaseType]))

    it('keeps the contract type a lease had in Xpand, and derives it for Tenfast leases', async () => {
      const garages = await search({
        includeEnded: true,
        leaseType: ['Garagekontrakt'],
      })
      const parkingSpaces = await search({
        includeEnded: true,
        leaseType: ['P-Platskontrakt'],
      })

      expect(typesById(garages)).toEqual({
        'tenfast-garage': LeaseType.GarageContract,
        'xpand-garage': LeaseType.GarageContract,
      })
      expect(typesById(parkingSpaces)).toEqual({
        'xpand-p-plats': LeaseType.ParkingSpaceContract,
      })
    })

    it('counts a contract type only ended Xpand leases have as Övrigt', async () => {
      xpandCache.getAll.mockReturnValue([
        makeXpandEnded('xpand-campus', { leaseType: LeaseType.CampusContract }),
        makeXpandEnded('xpand-housing'),
      ])

      const other = await search({ status: ['ended'], leaseType: ['Övrigt'] })
      const housing = await search({
        status: ['ended'],
        leaseType: ['Bostadskontrakt'],
      })

      expect(ids(other)).toEqual(['xpand-campus'])
      // The row keeps its own type; only the filter groups it under Övrigt.
      expect(other[0].leaseType).toBe(LeaseType.CampusContract)
      expect(ids(housing)).toEqual(['xpand-housing'])
      expect(
        mockedGetParkingSpaceTypesByRentalObjectCode
      ).not.toHaveBeenCalled()
    })

    it('lists the same leases with all five contract types chosen as with none', async () => {
      xpandCache.getAll.mockReturnValue([
        ...xpandCache.getAll(),
        makeXpandEnded('xpand-campus', { leaseType: LeaseType.CampusContract }),
        makeXpandEnded('xpand-housing'),
      ])

      const all = await search({
        includeEnded: true,
        leaseType: [
          'Bostadskontrakt',
          'Lokalkontrakt',
          'Garagekontrakt',
          'P-Platskontrakt',
          'Övrigt',
        ],
      })
      const unfiltered = await search({ includeEnded: true })

      expect(ids(all).sort()).toEqual(ids(unfiltered).sort())
      expect(all).toHaveLength(5)
    })

    it('exports the Xpand contract type for ended Xpand leases', async () => {
      const rows = await tenfastLeaseSearchAdapter.fetchAllLeasesForExport(
        paged({ includeEnded: true }),
        mockCtx
      )

      expect(typesById(rows)).toEqual({
        'tenfast-garage': LeaseType.GarageContract,
        'xpand-p-plats': LeaseType.ParkingSpaceContract,
        'xpand-garage': LeaseType.GarageContract,
      })
      // The caption column comes from the lookup over every parking space.
      expect(
        rows.find((r) => r.leaseId === 'xpand-garage')?.parkingSpaceType
      ).toBe('P-plats utan el')
    })
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

    it('picks up new rows after either cache reloads', async () => {
      const tenfastRows = [makeResult('tenfast-current')]
      mockedTenfastGetAll.mockReturnValue(tenfastRows)
      expect(ids(await search({ status: ['ended'] }))).toEqual(['xpand-ended'])

      xpandCache.getAll.mockReturnValue([makeXpandEnded('xpand-reloaded')])
      expect(ids(await search({ status: ['ended'] }))).toEqual([
        'xpand-reloaded',
      ])

      mockedTenfastGetAll.mockReturnValue([
        makeResult('xpand-reloaded', { status: LeaseStatus.Current }),
      ])
      expect(ids(await search({ status: ['ended'] }))).toEqual([])
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

    it('serves Tenfast rows only for includeEnded when the Xpand cache is not ready', async () => {
      xpandCache.isReady.mockReturnValue(false)
      const rows = await search({ includeEnded: true } as any)
      expect(ids(rows)).toEqual(['tenfast-current'])
      expect(logger.warn).toHaveBeenCalledTimes(1)
    })

    it('answers 503 when status names ended even with includeEnded', async () => {
      xpandCache.isReady.mockReturnValue(false)
      await expect(
        tenfastLeaseSearchAdapter.searchLeases(
          { includeEnded: true, status: ['ended'] } as any,
          mockCtx
        )
      ).rejects.toMatchObject({ status: 503 })
    })

    it('keeps an ended Garagekontrakt on a babps object under parkering, not ovrigt', async () => {
      xpandCache.getAll.mockReturnValue([
        makeXpandEnded('xpand-garage', {
          objectTypeCode: 'Parkering',
          leaseType: LeaseType.GarageContract,
        }),
      ])
      expect(
        ids(await search({ status: ['ended'], objectType: ['parkering'] }))
      ).toEqual(['xpand-garage'])
      expect(
        ids(await search({ status: ['ended'], objectType: ['ovrigt'] }))
      ).toEqual([])
    })

    it('keeps a Kooperativ-style Xpand lease on a balgh object under bostad', async () => {
      xpandCache.getAll.mockReturnValue([
        makeXpandEnded('xpand-coop', {
          objectTypeCode: 'Bostad',
          leaseType: LeaseType.OtherContract,
        }),
      ])
      expect(
        ids(await search({ status: ['ended'], objectType: ['bostad'] }))
      ).toEqual(['xpand-coop'])
      expect(
        ids(await search({ status: ['ended'], objectType: ['ovrigt'] }))
      ).toEqual([])
    })

    it('filters Tenfast rows by label the way leaseType did', async () => {
      const typs: [string, LeaseType, string][] = [
        ['Bostad', LeaseType.HousingContract, 'bostad'],
        ['Parkering', LeaseType.ParkingSpaceContract, 'parkering'],
        ['Lokal', LeaseType.CommercialTenantContract, 'lokal'],
        ['Lokal', LeaseType.CommercialTenantContract, 'lokal'],
        ['garage', LeaseType.GarageContract, 'ovrigt'],
        ['mark', LeaseType.OtherContract, 'ovrigt'],
        ['Övrigt', LeaseType.OtherContract, 'ovrigt'],
        ['', LeaseType.OtherContract, 'ovrigt'],
      ]
      mockedTenfastGetAll.mockReturnValue(
        typs.map(([label, leaseType], i) =>
          makeResult(`t${i}`, { objectTypeCode: label, leaseType })
        )
      )
      for (const param of ['bostad', 'parkering', 'lokal', 'ovrigt']) {
        const expected = typs
          .map(([, , p], i) => (p === param ? `t${i}` : null))
          .filter(Boolean)
        expect(ids(await search({ objectType: [param] })).sort()).toEqual(
          expected
        )
      }
    })

    it('serves the Tenfast result when the Xpand cache is not ready and ended is not requested', async () => {
      xpandCache.isReady.mockReturnValue(false)
      const rows = await search({ status: ['current'] })
      expect(ids(rows)).toEqual(['tenfast-current'])
    })
  })

  describe('filter and sort memo', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => makeResult(`m${i}`))

    it('filters and sorts once across page changes, and rebuilds when the cache array changes', async () => {
      const rows = many(5)
      mockedTenfastGetAll.mockReturnValue(rows)
      const filterSpy = jest.spyOn(rows, 'filter')

      const page = (n: number, q = 'm') =>
        tenfastLeaseSearchAdapter.searchLeases(
          { q, limit: 2, page: n },
          mockCtx
        )
      const first = await page(1)
      const second = await page(2)
      expect(filterSpy).toHaveBeenCalledTimes(1)
      expect(first.content).toHaveLength(2)
      expect(second.content).toHaveLength(2)
      expect(second._meta.totalRecords).toBe(5)

      await page(1, 'm1')
      expect(filterSpy).toHaveBeenCalledTimes(2)

      const reloaded = many(5)
      mockedTenfastGetAll.mockReturnValue(reloaded)
      const reloadedSpy = jest.spyOn(reloaded, 'filter')
      await page(1)
      expect(reloadedSpy).toHaveBeenCalledTimes(1)
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

    it('serves Tenfast rows only in export for includeEnded when the Xpand cache is not ready', async () => {
      xpandCache.isReady.mockReturnValue(false)
      const rows = await tenfastLeaseSearchAdapter.fetchAllLeasesForExport(
        paged({ includeEnded: true } as any),
        mockCtx
      )
      expect(ids(rows)).toEqual(['tenfast-current'])
      expect(logger.warn).toHaveBeenCalledTimes(1)
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

  describe('fetchContactsForLeaseSearch', () => {
    const tenant = (contactCode: string): leasing.v1.ContactInfo => ({
      name: 'Test Tenant',
      contactCode,
      email: null,
      phone: null,
      contactType: 'tenant',
    })

    const contactCodes = async (params: SearchParams) =>
      (
        await tenfastLeaseSearchAdapter.fetchContactsForLeaseSearch(
          paged(params),
          mockCtx
        )
      ).map((c) => c.contactCode)

    beforeEach(() => {
      mockedTenfastGetAll.mockReturnValue([
        makeResult('tenfast-current', { contacts: [tenant('P000001')] }),
      ])
      xpandCache.getAll.mockReturnValue([
        makeXpandEnded('xpand-ended', { contacts: [tenant('P000002')] }),
      ])
    })

    it('leaves out contacts on ended Xpand leases when ended is not requested', async () => {
      expect(await contactCodes({ status: ['current'] })).toEqual(['P000001'])
      expect(await contactCodes({})).toEqual(['P000001'])
    })

    it('returns contacts on ended Xpand leases when the list shows them', async () => {
      expect(await contactCodes({ status: ['ended'] })).toEqual(['P000002'])
    })

    it('answers 503 when the Xpand cache is not ready and ended is requested', async () => {
      xpandCache.isReady.mockReturnValue(false)
      await expect(contactCodes({ status: ['ended'] })).rejects.toMatchObject({
        status: 503,
      })
    })
  })
})
