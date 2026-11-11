import { leasing, LeaseType, LeaseStatus } from '@onecore/types'

type CacheModule = typeof import('../xpand-ended-lease-cache')

const makeLease = (id: string): leasing.v1.LeaseSearchResult => ({
  leaseId: id,
  objectTypeCode: 'Bostad',
  leaseType: LeaseType.HousingContract,
  contacts: [],
  address: null,
  postalCode: null,
  city: null,
  startDate: null,
  endDate: null,
  lastDebitDate: null,
  signedAt: null,
  status: LeaseStatus.Ended,
  rentalObjectCode: null,
})

const DAY_MS = 24 * 60 * 60 * 1000

describe('xpand-ended-lease-cache', () => {
  let cache: CacheModule

  beforeEach(() => {
    jest.useFakeTimers()
    jest.resetModules()
    cache = require('../xpand-ended-lease-cache')
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('is not ready before the first load finishes', () => {
    expect(cache.isReady()).toBe(false)
    expect(cache.getAll()).toEqual([])
  })

  it('serves the loaded leases once ready', async () => {
    const loadFn = jest
      .fn()
      .mockResolvedValue({ ok: true, data: [makeLease('L1')] })

    await cache.startXpandEndedLeaseCache(loadFn)

    expect(cache.isReady()).toBe(true)
    expect(cache.getAll().map((l) => l.leaseId)).toEqual(['L1'])
  })

  it('stays not ready when the first load fails', async () => {
    const loadFn = jest.fn().mockResolvedValue({ ok: false, err: 'down' })

    await cache.startXpandEndedLeaseCache(loadFn)

    expect(cache.isReady()).toBe(false)
  })

  it('retries a failed first load until it succeeds', async () => {
    const loadFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, err: 'down' })
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ ok: true, data: [makeLease('L1')] })

    await cache.startXpandEndedLeaseCache(loadFn)
    await jest.advanceTimersByTimeAsync(cache.FIRST_LOAD_RETRY_MS)
    expect(cache.isReady()).toBe(false)
    await jest.advanceTimersByTimeAsync(cache.FIRST_LOAD_RETRY_MS)

    expect(loadFn).toHaveBeenCalledTimes(3)
    expect(cache.isReady()).toBe(true)
    expect(cache.getAll().map((l) => l.leaseId)).toEqual(['L1'])
  })

  it('does not retry early once a load has succeeded', async () => {
    const loadFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, data: [makeLease('L1')] })
      .mockResolvedValue({ ok: false, err: 'down' })

    await cache.startXpandEndedLeaseCache(loadFn)
    await jest.advanceTimersByTimeAsync(DAY_MS)
    await jest.advanceTimersByTimeAsync(cache.FIRST_LOAD_RETRY_MS * 10)

    expect(loadFn).toHaveBeenCalledTimes(2)
  })

  it('keeps the previous data when a reload fails', async () => {
    const loadFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, data: [makeLease('L1')] })
      .mockRejectedValueOnce(new Error('down'))

    await cache.startXpandEndedLeaseCache(loadFn)
    await jest.advanceTimersByTimeAsync(DAY_MS)

    expect(loadFn).toHaveBeenCalledTimes(2)
    expect(cache.isReady()).toBe(true)
    expect(cache.getAll().map((l) => l.leaseId)).toEqual(['L1'])
  })

  it('replaces the data on a successful reload', async () => {
    const loadFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, data: [makeLease('L1')] })
      .mockResolvedValueOnce({ ok: true, data: [makeLease('L2')] })

    await cache.startXpandEndedLeaseCache(loadFn)
    await jest.advanceTimersByTimeAsync(DAY_MS)

    expect(cache.getAll().map((l) => l.leaseId)).toEqual(['L2'])
  })
})
