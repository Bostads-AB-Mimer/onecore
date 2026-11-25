import { LeaseStatus } from '@onecore/types'
import { z } from 'zod'

import * as endedLeaseAdapter from '../../../adapters/xpand/ended-lease-adapter'

const mockCalls: Array<{ method: string; args: unknown[] }> = []
let mockRows: unknown[] = []
let mockError: Error | undefined

jest.mock('knex', () => () => {
  const builder: any = new Proxy(
    {},
    {
      get: (_t, method: string) => {
        if (method === 'then') {
          return (
            resolve: (rows: unknown[]) => unknown,
            reject: (err: Error) => unknown
          ) => (mockError ? reject(mockError) : resolve(mockRows))
        }
        return (...args: unknown[]) => {
          mockCalls.push({ method, args })
          // Nested where(function (qb) {...}) callbacks run against the same recorder
          args.forEach((a) => {
            if (typeof a === 'function') a.call(builder, builder)
          })
          return builder
        }
      },
    }
  )
  return builder
})

const endedRow = {
  leaseId: '123-456-789/01   ',
  leaseType: 'Bostadskontrakt   ',
  fromDate: new Date('2015-01-01'),
  toDate: undefined,
  lastDebitDate: new Date('2020-06-30'),
  noticeGivenBy: undefined,
  noticeDate: undefined,
  noticeTimeTenant: undefined,
  preferredMoveOutDate: undefined,
  terminationDate: undefined,
  contractDate: undefined,
  approvalDate: undefined,
  contactCode: 'P123456  ',
  rentalObjectCode: '123-456-789  ',
}

const callsTo = (method: string) =>
  mockCalls.filter((c) => c.method === method).map((c) => c.args)

const queryText = () => JSON.stringify(mockCalls.map((c) => c.args))

const unwrap = (r: any): any => (r && 'ok' in r ? r.data : r)

beforeEach(() => {
  mockCalls.length = 0
  mockRows = [endedRow]
  mockError = undefined
})

describe.each([
  ['getEndedLeasesByContactCode', 'P123456'],
  ['getEndedLeasesByRentalObjectCode', '123-456-789'],
])('%s', (fn, code) => {
  const run = () => (endedLeaseAdapter as any)[fn](code)

  it('returns leases with status Ended and trimmed ids', async () => {
    const leases = unwrap(await run())

    expect(leases).toHaveLength(1)
    expect(leases[0].leaseId).toBe('123-456-789/01')
    expect(leases[0].status).toBe(LeaseStatus.Ended)
  })

  it('excludes lease templates (keyhyobt 1)', async () => {
    await run()

    expect(queryText()).toContain('keyhyobt')
    expect(queryText()).toContain('"1"')
  })

  it('excludes voided leases (makuldatum set, M in the lease id)', async () => {
    await run()

    expect(callsTo('whereNull')).toContainEqual(['hyobj.makuldatum'])
    expect(callsTo('whereNot')).toContainEqual([
      'hyobj.hyobjben',
      'like',
      '%M%',
    ])
  })

  it('only reads leases whose last debit date has passed', async () => {
    await run()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    expect(callsTo('whereNotNull')).toContainEqual(['hyobj.sistadeb'])
    expect(callsTo('where')).toContainEqual(['hyobj.sistadeb', '<', today])
    expect(callsTo('where')).toContainEqual(['hyobj.deletemark', 0])
  })

  it('filters on the given code', async () => {
    await run()

    expect(queryText()).toContain(code)
  })
})

describe('getEndedLeaseById', () => {
  it('returns the lease with status Ended', async () => {
    const lease = unwrap(
      await endedLeaseAdapter.getEndedLeaseById('123-456-789/01')
    )

    expect(lease.leaseId).toBe('123-456-789/01')
    expect(lease.status).toBe(LeaseStatus.Ended)
    expect(queryText()).toContain('123-456-789/01')
    expect(queryText()).toContain('%M%')
  })

  it('reports an unknown error when the query fails', async () => {
    mockError = new Error('connection lost')

    const result: any = await endedLeaseAdapter.getEndedLeaseById('123/01')

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('reports a miss when no row matches', async () => {
    mockRows = []

    const result: any = await endedLeaseAdapter.getEndedLeaseById('nope/01')

    expect(result).toEqual({ ok: false, err: 'not-found' })
  })
})

describe('getEndedLeasesByContactCode holders', () => {
  it('selects leases the contact holds without cutting co-holders', async () => {
    mockRows = [endedRow, { ...endedRow, contactCode: 'P999999  ' }]

    const result: any =
      await endedLeaseAdapter.getEndedLeasesByContactCode('P123456')

    expect(callsTo('whereIn')[0][0]).toBe('hyobj.keyhyobj')
    expect(callsTo('where')).toContainEqual(['holder.cmctckod', 'P123456'])
    expect(callsTo('where')).not.toContainEqual(['cmctc.cmctckod', 'P123456'])
    expect(result.data[0].tenantContactIds).toEqual(['P123456', 'P999999'])
  })
})

describe('SQL NULL columns', () => {
  // Same optional/date rules as the Lease schema core applies to this response
  const optionalDate = z.coerce.date().optional()
  const responseShape = z.object({
    leaseId: z.string(),
    noticeGivenBy: z.string().optional(),
    noticeTimeTenant: z.union([z.string(), z.number()]).optional(),
    leaseEndDate: optionalDate,
    noticeDate: optionalDate,
    preferredMoveOutDate: optionalDate,
    terminationDate: optionalDate,
    contractDate: optionalDate,
    lastDebitDate: optionalDate,
    approvalDate: optionalDate,
  })

  it('maps to undefined, so the lease parses and has no 1970 dates', async () => {
    mockRows = [
      {
        ...endedRow,
        noticeGivenBy: null,
        noticeDate: null,
        noticeTimeTenant: null,
        preferredMoveOutDate: null,
        terminationDate: null,
        contractDate: null,
        approvalDate: null,
        toDate: null,
      },
    ]

    const result: any = await endedLeaseAdapter.getEndedLeaseById('x/01')
    const lease = JSON.parse(JSON.stringify(result.data))
    const parsed = responseShape.safeParse(lease)

    expect(Object.values(result.data)).not.toContain(null)
    expect(parsed.success).toBe(true)
    expect(parsed.data?.terminationDate).toBeUndefined()
    expect(parsed.data?.noticeDate).toBeUndefined()
    expect(parsed.data?.leaseEndDate).toBeUndefined()
  })
})
