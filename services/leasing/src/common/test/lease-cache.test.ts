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
      const fullFetchFn = jest
        .fn()
        .mockRejectedValue(new Error('network failure'))
      const deltaFetchFn = jest.fn()

      cache.startLeaseCache(fullFetchFn, deltaFetchFn)
      await flushPromises()

      expect(cache.isReady()).toBe(false)
      expect(cache.getCacheInfo().status).toBe('error')
      expect(cache.getAll()).toEqual([])
    })
  })

  describe('delta sync — data already in cache', () => {
    it('calls deltaFetchFn on subsequent syncs with lastSyncedAt minus 30s buffer', async () => {
      const fullFetchFn = jest.fn().mockResolvedValue([makeLease('lease-1')])
      const deltaFetchFn = jest.fn().mockResolvedValue([])

      cache.startLeaseCache(fullFetchFn, deltaFetchFn)
      await flushPromises() // full sync

      const { lastSyncedAt } = cache.getCacheInfo()

      await cache.refreshIfStale(0, 10_000)
      await flushPromises()

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

      cache.startLeaseCache(fullFetchFn, deltaFetchFn)
      await flushPromises()

      await cache.refreshIfStale(0, 10_000)
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

      cache.startLeaseCache(fullFetchFn, deltaFetchFn)
      await flushPromises()
      expect(cache.getAll()).toHaveLength(1)

      await cache.refreshIfStale(0, 10_000)
      await flushPromises()

      expect(cache.getAll()).toHaveLength(2)
    })

    it('keeps existing data and stays ready if deltaFetchFn throws', async () => {
      const lease1 = makeLease('lease-1')
      const fullFetchFn = jest.fn().mockResolvedValue([lease1])
      const deltaFetchFn = jest.fn().mockRejectedValue(new Error('timeout'))

      cache.startLeaseCache(fullFetchFn, deltaFetchFn)
      await flushPromises()

      await cache.refreshIfStale(0, 10_000)
      await flushPromises()

      expect(cache.isReady()).toBe(true)
      expect(cache.getAll()).toEqual([lease1])
    })
  })

  describe('concurrent sync guard', () => {
    it('shares ongoing sync promise — concurrent refreshIfStale calls only trigger one delta sync', async () => {
      const lease1 = makeLease('lease-1')
      let resolveDeltaFetch!: (v: leasing.v1.LeaseSearchResult[]) => void
      const pendingDelta = new Promise<leasing.v1.LeaseSearchResult[]>(
        (resolve) => {
          resolveDeltaFetch = resolve
        }
      )

      const fullFetchFn = jest.fn().mockResolvedValue([lease1])
      const deltaFetchFn = jest.fn().mockReturnValue(pendingDelta)

      cache.startLeaseCache(fullFetchFn, deltaFetchFn)
      await flushPromises() // full sync complete

      const p1 = cache.refreshIfStale(0, 10_000)
      const p2 = cache.refreshIfStale(0, 10_000)

      resolveDeltaFetch([])
      await Promise.all([p1, p2])
      await flushPromises()

      expect(deltaFetchFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('nightly full resync', () => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000

    it('triggers a full sync after 24 hours even when data is already in cache', async () => {
      const lease1 = makeLease('lease-1')
      const lease2 = makeLease('lease-2')
      const fullFetchFn = jest
        .fn()
        .mockResolvedValueOnce([lease1])
        .mockResolvedValueOnce([lease1, lease2])
      const deltaFetchFn = jest.fn().mockResolvedValue([])

      cache.startLeaseCache(fullFetchFn, deltaFetchFn)
      await flushPromises()

      expect(cache.getAll()).toHaveLength(1)
      expect(fullFetchFn).toHaveBeenCalledTimes(1)

      jest.advanceTimersByTime(ONE_DAY_MS)
      await flushPromises()

      expect(fullFetchFn).toHaveBeenCalledTimes(2)
      expect(deltaFetchFn).not.toHaveBeenCalled()
      expect(cache.getAll()).toHaveLength(2)
    })

    it('keeps existing data and stays ready if nightly resync fails', async () => {
      const lease1 = makeLease('lease-1')
      const fullFetchFn = jest
        .fn()
        .mockResolvedValueOnce([lease1])
        .mockRejectedValueOnce(new Error('network failure'))
      const deltaFetchFn = jest.fn().mockResolvedValue([])

      cache.startLeaseCache(fullFetchFn, deltaFetchFn)
      await flushPromises()

      jest.advanceTimersByTime(ONE_DAY_MS)
      await flushPromises()

      expect(cache.isReady()).toBe(true)
      expect(cache.getAll()).toEqual([lease1])
    })

    it('waits for an ongoing sync before starting the nightly resync', async () => {
      let resolveInitialFetch!: (v: leasing.v1.LeaseSearchResult[]) => void
      const pendingInitial = new Promise<leasing.v1.LeaseSearchResult[]>(
        (resolve) => {
          resolveInitialFetch = resolve
        }
      )

      const fullFetchFn = jest
        .fn()
        .mockReturnValueOnce(pendingInitial)
        .mockResolvedValueOnce([makeLease('lease-2')])
      const deltaFetchFn = jest.fn().mockResolvedValue([])

      cache.startLeaseCache(fullFetchFn, deltaFetchFn)
      // Initial sync is pending — do not flush yet

      jest.advanceTimersByTime(ONE_DAY_MS)
      // scheduledFullSync is waiting for the ongoing initial sync

      resolveInitialFetch([makeLease('lease-1')])
      await flushPromises() // initial sync settles, scheduledFullSync resumes
      await flushPromises() // nightly full sync completes

      // Both the initial and the nightly full sync should have run
      expect(fullFetchFn).toHaveBeenCalledTimes(2)
      expect(deltaFetchFn).not.toHaveBeenCalled()
      expect(cache.getAll()).toEqual([makeLease('lease-2')])
    })
  })
})
