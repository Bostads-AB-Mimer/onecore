import { LeaseStatus } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { getLeaseStatuses, LeaseStatusesDeps } from '../services/lease-statuses'
import * as factory from './factories'

const buildDeps = (
  overrides: Partial<LeaseStatusesDeps> = {}
): LeaseStatusesDeps => ({
  cachedLeases: jest.fn().mockResolvedValue([
    { leaseId: '306-008-01-0201/02', status: LeaseStatus.Current },
    { leaseId: '306-008-01-0202/01', status: LeaseStatus.Ended },
  ]),
  getLeaseByLeaseId: jest
    .fn()
    .mockResolvedValue({ ok: false, err: 'not-found' }),
  ...overrides,
})

afterEach(jest.restoreAllMocks)

describe(getLeaseStatuses, () => {
  it('takes the statuses from the cache, without a Tenfast call', async () => {
    const deps = buildDeps()

    const result = await getLeaseStatuses(
      ['306-008-01-0201/02', '306-008-01-0202/01'],
      deps
    )

    expect(result).toEqual({
      ok: true,
      data: {
        statuses: [
          { leaseId: '306-008-01-0201/02', status: LeaseStatus.Current },
          { leaseId: '306-008-01-0202/01', status: LeaseStatus.Ended },
        ],
        notFoundLeaseIds: [],
      },
    })
    expect(deps.getLeaseByLeaseId).not.toHaveBeenCalled()
  })

  it('matches lease IDs ignoring case and padding, and answers with the ID asked for', async () => {
    const result = await getLeaseStatuses([' 306-008-01-0201/02 '], buildDeps())

    expect(result.ok && result.data.statuses).toEqual([
      { leaseId: ' 306-008-01-0201/02 ', status: LeaseStatus.Current },
    ])
  })

  it('reads a lease the cache does not hold from Tenfast', async () => {
    const deps = buildDeps({
      getLeaseByLeaseId: jest.fn().mockResolvedValue({
        ok: true,
        data: factory.tenfastLease.build({ stage: 'archived' }),
      }),
    })

    const result = await getLeaseStatuses(['ARCHIVED/01'], deps)

    expect(deps.getLeaseByLeaseId).toHaveBeenCalledWith('ARCHIVED/01')
    expect(result).toEqual({
      ok: true,
      data: {
        statuses: [{ leaseId: 'ARCHIVED/01', status: expect.any(Number) }],
        notFoundLeaseIds: [],
      },
    })
  })

  it('lists a lease Tenfast does not have as not found', async () => {
    const result = await getLeaseStatuses(['MISSING/01'], buildDeps())

    expect(result).toEqual({
      ok: true,
      data: { statuses: [], notFoundLeaseIds: ['MISSING/01'] },
    })
  })

  it('reads at most 10 leases from Tenfast at a time', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const deps = buildDeps({
      cachedLeases: jest.fn().mockResolvedValue([]),
      getLeaseByLeaseId: jest.fn().mockImplementation(async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await Promise.resolve()
        inFlight--
        return { ok: false, err: 'not-found' }
      }),
    })

    await getLeaseStatuses(
      Array.from({ length: 25 }, (_, index) => `L${index}`),
      deps
    )

    expect(deps.getLeaseByLeaseId).toHaveBeenCalledTimes(25)
    expect(maxInFlight).toBe(10)
  })

  it('fails with upstream-failed when a lease cannot be read, rather than leaving it out', async () => {
    jest.spyOn(logger, 'error').mockImplementation()
    const deps = buildDeps({
      getLeaseByLeaseId: jest
        .fn()
        .mockResolvedValue({ ok: false, err: 'unknown' }),
    })

    const result = await getLeaseStatuses(
      ['306-008-01-0201/02', 'UNREADABLE/01'],
      deps
    )

    expect(result).toEqual({ ok: false, err: 'upstream-failed' })
  })

  it('fails with cache-warming while the cache loads', async () => {
    const deps = buildDeps({
      cachedLeases: jest.fn().mockResolvedValue(undefined),
    })

    const result = await getLeaseStatuses(['306-008-01-0201/02'], deps)

    expect(result).toEqual({ ok: false, err: 'cache-warming' })
  })
})
