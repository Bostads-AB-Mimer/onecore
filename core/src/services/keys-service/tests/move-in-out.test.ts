import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { keys } from '@onecore/types'

import { clearObjectCache, routes } from '../move-in-out'
import {
  LeaseSummary,
  deriveStatus,
  pickOutgoingIncoming,
} from '../move-in-out-derive'
import * as keysAdapter from '../../../adapters/keys-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as factory from '../../../../test/factories'

jest.mock('@onecore/utilities', () => ({
  ...jest.requireActual('@onecore/utilities'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(() => {
  jest.resetAllMocks()
  clearObjectCache()
  jest
    .spyOn(keysAdapter.KeyNotesApi, 'getBatchByRentalObject')
    .mockResolvedValue({ ok: true, data: {} })
})

const d = (s: string) => new Date(s)

const tenant = (
  leaseId: string,
  contactCodes: string[],
  start: string,
  end: string | null
): LeaseSummary => ({
  leaseId,
  names: contactCodes.map((c) => `Name ${c}`),
  contactCodes,
  leaseStartDate: d(start),
  lastDebitDate: end ? d(end) : null,
})

const key = (id: string, disposed = false): keys.Key =>
  factory.key.build({ id, disposed, rentalObjectCode: 'OBJ-1' })

const card = (cardId: string): keys.Card => ({
  cardId,
  createTime: '2024-01-01T00:00:00Z',
})

const loan = (
  overrides: Partial<keys.KeyLoanWithDetails>
): keys.KeyLoanWithDetails => ({
  ...factory.keyLoanWithDetails.build(),
  keysArray: [],
  keyCardsArray: [],
  receipts: [],
  pickedUpAt: null,
  returnedAt: null,
  ...overrides,
})

const OUT = tenant('L1', ['P1'], '2024-01-01', '2026-10-15')
const IN = tenant('L2', ['P2'], '2026-10-16', null)
const K1 = key('k1')
const K2 = key('k2')

describe('pickOutgoingIncoming', () => {
  const L0 = tenant('L0', ['P0'], '2020-01-01', '2023-12-31')
  const all = [IN, OUT, L0]

  it('uses the end match as outgoing and the next lease as incoming', () => {
    const r = pickOutgoingIncoming(all, new Set(['L1']), new Set())
    expect(r.outgoing?.leaseId).toBe('L1')
    expect(r.incoming?.leaseId).toBe('L2')
  })

  it('uses the start match as incoming and the previous lease as outgoing', () => {
    const r = pickOutgoingIncoming(all, new Set(), new Set(['L2']))
    expect(r.outgoing?.leaseId).toBe('L1')
    expect(r.incoming?.leaseId).toBe('L2')
  })

  it('ignores a lease cancelled before move-in when picking the neighbour', () => {
    const cancelled = tenant('L8', ['P8'], '2026-11-01', '2026-10-20')
    const r = pickOutgoingIncoming([OUT, cancelled], new Set(['L1']), new Set())
    expect(r.incoming).toBeNull()
  })

  it('returns no incoming when the object becomes vacant', () => {
    const r = pickOutgoingIncoming([L0, OUT], new Set(['L1']), new Set())
    expect(r.outgoing?.leaseId).toBe('L1')
    expect(r.incoming).toBeNull()
  })
})

describe('deriveStatus', () => {
  const base = { outgoing: OUT, incoming: IN, keys: [K1, K2], cards: [] }

  it('UNKNOWN when DAX could not be asked about the cards', () => {
    const r = deriveStatus({ ...base, loans: [], cardsUnresolved: true })
    expect(r.status).toBe('UNKNOWN')
    // Even with no keys: there may be tags we could not see
    expect(
      deriveStatus({ ...base, keys: [], loans: [], cardsUnresolved: true })
        .status
    ).toBe('UNKNOWN')
  })

  it('loan-derived red statuses win over UNKNOWN', () => {
    const notReturned = deriveStatus({
      ...base,
      cardsUnresolved: true,
      loans: [
        loan({ contact: 'P1', pickedUpAt: d('2024-01-02'), keysArray: [K1] }),
      ],
    })
    expect(notReturned.status).toBe('NOT_RETURNED')

    const other = deriveStatus({
      ...base,
      cardsUnresolved: true,
      loans: [
        loan({ contact: 'P1', returnedAt: d('2026-10-15'), keysArray: [K1] }),
        loan({
          loanType: 'MAINTENANCE',
          contact: 'Firma AB',
          pickedUpAt: d('2026-10-16'),
          keysArray: [K1],
        }),
      ],
    })
    expect(other.status).toBe('LOANED_TO_OTHER')

    // With the outgoing loan returned, the card-dependent states are unknown
    const returned = deriveStatus({
      ...base,
      cardsUnresolved: true,
      loans: [
        loan({ contact: 'P1', returnedAt: d('2026-10-15'), keysArray: [K1] }),
      ],
    })
    expect(returned.status).toBe('UNKNOWN')
  })

  it('NO_KEYS when the object has no keys or cards', () => {
    const r = deriveStatus({ ...base, keys: [], cards: [], loans: [] })
    expect(r.status).toBe('NO_KEYS')
    expect(r.keyCount).toBe(0)
  })

  it('NOT_RETURNED when the outgoing tenant still has an open loan', () => {
    const r = deriveStatus({
      ...base,
      loans: [
        loan({
          contact: 'P1',
          pickedUpAt: d('2024-01-02'),
          keysArray: [K1, K2],
        }),
      ],
    })
    expect(r.status).toBe('NOT_RETURNED')
    expect(r.outgoingAllReturned).toBe(false)
  })

  it('LOANED_TO_OTHER when an unrelated or maintenance loan is open', () => {
    const r = deriveStatus({
      ...base,
      loans: [
        loan({
          contact: 'P1',
          returnedAt: d('2026-10-15'),
          keysArray: [K1, K2],
        }),
        loan({
          loanType: 'MAINTENANCE',
          contact: 'Firma AB',
          pickedUpAt: d('2026-10-16'),
          keysArray: [K1],
        }),
      ],
    })
    expect(r.status).toBe('LOANED_TO_OTHER')
    expect(r.outgoingAllReturned).toBe(true)
    expect(r.outgoingReturnedAt).toEqual(d('2026-10-15'))
  })

  it('CREATED when the incoming loan covers everything but is not picked up', () => {
    const r = deriveStatus({
      ...base,
      loans: [
        loan({
          contact: 'P1',
          returnedAt: d('2026-10-15'),
          keysArray: [K1, K2],
        }),
        loan({
          contact: 'P2',
          createdAt: d('2026-10-16'),
          keysArray: [K1, K2],
        }),
      ],
    })
    expect(r.status).toBe('CREATED')
    expect(r.incomingLoanCreatedAt).toEqual(d('2026-10-16'))
    expect(r.incomingLoanPickedUpAt).toBeNull()
  })

  it('HANDED_OUT when the incoming loan is picked up, matching contact2 too', () => {
    const r = deriveStatus({
      ...base,
      incoming: tenant('L2', ['P2', 'P3'], '2026-10-16', null),
      loans: [
        loan({
          contact: 'P9',
          contact2: 'P3',
          pickedUpAt: d('2026-10-17'),
          keysArray: [K1, K2],
        }),
      ],
    })
    expect(r.status).toBe('HANDED_OUT')
    expect(r.incomingLoanPickedUpAt).toEqual(d('2026-10-17'))
  })

  it('with two incoming loans the least positive one decides', () => {
    const r = deriveStatus({
      ...base,
      loans: [
        loan({
          contact: 'P2',
          createdAt: d('2026-10-16'),
          pickedUpAt: d('2026-10-17'),
          keysArray: [K1],
        }),
        loan({ contact: 'P2', createdAt: d('2026-10-20'), keysArray: [K2] }),
      ],
    })
    expect(r.status).toBe('CREATED')
    expect(r.incomingLoanCreatedAt).toEqual(d('2026-10-16'))
    expect(r.incomingLoanPickedUpAt).toBeNull()
  })

  it('PARTIAL when the incoming loan does not cover all keys and cards', () => {
    const r = deriveStatus({
      ...base,
      cards: [card('c1')],
      loans: [
        loan({
          contact: 'P2',
          pickedUpAt: d('2026-10-17'),
          keysArray: [K1, K2],
        }),
      ],
    })
    expect(r.status).toBe('PARTIAL')
    expect(r.cardCount).toBe(1)
  })

  it('RETURNED_VACANT when all returned and nobody is moving in', () => {
    const r = deriveStatus({
      ...base,
      incoming: null,
      loans: [
        loan({
          contact: 'P1',
          returnedAt: d('2026-10-15'),
          keysArray: [K1, K2],
        }),
      ],
    })
    expect(r.status).toBe('RETURNED_VACANT')
  })

  it('NO_LOANS when nobody has borrowed anything', () => {
    expect(deriveStatus({ ...base, loans: [] }).status).toBe('NO_LOANS')
    expect(deriveStatus({ ...base, incoming: null, loans: [] }).status).toBe(
      'NO_LOANS'
    )
  })

  it('ignores archived cards for counts and coverage', () => {
    const r = deriveStatus({
      ...base,
      keys: [K1],
      cards: [card('c1'), { ...card('c2'), state: 'Archived' }],
      loans: [
        loan({
          contact: 'P2',
          pickedUpAt: d('2026-10-17'),
          keysArray: [K1],
          keyCardsArray: [card('c1')],
        }),
      ],
    })
    expect(r.cardCount).toBe(1)
    expect(r.status).toBe('HANDED_OUT')
  })

  it('ignores disposed keys for counts and coverage', () => {
    const r = deriveStatus({
      ...base,
      keys: [K1, key('k3', true)],
      loans: [
        loan({ contact: 'P2', pickedUpAt: d('2026-10-17'), keysArray: [K1] }),
      ],
    })
    expect(r.keyCount).toBe(1)
    expect(r.status).toBe('HANDED_OUT')
  })
})

describe('GET /keys/move-in-out', () => {
  const searchResult = (
    leaseId: string,
    rentalObjectCode: string,
    contactCode: string,
    startDate: string,
    lastDebitDate: string | null
  ) => ({
    leaseId,
    objectTypeCode: 'BOSTAD',
    leaseType: 'Bostadskontrakt',
    contacts: [
      { name: `Name ${contactCode}`, contactCode, email: null, phone: null },
    ],
    address: 'Gatan 1',
    startDate: d(startDate),
    lastDebitDate: lastDebitDate ? d(lastDebitDate) : null,
    status: 2,
    rentalObjectCode,
  })

  const paginated = <T>(content: T[]) => ({
    content,
    _meta: {
      totalRecords: content.length,
      page: 1,
      limit: 100,
      count: content.length,
    },
    _links: [],
  })

  it('rejects a request without a complete date pair', async () => {
    const res = await request(app.callback()).get(
      '/keys/move-in-out?endDateFrom=2026-10-01'
    )
    expect(res.status).toBe(400)
  })

  it('builds one row per rental object', async () => {
    jest
      .spyOn(leasingAdapter, 'searchLeases')
      .mockImplementation(async (q) =>
        q.endDateFrom
          ? paginated([
              searchResult('L1', 'OBJ-1', 'P1', '2024-01-01', '2026-10-15'),
            ])
          : paginated([searchResult('L2', 'OBJ-1', 'P2', '2026-10-16', null)])
      )
    jest
      .spyOn(keysAdapter.KeysApi, 'getBatchByRentalObject')
      .mockResolvedValue({
        ok: true,
        data: { 'OBJ-1': [K1] },
      })
    jest
      .spyOn(keysAdapter.KeyNotesApi, 'getBatchByRentalObject')
      .mockResolvedValue({
        ok: true,
        data: {
          'OBJ-1': [
            {
              id: 'n1',
              rentalObjectCode: 'OBJ-1',
              description: 'Porten kärvar',
            },
          ],
        },
      })
    const loansSpy = jest
      .spyOn(keysAdapter.KeyLoansApi, 'getBatchByRentalObject')
      .mockResolvedValue({
        ok: true,
        data: {
          loans: {
            'OBJ-1': [
              loan({
                contact: 'P1',
                returnedAt: d('2026-10-15'),
                keysArray: [K1],
              }),
              loan({
                contact: 'P2',
                createdAt: d('2026-10-16'),
                keysArray: [K1],
              }),
            ],
          },
          cards: { 'OBJ-1': [] },
          cardsUnresolved: [],
        },
      })

    const res = await request(app.callback()).get(
      '/keys/move-in-out?endDateFrom=2026-10-01&endDateTo=2026-11-01&startDateFrom=2026-10-01&startDateTo=2026-11-01'
    )

    expect(res.status).toBe(200)
    expect(loansSpy).toHaveBeenCalledWith(['OBJ-1'])
    expect(res.body.content).toHaveLength(1)
    expect(res.body.content[0]).toMatchObject({
      rentalObjectCode: 'OBJ-1',
      objectTypeCode: 'BOSTAD',
      outgoing: { leaseId: 'L1', contactCodes: ['P1'] },
      incoming: { leaseId: 'L2', contactCodes: ['P2'] },
      keyCount: 1,
      cardCount: 0,
      outgoingAllReturned: true,
      status: 'CREATED',
      notes: ['Porten kärvar'],
    })
  })

  it('finds neighbours in the wide searches and treats far-away leases as vacant', async () => {
    const searchSpy = jest
      .spyOn(leasingAdapter, 'searchLeases')
      .mockImplementation(async (q) =>
        q.endDateFrom
          ? paginated([
              // row: ends in range; next tenant starts 2 months later (neighbour)
              searchResult('L1', 'SOON', 'P1', '2024-01-01', '2026-10-15'),
              // neighbour only: ended 3 months before a start-match
              searchResult('L3', 'PREV', 'P3', '2024-01-01', '2026-07-31'),
              // row: ends in range; next tenant starts 8 months later -> vacant
              searchResult('L5', 'FAR', 'P5', '2024-01-01', '2026-10-20'),
              // neighbour candidate outside the row range only
              searchResult('L7', 'NOROW', 'P7', '2024-01-01', '2026-06-01'),
            ])
          : paginated([
              searchResult('L2', 'SOON', 'P2', '2026-12-10', null),
              searchResult('L4', 'PREV', 'P4', '2026-10-05', null),
            ])
      )
    jest
      .spyOn(keysAdapter.KeysApi, 'getBatchByRentalObject')
      .mockResolvedValue({ ok: true, data: {} })
    jest
      .spyOn(keysAdapter.KeyLoansApi, 'getBatchByRentalObject')
      .mockResolvedValue({
        ok: true,
        data: { loans: {}, cards: {}, cardsUnresolved: [] },
      })

    const res = await request(app.callback()).get(
      '/keys/move-in-out?endDateFrom=2026-10-01&endDateTo=2026-11-01&startDateFrom=2026-10-01&startDateTo=2026-11-01'
    )

    expect(res.status).toBe(200)
    expect(searchSpy).toHaveBeenCalledTimes(2)
    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        endDateFrom: '2026-07-01',
        endDateTo: '2026-11-01',
        sortBy: 'leaseId',
      })
    )
    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        startDateFrom: '2026-10-01',
        startDateTo: '2027-02-01',
      })
    )
    const rows = Object.fromEntries(
      res.body.content.map((r: { rentalObjectCode: string }) => [
        r.rentalObjectCode,
        r,
      ])
    )
    expect(Object.keys(rows).sort()).toEqual(['FAR', 'PREV', 'SOON'])
    expect(rows.SOON).toMatchObject({
      outgoing: { leaseId: 'L1' },
      incoming: { leaseId: 'L2' },
    })
    expect(rows.PREV).toMatchObject({
      outgoing: { leaseId: 'L3' },
      incoming: { leaseId: 'L4' },
    })
    expect(rows.FAR).toMatchObject({
      outgoing: { leaseId: 'L5' },
      incoming: null,
    })
  })

  it('searches, sorts and paginates before fetching keys, reusing the lease search', async () => {
    const searchSpy = jest
      .spyOn(leasingAdapter, 'searchLeases')
      .mockImplementation(async (q) =>
        q.endDateFrom
          ? paginated([
              searchResult('L1', 'OBJ-A', 'P1', '2024-01-01', '2026-10-20'),
              searchResult('L2', 'OBJ-B', 'P2', '2024-01-01', '2026-10-05'),
              searchResult('L3', 'OBJ-C', 'P3', '2024-01-01', '2026-10-10'),
            ])
          : paginated([])
      )
    jest
      .spyOn(keysAdapter.KeysApi, 'getBatchByRentalObject')
      .mockResolvedValue({ ok: true, data: {} })
    const loansSpy = jest
      .spyOn(keysAdapter.KeyLoansApi, 'getBatchByRentalObject')
      .mockResolvedValue({
        ok: true,
        data: { loans: {}, cards: {}, cardsUnresolved: [] },
      })

    const base = '/keys/move-in-out?endDateFrom=2026-10-01&endDateTo=2026-11-01'
    const page1 = await request(app.callback()).get(`${base}&limit=2`)
    expect(page1.status).toBe(200)
    expect(page1.body._meta).toMatchObject({
      totalRecords: 3,
      page: 1,
      limit: 2,
    })
    // Default sort: lastDebitDate ascending
    expect(
      page1.body.content.map(
        (r: { rentalObjectCode: string }) => r.rentalObjectCode
      )
    ).toEqual(['OBJ-B', 'OBJ-C'])
    expect(loansSpy).toHaveBeenLastCalledWith(['OBJ-B', 'OBJ-C'])

    const page2 = await request(app.callback()).get(`${base}&limit=2&page=2`)
    expect(
      page2.body.content.map(
        (r: { rentalObjectCode: string }) => r.rentalObjectCode
      )
    ).toEqual(['OBJ-A'])

    const searched = await request(app.callback()).get(`${base}&q=p3`)
    expect(searched.body._meta.totalRecords).toBe(1)
    expect(searched.body.content[0].rentalObjectCode).toBe('OBJ-C')

    // Three requests, one lease search pair: the object list is cached
    expect(searchSpy).toHaveBeenCalledTimes(2)
  })

  it('shares one lease search between concurrent requests for the same filter', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const searchSpy = jest
      .spyOn(leasingAdapter, 'searchLeases')
      .mockImplementation(async (q) => {
        await gate
        return q.endDateFrom
          ? paginated([
              searchResult('L1', 'OBJ-1', 'P1', '2024-01-01', '2026-10-15'),
            ])
          : paginated([])
      })
    jest
      .spyOn(keysAdapter.KeysApi, 'getBatchByRentalObject')
      .mockResolvedValue({ ok: true, data: {} })
    jest
      .spyOn(keysAdapter.KeyLoansApi, 'getBatchByRentalObject')
      .mockResolvedValue({
        ok: true,
        data: { loans: {}, cards: {}, cardsUnresolved: [] },
      })

    const base = '/keys/move-in-out?endDateFrom=2026-10-01&endDateTo=2026-11-01'
    // Second request (page 2) arrives while the first is still searching
    const first = request(app.callback()).get(base)
    const second = request(app.callback()).get(`${base}&page=2`)
    await new Promise((r) => setTimeout(r, 20))
    release()
    const [a, b] = await Promise.all([first, second])

    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(a.body._meta.totalRecords).toBe(1)
    expect(b.body._meta.totalRecords).toBe(1)
    // One ending + one starting search, not two of each
    expect(searchSpy).toHaveBeenCalledTimes(2)
  })

  it('responds with 500 when the keys batch fails', async () => {
    jest
      .spyOn(leasingAdapter, 'searchLeases')
      .mockResolvedValue(
        paginated([
          searchResult('L1', 'OBJ-1', 'P1', '2024-01-01', '2026-10-15'),
        ])
      )
    jest
      .spyOn(keysAdapter.KeysApi, 'getBatchByRentalObject')
      .mockResolvedValue({ ok: false, err: 'unknown' })
    jest
      .spyOn(keysAdapter.KeyLoansApi, 'getBatchByRentalObject')
      .mockResolvedValue({
        ok: true,
        data: { loans: {}, cards: {}, cardsUnresolved: [] },
      })

    const res = await request(app.callback()).get(
      '/keys/move-in-out?endDateFrom=2026-10-01&endDateTo=2026-11-01'
    )
    expect(res.status).toBe(500)
  })
})
