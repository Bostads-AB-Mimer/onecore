import { TenfastLease } from '../../../adapters/tenfast/schemas'
import { TenfastLeaseFactory } from '../../factories/tenfast-lease'
import { TenfastTenantFactory } from '../../factories/tenfast-tenant'
import { TenfastRentalObjectFactory } from '../../factories/tenfast-rental-object'

import * as tenfastLeaseSearchAdapter from '../../../adapters/tenfast/tenfast-lease-search-adapter'
import * as tenfastApi from '../../../adapters/tenfast/tenfast-api'
import * as xpandLeaseSearchAdapter from '../../../adapters/xpand/lease-search-adapter'

jest.mock('../../../adapters/tenfast/tenfast-api')
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

const mockedRequest = tenfastApi.request as jest.MockedFunction<
  typeof tenfastApi.request
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

const buildLeaseWithTenants = (
  overrides: Partial<TenfastLease> = {},
  tenantOverrides: Parameters<typeof TenfastTenantFactory.build>[0] = {},
  rentalObjectOverrides: Parameters<
    typeof TenfastRentalObjectFactory.build
  >[0] = {}
): TenfastLease => {
  return TenfastLeaseFactory.build({
    hyresgaster: [TenfastTenantFactory.build(tenantOverrides)],
    hyresobjekt: [
      TenfastRentalObjectFactory.build({
        subType: 'bostad',
        postadress: 'Testgatan 1',
        displayName: 'Testgatan 1, lgh 1001',
        ...rentalObjectOverrides,
      }),
    ],
    ...overrides,
  })
}

