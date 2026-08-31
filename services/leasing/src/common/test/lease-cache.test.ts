import { leasing, LeaseType, LeaseStatus } from '@onecore/types'

// Flushes the microtask queue — works with fake timers since Promise.resolve()
// uses microtasks, not macrotasks.
const flushPromises = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

const makeLease = (
  id: string,
  overrides: Partial<leasing.v1.LeaseSearchResult> = {}
): leasing.v1.LeaseSearchResult => ({
  leaseId: id,
  objectTypeCode: 'LGH',
  leaseType: LeaseType.HousingContract,
  contacts: [],
  address: 'Testgatan 1',
  postalCode: '75320',
  city: 'Uppsala',
  startDate: null,
  lastDebitDate: null,
  status: LeaseStatus.Current,
  rentalObjectCode: 'OBJ-001',
  ...overrides,
})

describe('lease-cache', () => {
  // jest.resetModules() gives each test a fresh module with clean state.
  // Use require() rather than dynamic import() — ts-jest runs in CommonJS mode.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cache: typeof import('../lease-cache')

  beforeEach(() => {
    jest.resetModules()
    jest.useFakeTimers()
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cache = require('../lease-cache')
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('initial state', () => {
    it('is not ready before startLeaseCache is called', () => {
      expect(cache.isReady()).toBe(false)
      expect(cache.getAll()).toEqual([])
      expect(cache.getCacheInfo()).toMatchObject({
        status: 'uninitialized',
        count: 0,
        lastSyncedAt: null,
      })
    })
  })

  describe('full sync — no existing data', () => {
    it('calls fullFetchFn, populates cache and sets status to ready', async () => {
      const lease = makeLease('lease-1')
      const fullFetchFn = jest.fn().mockResolvedValue([lease])
      const deltaFetchFn = jest.fn()

      cache.startLeaseCache(fullFetchFn, deltaFetchFn)
      await flushPromises()

      expect(fullFetchFn).toHaveBeenCalledTimes(1)
      expect(deltaFetchFn).not.toHaveBeenCalled()
      expect(cache.isReady()).toBe(true)
      expect(cache.getAll()).toEqual([lease])
      expect(cache.getCacheInfo().count).toBe(1)
      expect(cache.getCacheInfo().lastSyncedAt).toBeInstanceOf(Date)
    })

    it('sets status to error if fullFetchFn throws and cache is empty', async () => {
      const fullFetchFn = jest.fn().mockRejectedValue(new Error('network failure'))
      const deltaFetchFn = jest.fn()

      cache.startLeaseCache(fullFetchFn, deltaFetchFn)
      await flushPromises()

      expect(cache.isReady()).toBe(false)
      expect(cache.getCacheInfo().status).toBe('error')
      expect(cache.getAll()).toEqual([])
    })
  })

  describe('delta sync — data already in cache', () => {
    const INTERVAL_MS = 1_000

    it('calls deltaFetchFn on subsequent syncs with lastSyncedAt minus 30s buffer', async () => {
      const fullFetchFn = jest.fn().mockResolvedValue([makeLease('lease-1')])
      const deltaFetchFn = jest.fn().mockResolvedValue([])

      cache.startLeaseCache(fullFetchFn, deltaFetchFn, INTERVAL_MS)
      await flushPromises() // full sync

      const { lastSyncedAt } = cache.getCacheInfo()

      jest.advanceTimersByTime(INTERVAL_MS)
      await flushPromises() // delta sync

      expect(deltaFetchFn).toHaveBeenCalledTimes(1)
      const sinceArg = deltaFetchFn.mock.calls[0][0] as Date
      expect(sinceArg.getTime()).toBe(lastSyncedAt!.getTime() - 30_000)
    })

    it('replaces changed leases in cache by leaseId', async () => {
      const original = makeLease('lease-1', { address: 'Original street 1' })
      const updated = makeLease('lease-1', { address: 'Updated street 1' })
      const other = makeLease('lease-2')

      const fullFetchFn = jest.fn().mockResolvedValue([original, other])
      const deltaFetchFn = jest.fn().mockResolvedValue([updated])

      cache.startLeaseCache(fullFetchFn, deltaFetchFn, INTERVAL_MS)
      await flushPromises()

      jest.advanceTimersByTime(INTERVAL_MS)
      await flushPromises()

      const all = cache.getAll()
      expect(all).toHaveLength(2)
      expect(all.find((l) => l.leaseId === 'lease-1')?.address).toBe(
        'Updated street 1'
      )
      expect(all.find((l) => l.leaseId === 'lease-2')).toBeDefined()
    })

    it('appends new leases from delta to existing cache', async () => {
      const fullFetchFn = jest.fn().mockResolvedValue([makeLease('lease-1')])
      const deltaFetchFn = jest.fn().mockResolvedValue([makeLease('lease-2')])

      cache.startLeaseCache(fullFetchFn, deltaFetchFn, INTERVAL_MS)
      await flushPromises()
      expect(cache.getAll()).toHaveLength(1)

      jest.advanceTimersByTime(INTERVAL_MS)
      await flushPromises()

      expect(cache.getAll()).toHaveLength(2)
    })

    it('keeps existing data and stays ready if deltaFetchFn throws', async () => {
      const lease1 = makeLease('lease-1')
      const fullFetchFn = jest.fn().mockResolvedValue([lease1])
      const deltaFetchFn = jest.fn().mockRejectedValue(new Error('timeout'))

      cache.startLeaseCache(fullFetchFn, deltaFetchFn, INTERVAL_MS)
      await flushPromises()

      jest.advanceTimersByTime(INTERVAL_MS)
      await flushPromises()

      expect(cache.isReady()).toBe(true)
      expect(cache.getAll()).toEqual([lease1])
    })
  })

  describe('concurrent sync guard', () => {
    it('skips interval sync while a previous sync is still in progress', async () => {
      let resolveFullFetch!: (v: leasing.v1.LeaseSearchResult[]) => void
      const pendingFetch = new Promise<leasing.v1.LeaseSearchResult[]>(
        (resolve) => {
          resolveFullFetch = resolve
        }
      )

      const fullFetchFn = jest.fn().mockReturnValue(pendingFetch)
      const deltaFetchFn = jest.fn()

      cache.startLeaseCache(fullFetchFn, deltaFetchFn, 1_000)
      // fullFetchFn has been called but not resolved — status is 'syncing'

      jest.advanceTimersByTime(1_000)
      // interval fires while sync is still running — should be skipped

      resolveFullFetch([])
      await flushPromises()

      expect(fullFetchFn).toHaveBeenCalledTimes(1) // only the initial call, not the interval
    })
  })
})
