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
          filterValue: '8501011234',
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

    it('should map letters-only to displayName filters for hyresgast and hyresobjekt', () => {
      expect(tenfastLeaseSearchAdapter.analyzeSearchTermForApi('Anna')).toEqual(
        [
          {
            filterKey: 'filter[hyresgast][displayName]',
            filterValue: 'Anna',
          },
          {
            filterKey: 'filter[hyresobjekt][displayName]',
            filterValue: 'Anna',
          },
        ]
      )
    })

    it('should map mixed alphanumeric to displayName filters for hyresgast and hyresobjekt', () => {
      expect(
        tenfastLeaseSearchAdapter.analyzeSearchTermForApi('Kungsgatan 12')
      ).toEqual([
        {
          filterKey: 'filter[hyresgast][displayName]',
          filterValue: 'Kungsgatan 12',
        },
        {
          filterKey: 'filter[hyresobjekt][displayName]',
          filterValue: 'Kungsgatan 12',
        },
      ])
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

    it('should include limit/offset and API filters when free-text search is a name', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        q: 'Anna',
        page: 1,
        limit: 20,
      })

      // 'Anna' maps to displayName filters for both hyresgast and hyresobjekt
      expect(params.get('filter[hyresgast][displayName]')).toBe('Anna')
      expect(params.get('filter[hyresobjekt][displayName]')).toBe('Anna')
      expect(params.get('limit')).toBe('20')
      expect(params.get('offset')).toBe('0')
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

      expect(params.get('filter[fastighet][displayName]')).toBe('Vetterstorp 1')
      expect(params.get('limit')).toBe('20')
    })

    it('should not push property filter when multiple values', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        property: ['Vetterstorp 1', 'Vetterstorp 2'],
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[fastighet][displayName]')).toBeNull()
      expect(params.get('limit')).toBeNull()
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

    it('should not include limit/offset when status filter is used', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        status: ['current'],
        page: 1,
        limit: 20,
      })

      expect(params.get('limit')).toBeNull()
      expect(params.get('offset')).toBeNull()
    })

    it('should not include limit/offset when objectType filter is used with multiple values', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        objectType: ['bostad', 'parkering'],
        page: 1,
        limit: 20,
      })

      expect(params.get('limit')).toBeNull()
      expect(params.get('offset')).toBeNull()
    })

    it('should include limit/offset when single objectType is used', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        objectType: ['bostad'],
        page: 2,
        limit: 10,
      })

      expect(params.get('filter[hyresobjekt.typ]')).toBe('bostad')
      expect(params.get('limit')).toBe('10')
      expect(params.get('offset')).toBe('10')
    })

    it('should push stage filter for aboutToEnd status', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        status: ['abouttoend'],
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[stage]')).toBe('requestedCancellation')
      expect(params.get('limit')).toBe('20')
      expect(params.get('offset')).toBe('0')
    })

    it('should not include limit/offset when status requires client-side computation', () => {
      const params = tenfastLeaseSearchAdapter.buildTenfastQueryParams({
        status: ['current'],
        page: 1,
        limit: 20,
      })

      expect(params.get('filter[stage]')).toBeNull()
      expect(params.get('limit')).toBeNull()
      expect(params.get('offset')).toBeNull()
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
        expect(result.data).toHaveLength(1)
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
        'filter%5BstartDate%5D=2024-01-01%2C2024-12-31'
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
        URL: new URL('http://localhost:5020/api/leases/search-v2'),
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
        'filter%5Bhyresgast%5D%5BidBeteckning%5D=0022'
      )
    })

    it('should push name search to API as displayName filters', async () => {
      const leases = [
        buildLeaseWithTenants(
          { externalId: 'lease-1' },
          { name: { first: 'Anna', last: 'Andersson' } }
        ),
      ]
      setupMockLeases(leases)

      await tenfastLeaseSearchAdapter.searchLeases(
        { q: 'Anna', page: 1, limit: 20 },
        mockCtx
      )

      // Verify the API was called with displayName filters for both hyresgast and hyresobjekt
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain('filter%5Bhyresgast%5D%5BdisplayName%5D=Anna')
      expect(calledUrl).toContain(
        'filter%5Bhyresobjekt%5D%5BdisplayName%5D=Anna'
      )
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
        'filter%5Bhyresgast%5D%5BexternalId%5D=P965339'
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

      // Verify the API was called with idBeteckning filter
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain(
        'filter%5Bhyresgast%5D%5BidBeteckning%5D=8501011234'
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('lease-1')
    })

    it('should push address search to API as displayName filters', async () => {
      const leases = [
        buildLeaseWithTenants(
          { externalId: 'lease-1' },
          {},
          { postadress: 'Kungsgatan 12' }
        ),
      ]
      setupMockLeases(leases)

      await tenfastLeaseSearchAdapter.searchLeases(
        { q: 'Kungsgatan', page: 1, limit: 20 },
        mockCtx
      )

      // Verify the API was called with displayName filters for both hyresgast and hyresobjekt
      const calledUrl = mockedRequest.mock.calls[0][0].url as string
      expect(calledUrl).toContain(
        'filter%5Bhyresgast%5D%5BdisplayName%5D=Kungsgatan'
      )
      expect(calledUrl).toContain(
        'filter%5Bhyresobjekt%5D%5BdisplayName%5D=Kungsgatan'
      )
    })

    it('should filter by status (current)', async () => {
      const pastDate = new Date('2020-01-01')

      const leases = [
        buildLeaseWithTenants({
          externalId: 'current-lease',
          startDate: pastDate,
          endDate: null,
          cancellation: {
            cancelled: false,
            doneAutomatically: false,
            receivedCancellationAt: null,
            notifiedAt: null,
            handledAt: null,
            handledBy: null,
            preferredMoveOutDate: null,
          },
        }),
        buildLeaseWithTenants({
          externalId: 'ended-lease',
          startDate: pastDate,
          endDate: new Date('2023-01-01'),
          cancellation: {
            cancelled: false,
            doneAutomatically: false,
            receivedCancellationAt: null,
            notifiedAt: null,
            handledAt: null,
            handledBy: null,
            preferredMoveOutDate: null,
          },
        }),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { status: ['current'], page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('current-lease')
    })

    it('should filter by status using numeric values', async () => {
      const pastDate = new Date('2020-01-01')

      const leases = [
        buildLeaseWithTenants({
          externalId: 'current-lease',
          startDate: pastDate,
          endDate: null,
          cancellation: {
            cancelled: false,
            doneAutomatically: false,
            receivedCancellationAt: null,
            notifiedAt: null,
            handledAt: null,
            handledBy: null,
            preferredMoveOutDate: null,
          },
        }),
        buildLeaseWithTenants({
          externalId: 'ended-lease',
          startDate: pastDate,
          endDate: new Date('2023-01-01'),
          cancellation: {
            cancelled: false,
            doneAutomatically: false,
            receivedCancellationAt: null,
            notifiedAt: null,
            handledAt: null,
            handledBy: null,
            preferredMoveOutDate: null,
          },
        }),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { status: ['0'], page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('current-lease')
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
        'filter%5BstartDate%5D=2024-01-01%2C2024-12-31'
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

      expect(result.content[0].contacts).toHaveLength(1)
      expect(result.content[0].contacts[0]).toMatchObject({
        name: 'Anna Andersson',
        contactCode: 'P965339',
        phone: '0701234567',
      })
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
      expect(calledUrl).toContain('filter%5Bhyresobjekt.typ%5D=bostad')

      expect(result.content).toHaveLength(1)
      expect(result.content[0].leaseId).toBe('bostad-lease')
    })

    it('should filter by multiple object types client-side', async () => {
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
        buildLeaseWithTenants(
          { externalId: 'lokal-lease' },
          {},
          { subType: 'lokal' }
        ),
      ]
      setupMockLeases(leases)

      const result = await tenfastLeaseSearchAdapter.searchLeases(
        { objectType: ['bostad', 'parkering'], page: 1, limit: 20 },
        mockCtx
      )

      expect(result.content).toHaveLength(2)
      expect(result.content.map((c) => c.leaseId)).toEqual(
        expect.arrayContaining(['bostad-lease', 'parkering-lease'])
      )
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
        'filter%5Bfastighet%5D%5BdisplayName%5D=Vetterstorp+1'
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
        'filter%5Bhyresobjekt%5D%5Bstadsdel%5D=Vetterstorp'
      )
    })
  })
})