describe('tenfast-lease-search-adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('searchLeases', () => {
    const mockCtx = {
      query: { page: '1', limit: '20' },
      request: {
        URL: new URL('http://localhost:5020/api/leases/search'),
      },
    } as any

    const setupMockLeases = (
      leases: TenfastLease[],
      options?: { next?: string; totalCount?: number }
    ) => {
      mockedRequest.mockResolvedValueOnce({
        status: 200,
        data: {
          records: leases,
          next: options?.next ?? null,
          totalCount: options?.totalCount ?? leases.length,
        },
      } as any)
    }

    it('should return paginated results', async () => {
      const leases = [
        buildLeaseWithTenants({ externalId: 'lease-1' }),
        buildLeaseWithTenants({ externalId: 'lease-2' }),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(2)
      expect(result._meta.totalRecords).toBe(2)
      expect(result._meta.page).toBe(1)
    })

    it('should push digit search to API as idBeteckning filter', async () => {
      const leases = [buildLeaseWithTenants({ externalId: 'lease-1' })]
      setupMockLeases(leases)

      await tenfastLeaseSearchAdapter.searchLeases(
        { q: '0022', page: 1, limit: 20 },
        mockCtx
      )

      // Verify the API was called with idbeteckning filter
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain('filter[hyresgaster][idbeteckning]=0022')
    })

    it('should search by address when q is a name', async () => {
      const leases = [buildLeaseWithTenants({ externalId: 'lease-1' })]
      setupMockLeases(leases)

      await tenfastLeaseSearchAdapter.searchLeases(
        { q: 'Anna', page: 1, limit: 20 },
        mockCtx
      )

      // q='Anna' defaults to address search
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain('filter[hyresobjekt][postadress]=Anna')
    })

    it('should push explicit name param to API as displayName filter', async () => {
      const leases = [
        buildLeaseWithTenants(
          { externalId: 'lease-1' },
          { name: { first: 'Anna', last: 'Andersson' } }
        ),
      ]
      setupMockLeases(leases)

      await tenfastLeaseSearchAdapter.searchLeases(
        { name: 'Anna', page: 1, limit: 20 },
        mockCtx
      )

      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain('filter[hyresgaster][displayName]=Anna')
    })

    it('should push contact code search to API filter', async () => {
      const leases = [
        buildLeaseWithTenants(
          { externalId: 'lease-1' },
          { externalId: 'P965339' }
        ),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { q: 'P965339', page: 1, limit: 20 },
        mockCtx
      )

      // Verify the API was called with contact code filter
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain('filter[hyresgaster][externalId]=P965339')

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-1')
    })

    it('should push personnummer search to API filter', async () => {
      const leases = [
        buildLeaseWithTenants(
          { externalId: 'lease-1' },
          { idbeteckning: '198501011234' }
        ),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { q: '850101-1234', page: 1, limit: 20 },
        mockCtx
      )

      // Verify the API was called with idbeteckning filter (keeps original format with dash)
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain(
        'filter[hyresgaster][idbeteckning]=850101-1234'
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-1')
    })

    it('should search by address when q is an address string', async () => {
      const leases = [
        buildLeaseWithTenants(
          { externalId: 'lease-1' },
          {},
          { postadress: 'Kungsgatan 12' }
        ),
      ]
      setupMockLeases(leases)

      await tenfastLeaseSearchAdapter.searchLeases(
        { q: 'Kungsgatan 12', page: 1, limit: 20 },
        mockCtx
      )

      // q='Kungsgatan 12' defaults to address search
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain(
        'filter[hyresobjekt][postadress]=Kungsgatan+12'
      )
    })

    it('should push explicit address param to API as postadress filter', async () => {
      const leases = [
        buildLeaseWithTenants(
          { externalId: 'lease-1' },
          {},
          { postadress: 'Kungsgatan 12' }
        ),
      ]
      setupMockLeases(leases)

      await tenfastLeaseSearchAdapter.searchLeases(
        { address: 'Kungsgatan 12', page: 1, limit: 20 },
        mockCtx
      )

      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain('filter[hyresobjekt][postadress]=Kungsgatan')
    })

    it('should filter by status (current) via API stage filter', async () => {
      // 'current' maps to stage 'active' and is pushed to the API.
      // The mock simulates the API returning only matching leases.
      const leases = [
        buildLeaseWithTenants({
          externalId: 'current-lease',
          startDate: new Date('2020-01-01'),
          endDate: null,
        }),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { status: ['current'], page: 1, limit: 20 },
        mockCtx
      )

      // Verify the API was called with stage=active
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain('filter[stage]=active')

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('current-lease')
    })

    it('should filter by status (upcoming) via API stage filter', async () => {
      const leases = [
        buildLeaseWithTenants({
          externalId: 'upcoming-lease',
          startDate: new Date('2027-01-01'),
          endDate: null,
        }),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { status: ['upcoming'], page: 1, limit: 20 },
        mockCtx
      )

      // Verify the API was called with stage=upcoming
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain('filter[stage]=upcoming')

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('upcoming-lease')
    })

    it('should pass date filters as comma-separated range to Tenfast API', async () => {
      const leases = [
        buildLeaseWithTenants({
          externalId: 'lease-2024',
          startDate: new Date('2024-06-01'),
        }),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        {
          startDateFrom: '2024-01-01',
          startDateTo: '2024-12-31',
          page: 1,
          limit: 20,
        },
        mockCtx
      )

      // Verify the API was called with comma-separated date range
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain('filter[startDate]=2024-01-01,2024-12-31')

      // The API returns pre-filtered results
      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-2024')
    })

    it('should sort by leaseStartDate descending by default', async () => {
      const leases = [
        buildLeaseWithTenants({
          externalId: 'older',
          startDate: new Date('2020-01-01'),
        }),
        buildLeaseWithTenants({
          externalId: 'newer',
          startDate: new Date('2024-01-01'),
        }),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content[0].leaseId).toBe('newer')
      expect(result.content[1].leaseId).toBe('older')
    })

    it('should sort ascending when specified', async () => {
      const leases = [
        buildLeaseWithTenants({
          externalId: 'older',
          startDate: new Date('2020-01-01'),
        }),
        buildLeaseWithTenants({
          externalId: 'newer',
          startDate: new Date('2024-01-01'),
        }),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { sortBy: 'leaseStartDate', sortOrder: 'asc', page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content[0].leaseId).toBe('older')
      expect(result.content[1].leaseId).toBe('newer')
    })

    it('should paginate results correctly', async () => {
      const page1Leases = Array.from({ length: 2 }, (_, i) =>
        buildLeaseWithTenants({
          externalId: `lease-${i}`,
          startDate: new Date(`202${i}-01-01`),
        })
      )
      const page2Leases = Array.from({ length: 2 }, (_, i) =>
        buildLeaseWithTenants({
          externalId: `lease-${i + 2}`,
          startDate: new Date(`202${i + 2}-01-01`),
        })
      )

      // Page 1 (skipped), then page 2 (target)
      mockedRequest
        .mockResolvedValueOnce({
          status: 200,
          data: {
            records: page1Leases,
            next: 'cursor-page2',
            totalCount: 5,
          },
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: {
            records: page2Leases,
            next: 'cursor-page3',
            totalCount: 5,
          },
        } as any)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { page: 2, limit: 2 },
        mockCtx
      )

      expect(result.content).toHaveLength(2)
      expect(result._meta.totalRecords).toBe(5)
      expect(result._meta.page).toBe(2)
      expect(result._meta.limit).toBe(2)
      expect(mockedRequest).toHaveBeenCalledTimes(2)
    })

    it('should transform tenants to contacts in results', async () => {
      const leases = [
        buildLeaseWithTenants(
          { externalId: 'lease-1' },
          {
            displayName: 'Anna Andersson',
            externalId: 'P965339',
            phone: '0701234567',
          }
        ),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content[0].contacts).toHaveLength(1)
      expect(result.content[0].contacts[0].contactCode).toBe('P965339')
      expect(result.content[0].contacts[0].name).toBe('Anna Andersson')
    })

    it('should include address from rental object', async () => {
      const leases = [
        buildLeaseWithTenants(
          { externalId: 'lease-1' },
          {},
          { postadress: 'Kungsgatan 12' }
        ),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content[0].address).toBe('Kungsgatan 12')
    })

    it('should throw error when Tenfast request fails', async () => {
      mockedRequest.mockResolvedValueOnce({
        status: 500,
        data: { error: 'Internal Server Error' },
      } as any)

      await expect(
        tenfastLeaseSearchAdapter.searchLeases({ page: 1, limit: 20 }, mockCtx)
      ).rejects.toThrow('Failed to fetch leases from Tenfast')
    })

    it('should filter by single object type via API', async () => {
      const leases = [
        buildLeaseWithTenants(
          { externalId: 'bostad-lease' },
          {},
          { subType: 'bostad' }
        ),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { objectType: ['bostad'], page: 1, limit: 20 },
        mockCtx
      )

      // Verify the API was called with objectType filter
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain('filter[hyresobjekt][typ]=bostad')

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('bostad-lease')
    })

    it('should push multiple object types as comma-separated to API', async () => {
      const leases = [
        buildLeaseWithTenants(
          { externalId: 'bostad-lease' },
          {},
          { subType: 'bostad' }
        ),
        buildLeaseWithTenants(
          { externalId: 'parkering-lease' },
          {},
          { subType: 'parkering' }
        ),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { objectType: ['bostad', 'parkering'], page: 1, limit: 20 },
        mockCtx
      )

      // Verify comma-separated filter was pushed to API
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain('filter[hyresobjekt][typ]=bostad,parkering')

      expect(result.content).toHaveLength(2)
    })

    it('should return all leases when no filters are applied', async () => {
      const leases = [
        buildLeaseWithTenants({ externalId: 'lease-1' }),
        buildLeaseWithTenants({ externalId: 'lease-2' }),
        buildLeaseWithTenants({ externalId: 'lease-3' }),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(3)
      expect(result._meta.totalRecords).toBe(3)
    })

    it('should filter by districtNames via batch-get', async () => {
      mockedGetRentalObjectCodesByDistrictNames.mockResolvedValueOnce([
        'ROC-500',
      ])

      mockedRequest.mockResolvedValueOnce({
        status: 200,
        data: [
          {
            externalId: 'ROC-500',
            avtal: [
              {
                externalId: 'lease-dist-1',
                startDate: '2024-01-01',
                stage: 'active',
                uppsagningstid: '',
                cancellation: { cancelled: false },
                hyror: [],
                originalData: {
                  hyresgaster: [
                    {
                      externalId: 'T-500',
                      displayName: 'District Tenant',
                      idbeteckning: '199001011234',
                    },
                  ],
                  hyresobjekt: [
                    { externalId: 'ROC-500', postadress: 'Distriktsgatan 1' },
                  ],
                },
              },
            ],
          },
        ],
      } as any)

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

    it('should exclude leases without end date when end date range filter is set', async () => {
      mockedGetRentalObjectCodesByDistrictNames.mockResolvedValueOnce([
        'ROC-600',
        'ROC-601',
      ])

      mockedRequest.mockResolvedValueOnce({
        status: 200,
        data: [
          {
            externalId: 'ROC-600',
            avtal: [
              {
                externalId: 'lease-ending',
                startDate: '2024-01-01',
                endDate: '2026-09-15',
                stage: 'terminationScheduled',
                uppsagningstid: '',
                cancellation: { cancelled: false },
                hyror: [],
                originalData: {
                  hyresgaster: [
                    {
                      externalId: 'T-600',
                      displayName: 'Ending Tenant',
                      idbeteckning: '199001011234',
                    },
                  ],
                  hyresobjekt: [
                    { externalId: 'ROC-600', postadress: 'Slutgatan 1' },
                  ],
                },
              },
            ],
          },
          {
            externalId: 'ROC-601',
            avtal: [
              {
                externalId: 'lease-ongoing',
                startDate: '2024-01-01',
                stage: 'active',
                uppsagningstid: '',
                cancellation: { cancelled: false },
                hyror: [],
                originalData: {
                  hyresgaster: [
                    {
                      externalId: 'T-601',
                      displayName: 'Ongoing Tenant',
                      idbeteckning: '199001011234',
                    },
                  ],
                  hyresobjekt: [
                    { externalId: 'ROC-601', postadress: 'Pågåendegatan 1' },
                  ],
                },
              },
            ],
          },
        ],
      } as any)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        {
          districtNames: ['Distrikt Norr'],
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

    it('should filter by buildingManager via batch-get', async () => {
      mockedGetRentalObjectCodesByBuildingManager.mockResolvedValueOnce([
        'ROC-001',
        'ROC-002',
      ])

      mockedRequest.mockResolvedValueOnce({
        status: 200,
        data: [
          {
            externalId: 'ROC-001',
            avtal: [
              {
                externalId: 'lease-1',
                startDate: '2024-01-01',
                stage: 'active',
                uppsagningstid: '',
                cancellation: { cancelled: false },
                hyror: [],
                originalData: {
                  hyresgaster: [
                    {
                      externalId: 'T-001',
                      displayName: 'Anna Tenant',
                      idbeteckning: '199001011234',
                    },
                  ],
                  hyresobjekt: [
                    { externalId: 'ROC-001', postadress: 'Testgatan 1' },
                  ],
                },
              },
            ],
          },
          {
            externalId: 'ROC-002',
            avtal: [
              {
                externalId: 'lease-2',
                startDate: '2024-01-01',
                stage: 'active',
                uppsagningstid: '',
                cancellation: { cancelled: false },
                hyror: [],
                originalData: {
                  hyresgaster: [
                    {
                      externalId: 'T-002',
                      displayName: 'Bob Tenant',
                      idbeteckning: '199002021234',
                    },
                  ],
                  hyresobjekt: [
                    { externalId: 'ROC-002', postadress: 'Testgatan 2' },
                  ],
                },
              },
            ],
          },
        ],
      } as any)

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

    it('should return empty when buildingManager matches no rental objects', async () => {
      mockedGetRentalObjectCodesByBuildingManager.mockResolvedValueOnce([])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { buildingManager: ['Unknown Manager'], page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(0)
      expect(result._meta.totalRecords).toBe(0)
      expect(mockedRequest).not.toHaveBeenCalled()
    })

    it('should filter by kvvAreaCodes via batch-get', async () => {
      mockedGetRentalObjectCodesByKvvAreaCodes.mockResolvedValueOnce([
        'ROC-700',
      ])

      mockedRequest.mockResolvedValueOnce({
        status: 200,
        data: [
          {
            externalId: 'ROC-700',
            avtal: [
              {
                externalId: 'lease-kvv-1',
                startDate: '2024-01-01',
                stage: 'active',
                uppsagningstid: '',
                cancellation: { cancelled: false },
                hyror: [],
                originalData: {
                  hyresgaster: [
                    {
                      externalId: 'T-700',
                      displayName: 'Kvv Tenant',
                      idbeteckning: '199001011234',
                    },
                  ],
                  hyresobjekt: [
                    { externalId: 'ROC-700', postadress: 'Kvartersgatan 1' },
                  ],
                },
              },
            ],
          },
        ],
      } as any)

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

    it('should return empty when kvvAreaCodes matches no rental objects', async () => {
      mockedGetRentalObjectCodesByKvvAreaCodes.mockResolvedValueOnce([])

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { kvvAreaCodes: ['__no_match__'], page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(0)
      expect(result._meta.totalRecords).toBe(0)
      expect(mockedRequest).not.toHaveBeenCalled()
    })

    it('should filter by buildingCodes via batch-get', async () => {
      mockedGetRentalObjectCodesByBuildingCodes.mockResolvedValueOnce([
        'ROC-100',
      ])

      mockedRequest.mockResolvedValueOnce({
        status: 200,
        data: [
          {
            externalId: 'ROC-100',
            avtal: [
              {
                externalId: 'lease-bc-1',
                startDate: '2024-03-01',
                stage: 'active',
                uppsagningstid: '',
                cancellation: { cancelled: false },
                hyror: [],
                originalData: {
                  hyresgaster: [
                    {
                      externalId: 'T-100',
                      displayName: 'BC Tenant',
                      idbeteckning: '199003031234',
                    },
                  ],
                  hyresobjekt: [
                    { externalId: 'ROC-100', postadress: 'Bygggatan 5' },
                  ],
                },
              },
            ],
          },
        ],
      } as any)

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

    it('should filter by areaCodes via batch-get', async () => {
      mockedGetRentalObjectCodesByAreaCodes.mockResolvedValueOnce(['ROC-200'])

      mockedRequest.mockResolvedValueOnce({
        status: 200,
        data: [
          {
            externalId: 'ROC-200',
            avtal: [
              {
                externalId: 'lease-ac-1',
                startDate: '2024-04-01',
                stage: 'active',
                uppsagningstid: '',
                cancellation: { cancelled: false },
                hyror: [],
                originalData: {
                  hyresgaster: [
                    {
                      externalId: 'T-200',
                      displayName: 'AC Tenant',
                      idbeteckning: '199004041234',
                    },
                  ],
                  hyresobjekt: [
                    { externalId: 'ROC-200', postadress: 'Områdesgatan 3' },
                  ],
                },
              },
            ],
          },
        ],
      } as any)

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

    it('should intersect codes when multiple Xpand filters are active', async () => {
      // buildingManager returns ROC-001, ROC-002
      mockedGetRentalObjectCodesByBuildingManager.mockResolvedValueOnce([
        'ROC-001',
        'ROC-002',
      ])
      // buildingCodes returns ROC-002, ROC-003
      mockedGetRentalObjectCodesByBuildingCodes.mockResolvedValueOnce([
        'ROC-002',
        'ROC-003',
      ])

      // Only ROC-002 is in the intersection
      mockedRequest.mockResolvedValueOnce({
        status: 200,
        data: [
          {
            externalId: 'ROC-002',
            avtal: [
              {
                externalId: 'lease-intersect',
                startDate: '2024-05-01',
                stage: 'active',
                uppsagningstid: '',
                cancellation: { cancelled: false },
                hyror: [],
                originalData: {
                  hyresgaster: [
                    {
                      externalId: 'T-300',
                      displayName: 'Intersect Tenant',
                      idbeteckning: '199005051234',
                    },
                  ],
                  hyresobjekt: [
                    { externalId: 'ROC-002', postadress: 'Korsningen 1' },
                  ],
                },
              },
            ],
          },
        ],
      } as any)

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

    it('should return empty when intersected codes are empty', async () => {
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
      // No batch-get call since intersection is empty
      expect(mockedRequest).not.toHaveBeenCalled()
    })
  })
})
