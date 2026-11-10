jest.mock('@onecore/utilities', () => {
  const actual = jest.requireActual('@onecore/utilities')
  return {
    ...actual,
    // createExcelFromPaginated lazy-loads exceljs via a dynamic import, which
    // requires --experimental-vm-modules under Jest's CJS transform.
    // Tests only need to assert on the enriched content passed to it.
    createExcelFromPaginated: jest.fn(),
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
      warn: () => {
        return
      },
      debug: () => {
        return
      },
    },
    generateRouteMetadata: jest.fn(),
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import { leasing, LeaseStatus, LeaseType } from '@onecore/types'
import { createExcelFromPaginated, PaginatedResponse } from '@onecore/utilities'

import { routes } from '../keys-export'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import { KeysApi } from '../../../adapters/keys-adapter'
import { contactsAdapter } from '../../../adapters/contacts-adapter'

const buildLeaseSearchResult = (
  overrides: Partial<leasing.v1.LeaseSearchResult> = {}
): leasing.v1.LeaseSearchResult => ({
  leaseId: '705-001-01-0101/1',
  objectTypeCode: 'Bostad',
  leaseType: LeaseType.HousingContract,
  contacts: [
    { contactCode: 'P158770', name: 'Test Testsson', email: null, phone: null },
  ],
  address: 'Testgatan 1',
  postalCode: '72216',
  city: 'Västerås',
  startDate: new Date('2024-01-01'),
  endDate: null,
  lastDebitDate: null,
  signedAt: null,
  status: LeaseStatus.Current,
  rentalObjectCode: '705-001-01-0101',
  ...overrides,
})

const buildPaginatedResponse = (
  content: leasing.v1.LeaseSearchResult[]
): PaginatedResponse<leasing.v1.LeaseSearchResult> => ({
  content,
  _meta: {
    totalRecords: content.length,
    page: 1,
    limit: 100,
    count: content.length,
  },
  _links: [],
})

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(router.routes())

beforeEach(jest.resetAllMocks)

describe('GET /leases/keys-export', () => {
  it('enriches contacts from contacts-service, keeping Tenfast data when nothing is found', async () => {
    jest.spyOn(leasingAdapter, 'searchLeases').mockResolvedValue(
      buildPaginatedResponse([
        buildLeaseSearchResult({
          contacts: [
            {
              contactCode: 'P158770',
              name: 'Test Testsson',
              email: 'fran-tenfast@example.com',
              phone: '0701112233',
            },
          ],
        }),
      ])
    )
    jest
      .spyOn(contactsAdapter, 'getByContactCodeBatch')
      .mockResolvedValue({ ok: true, data: [] })
    jest.spyOn(KeysApi, 'getByRentalObjectCode').mockResolvedValue({
      ok: true,
      data: [],
    })

    let capturedContent: unknown
    ;(createExcelFromPaginated as jest.Mock).mockImplementation(
      async (fetcher) => {
        const result = await fetcher(1, 100)
        capturedContent = result.content
        return Buffer.from('excel')
      }
    )

    const res = await request(app.callback()).get(
      '/leases/keys-export?property=ALLMOGEKULTUREN+1'
    )

    expect(res.status).toBe(200)
    expect(capturedContent).toEqual([
      expect.objectContaining({
        contacts: [
          expect.objectContaining({
            email: 'fran-tenfast@example.com',
            phone: '0701112233',
          }),
        ],
      }),
    ])
  })

  it('returns 503 when the lease cache is warming up', async () => {
    jest.spyOn(leasingAdapter, 'searchLeases').mockRejectedValue(
      Object.assign(new Error('Service Unavailable'), {
        isAxiosError: true,
        response: { status: 503 },
      })
    )
    ;(createExcelFromPaginated as jest.Mock).mockImplementation(
      async (fetcher) => {
        await fetcher(1, 100)
        return Buffer.from('excel')
      }
    )

    const res = await request(app.callback()).get(
      '/leases/keys-export?property=ALLMOGEKULTUREN+1'
    )

    expect(res.status).toBe(503)
    expect(res.body.error).toBe('Lease service is warming up')
  })
})
