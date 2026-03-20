import { TenfastLease } from '../../../adapters/tenfast/schemas'
import { TenfastLeaseFactory } from '../../factories/tenfast-lease'
import { TenfastTenantFactory } from '../../factories/tenfast-tenant'
import { TenfastRentalObjectFactory } from '../../factories/tenfast-rental-object'

import * as tenfastLeaseSearchAdapter from '../../../adapters/tenfast/tenfast-lease-search-adapter'
import * as tenfastApi from '../../../adapters/tenfast/tenfast-api'

jest.mock('../../../adapters/tenfast/tenfast-api')

const mockedRequest = tenfastApi.request as jest.MockedFunction<
  typeof tenfastApi.request
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

  describe('analyzeSearchTermForApi', () => {
    it('should detect contact code (letter + digits)', () => {
      const result =
        tenfastLeaseSearchAdapter.analyzeSearchTermForApi('P965339')
      expect(result).toEqual([
        {
          filterKey: 'filter[hyresgast][externalId]',
          filterValue: 'P965339',
        },
      ])
    })

    it('should uppercase contact code', () => {
      const result =
        tenfastLeaseSearchAdapter.analyzeSearchTermForApi('p965339')
      expect(result).toEqual([
        {
          filterKey: 'filter[hyresgast][externalId]',
          filterValue: 'P965339',
        },
      ])
    })

    it('should detect personnummer with dash (≥6 digits)', () => {
      const result =
        tenfastLeaseSearchAdapter.analyzeSearchTermForApi('850101-1234')
      expect(result).toEqual([
        {
          filterKey: 'filter[hyresgast][idBeteckning]',
          filterValue: '850101-1234',
        },
      ])
    })

    it('should detect personnummer without dash (≥6 digits)', () => {
      const result =
        tenfastLeaseSearchAdapter.analyzeSearchTermForApi('198501011234')
      expect(result).toEqual([
        {
          filterKey: 'filter[hyresgast][idBeteckning]',
          filterValue: '198501011234',
        },
      ])
    })

    it('should detect short digit strings as idBeteckning', () => {
      const result = tenfastLeaseSearchAdapter.analyzeSearchTermForApi('0022')
      expect(result).toEqual([
        {
          filterKey: 'filter[hyresgast][idBeteckning]',
          filterValue: '0022',
        },
      ])
    })

    it('should detect lease ID containing /', () => {
      const result =
        tenfastLeaseSearchAdapter.analyzeSearchTermForApi('206-706-00-0005/04')
      expect(result).toEqual([
        {
          filterKey: 'filter[externalId]',
          filterValue: '206-706-00-0005/04',
        },
      ])
    })

    it('should return empty for letters-only (use explicit name param instead)', () => {
      expect(tenfastLeaseSearchAdapter.analyzeSearchTermForApi('Anna')).toEqual(
        []
      )
    })

    it('should return empty for mixed alphanumeric (use explicit address param instead)', () => {
      expect(
        tenfastLeaseSearchAdapter.analyzeSearchTermForApi('Kungsgatan 12')
      ).toEqual([])
    })

    it('should return empty array for empty string', () => {
      expect(tenfastLeaseSearchAdapter.analyzeSearchTermForApi('')).toEqual([])
    })
  })

  describe('buildTenfastQueryParams', () => {
    it('should always include populate and isArchivedAt filter', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        page: 1,
        limit: 20,
      })

      expect(params.get('populate')).toBe('hyresgaster,hyresobjekt')
      expect(params.get('filter[isArchivedAt]')).toBe('false')
    })

    it('should include date filters as comma-separated range params', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        startDateFrom: '2024-01-01',
        startDateTo: '2024-12-31',
        endDateFrom: '2025-01-01',
        endDateTo: '2025-06-30',
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[startDate]')).toBe('2024-01-01,2024-12-31')
      expect(params.get('filter[endDate]')).toBe('2025-01-01,2025-06-30')
    })

    it('should handle startDateFrom only (open-ended range)', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        startDateFrom: '2024-01-01',
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[startDate]')).toBe('2024-01-01,')
    })

    it('should handle startDateTo only (open-ended range)', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        startDateTo: '2024-12-31',
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[startDate]')).toBe(',2024-12-31')
    })

    it('should include limit and offset when no client-side filtering is needed', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        page: 3,
        limit: 10,
      })

      expect(params.get('limit')).toBe('10')
      expect(params.get('offset')).toBe('20')
    })

    it('should not add any filter when free-text search is a name (use explicit name param)', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        q: 'Anna',
        page: 1,
        limit: 20,
      })

      // 'Anna' is not a recognized pattern — no filter added
      expect(params.get('filter[hyresgast][displayName]')).toBeNull()
      expect(params.get('filter[hyresobjekt][displayName]')).toBeNull()
      expect(params.get('limit')).toBe('20')
      expect(params.get('offset')).toBe('0')
    })

    it('should push explicit name param to hyresgast displayName filter', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        name: 'Anna',
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[hyresgast][displayName]')).toBe('Anna')
      expect(params.get('filter[hyresobjekt][displayName]')).toBeNull()
      expect(params.get('limit')).toBe('20')
    })

    it('should push explicit address param to hyresobjekt postadress filter', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        address: 'Kungsgatan 12',
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[hyresobjekt][postadress]')).toBe(
        'Kungsgatan 12'
      )
      expect(params.get('filter[hyresgast][displayName]')).toBeNull()
      expect(params.get('limit')).toBe('20')
    })

    it('should support both name and address params simultaneously', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        name: 'Anna',
        address: 'Kungsgatan',
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[hyresgast][displayName]')).toBe('Anna')
      expect(params.get('filter[hyresobjekt][postadress]')).toBe('Kungsgatan')
    })

    it('should include limit/offset when free-text search is a contact code', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        q: 'P965339',
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[hyresgast][externalId]')).toBe('P965339')
      expect(params.get('limit')).toBe('20')
      expect(params.get('offset')).toBe('0')
    })

    it('should include limit/offset when free-text search is a personnummer', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        q: '198501011234',
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[hyresgast][idBeteckning]')).toBe('198501011234')
      expect(params.get('limit')).toBe('20')
      expect(params.get('offset')).toBe('0')
    })

    it('should include limit/offset when free-text search is a lease ID', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        q: '206-706-00-0005/04',
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[externalId]')).toBe('206-706-00-0005/04')
      expect(params.get('limit')).toBe('20')
      expect(params.get('offset')).toBe('0')
    })

    it('should push property filter to API', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        property: ['Vetterstorp 1'],
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[fastighet][fastighetsbeteckning]')).toBe('Vetterstorp 1')
      expect(params.get('limit')).toBe('20')
    })

    it('should push comma-separated property filter for multiple values', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        property: ['Vetterstorp 1', 'Vetterstorp 2'],
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[fastighet][fastighetsbeteckning]')).toBe('Vetterstorp 1,Vetterstorp 2')
      expect(params.get('limit')).toBe('20')
    })

    it('should push district filter to API', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        districtNames: ['Vetterstorp'],
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[hyresobjekt][stadsdel]')).toBe('Vetterstorp')
      expect(params.get('limit')).toBe('20')
    })

    it('should include limit/offset when status maps to a known stage', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        status: ['current'],
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[stage]')).toBe('active')
      expect(params.get('limit')).toBe('20')
      expect(params.get('offset')).toBe('0')
    })

    it('should include limit/offset when objectType filter uses comma-separated values', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        objectType: ['bostad', 'parkering'],
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[hyresobjekt][typ]')).toBe('bostad,parkering')
      expect(params.get('limit')).toBe('20')
      expect(params.get('offset')).toBe('0')
    })

    it('should include limit/offset when single objectType is used', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        objectType: ['bostad'],
        page: 2,
        limit: 10,
      })

      expect(params.get('filter[hyresobjekt][typ]')).toBe('bostad')
      expect(params.get('limit')).toBe('10')
      expect(params.get('offset')).toBe('10')
    })

    it('should push stage filter for aboutToEnd status', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        status: ['abouttoend'],
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[stage]')).toBe('terminationScheduled')
      expect(params.get('limit')).toBe('20')
      expect(params.get('offset')).toBe('0')
    })

    it('should push stage filter for current status (maps to active)', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        status: ['current'],
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[stage]')).toBe('active')
      expect(params.get('limit')).toBe('20')
      expect(params.get('offset')).toBe('0')
    })
  })

  describe('fetchLeases', () => {
    it('should return leases on success', async () => {
      const leases = [buildLeaseWithTenants()]

      mockedRequest.mockResolvedValueOnce({
        status: 200,
        data: leases,
      } as any)

      const result = await tenfastLeaseSearchAdapter.fetchLeases({
        page: 1,
        limit: 20,
      })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.leases).toHaveLength(1)
        expect(result.data.totalCount).toBe(1)
      }
    })

    it('should pass date filters as comma-separated range to the API URL', async () => {
      mockedRequest.mockResolvedValueOnce({
        status: 200,
        data: [],
      } as any)

      await tenfastLeaseSearchAdapter.fetchLeases({
        startDateFrom: '2024-01-01',
        startDateTo: '2024-12-31',
        page: 1,
        limit: 20,
      })

      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain(
        'filter[startDate]=2024-01-01,2024-12-31'
      )
    })

    it('should return error on non-200 status', async () => {
      mockedRequest.mockResolvedValueOnce({
        status: 500,
        data: { error: 'Internal Server Error' },
      } as any)

      const result = await tenfastLeaseSearchAdapter.fetchLeases({
        page: 1,
        limit: 20,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('unknown')
      }
    })

    it('should return parse error for invalid data', async () => {
      mockedRequest.mockResolvedValueOnce({
        status: 200,
        data: [{ invalid: 'data' }],
      } as any)

      const result = await tenfastLeaseSearchAdapter.fetchLeases({
        page: 1,
        limit: 20,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.err).toBe('could-not-parse-leases')
      }
    })
  })

  describe('searchLeases', () => {
    const mockCtx = {
      query: { page: '1', limit: '20' },
      request: {
        URL: new URL('http://localhost:5020/api/leases/search-tenfast'),
      },
    } as any

    const setupMockLeases = (leases: TenfastLease[]) => {
      mockedRequest.mockResolvedValueOnce({
        status: 200,
        data: leases,
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

      // Verify the API was called with idBeteckning filter
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain(
        'filter[hyresgast][idBeteckning]=0022'
      )
    })

    it('should return empty results when q is a name (use explicit name param)', async () => {
      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { q: 'Anna', page: 1, limit: 20 },
        mockCtx
      )

      // q='Anna' doesn't match any known pattern, returns empty without calling API
      expect(result.content).toHaveLength(0)
      expect(result._meta.totalRecords).toBe(0)
      expect(mockedRequest).not.toHaveBeenCalled()
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
      expect(calledUrl).toContain('filter[hyresgast][displayName]=Anna')
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
      expect(calledUrl).toContain(
        'filter[hyresgast][externalId]=P965339'
      )

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

      // Verify the API was called with idBeteckning filter (keeps original format with dash)
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain(
        'filter[hyresgast][idBeteckning]=850101-1234'
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-1')
    })

    it('should return empty results when q is an address (use explicit address param)', async () => {
      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { q: 'Kungsgatan 12', page: 1, limit: 20 },
        mockCtx
      )

      // q='Kungsgatan 12' doesn't match any known pattern, returns empty
      expect(result.content).toHaveLength(0)
      expect(mockedRequest).not.toHaveBeenCalled()
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
      expect(calledUrl).toContain(
        'filter[startDate]=2024-01-01,2024-12-31'
      )

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
      const leases = Array.from({ length: 5 }, (_, i) =>
        buildLeaseWithTenants({
          externalId: `lease-${i}`,
          startDate: new Date(`202${i}-01-01`),
        })
      )
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { page: 2, limit: 2 },
        mockCtx
      )

      expect(result.content).toHaveLength(2)
      expect(result._meta.totalRecords).toBe(5)
      expect(result._meta.page).toBe(2)
      expect(result._meta.limit).toBe(2)
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

      expect(result.content[0].tenantContactIds).toHaveLength(1)
      expect(result.content[0].tenantContactIds![0]).toBe('P965339')
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

      expect(result.content[0].rentalPropertyId).toBeDefined()
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

    it('should push single property filter to API', async () => {
      const leases = [buildLeaseWithTenants({ externalId: 'lease-1' })]
      setupMockLeases(leases)

      await tenfastLeaseSearchAdapter.searchLeases(
        { property: ['Vetterstorp 1'], page: 1, limit: 20 },
        mockCtx
      )

      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain(
        'filter[fastighet][fastighetsbeteckning]=Vetterstorp'
      )
    })

    it('should push single district filter to API', async () => {
      const leases = [buildLeaseWithTenants({ externalId: 'lease-1' })]
      setupMockLeases(leases)

      await tenfastLeaseSearchAdapter.searchLeases(
        { districtNames: ['Vetterstorp'], page: 1, limit: 20 },
        mockCtx
      )

      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain(
        'filter[hyresobjekt][stadsdel]=Vetterstorp'
      )
    })
  })
})
