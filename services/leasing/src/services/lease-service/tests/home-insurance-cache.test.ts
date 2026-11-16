import { TenfastLease } from '../adapters/tenfast/schemas'
import { AdapterResult } from '../adapters/types'
import { createHomeInsuranceCache } from '../services/home-insurance-cache'
import * as factory from './factories'

type LoadResult = AdapterResult<TenfastLease[], unknown>

// A promise the test settles itself.
const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const lease = (externalId: string, overrides: Partial<TenfastLease> = {}) =>
  factory.tenfastLease.build({ externalId, stage: 'active', ...overrides })

const ids = (leases: TenfastLease[]) => leases.map((l) => l.externalId).sort()

const TTL_MS = 60_000
const WARMUP_WAIT_MS = 1_000
const RETRY_COOLDOWN_MS = 5_000

const setup = () => {
  const load = jest.fn<Promise<LoadResult>, []>()
  const cache = createHomeInsuranceCache({
    load,
    ttlMs: TTL_MS,
    warmupWaitMs: WARMUP_WAIT_MS,
    retryCooldownMs: RETRY_COOLDOWN_MS,
  })
  return { cache, load }
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-11-13T10:00:00Z'))
})

afterEach(() => {
  jest.useRealTimers()
})

describe('createHomeInsuranceCache', () => {
  describe('getLeases', () => {
    it('shares one load between reads made while it runs', async () => {
      const { cache, load } = setup()
      const pending = deferred<LoadResult>()
      load.mockReturnValueOnce(pending.promise)

      const first = cache.getLeases()
      const second = cache.getLeases()
      pending.resolve({ ok: true, data: [lease('A')] })

      expect((await first).ok).toBe(true)
      expect((await second).ok).toBe(true)
      expect(load).toHaveBeenCalledTimes(1)
    })

    it('answers cache-warming when the first load takes longer than the wait, and serves it once done', async () => {
      const { cache, load } = setup()
      const pending = deferred<LoadResult>()
      load.mockReturnValueOnce(pending.promise)

      const read = cache.getLeases()
      await jest.advanceTimersByTimeAsync(WARMUP_WAIT_MS)
      expect(await read).toEqual({ ok: false, err: 'cache-warming' })

      pending.resolve({ ok: true, data: [lease('A')] })
      const later = await cache.getLeases()

      expect(later.ok && ids(later.leases)).toEqual(['A'])
      expect(load).toHaveBeenCalledTimes(1)
    })

    it('answers upstream-failed when the first load fails, and does not load again during the cooldown', async () => {
      const { cache, load } = setup()
      load.mockResolvedValueOnce({ ok: false, err: 'unknown' })

      expect(await cache.getLeases()).toEqual({
        ok: false,
        err: 'upstream-failed',
      })
      expect(await cache.getLeases()).toEqual({
        ok: false,
        err: 'upstream-failed',
      })
      expect(load).toHaveBeenCalledTimes(1)

      jest.setSystemTime(Date.now() + RETRY_COOLDOWN_MS)
      load.mockResolvedValueOnce({ ok: true, data: [lease('A')] })

      expect((await cache.getLeases()).ok).toBe(true)
      expect(load).toHaveBeenCalledTimes(2)
    })

    it('serves stale leases at once and refreshes them in the background', async () => {
      const { cache, load } = setup()
      load.mockResolvedValueOnce({ ok: true, data: [lease('A')] })
      await cache.getLeases()

      jest.setSystemTime(Date.now() + TTL_MS)
      const pending = deferred<LoadResult>()
      load.mockReturnValueOnce(pending.promise)

      const stale = await cache.getLeases()
      expect(stale.ok && ids(stale.leases)).toEqual(['A'])
      expect(load).toHaveBeenCalledTimes(2)

      pending.resolve({ ok: true, data: [lease('B')] })
      await jest.advanceTimersByTimeAsync(0)

      const fresh = await cache.getLeases()
      expect(fresh.ok && ids(fresh.leases)).toEqual(['B'])
    })

    it('keeps the cached leases when a refresh fails', async () => {
      const { cache, load } = setup()
      load.mockResolvedValueOnce({ ok: true, data: [lease('A')] })
      await cache.getLeases()

      jest.setSystemTime(Date.now() + TTL_MS)
      load.mockResolvedValueOnce({ ok: false, err: 'unknown' })
      await cache.getLeases()
      await jest.advanceTimersByTimeAsync(0)

      const read = await cache.getLeases()
      expect(read.ok && ids(read.leases)).toEqual(['A'])
      // Stale, but within the cooldown after the failed refresh.
      expect(load).toHaveBeenCalledTimes(2)
    })
  })

  describe('replaceLease', () => {
    it('puts the lease in place of the cached one', async () => {
      const { cache, load } = setup()
      load.mockResolvedValueOnce({
        ok: true,
        data: [lease('A', { version: 1 }), lease('B')],
      })
      await cache.getLeases()

      cache.replaceLease(lease('A', { version: 2 }))

      const read = await cache.getLeases()
      expect(read.ok && ids(read.leases)).toEqual(['A', 'B'])
      expect(
        read.ok && read.leases.find((l) => l.externalId === 'A')?.version
      ).toBe(2)
    })

    it('removes a lease whose stage is no longer listed', async () => {
      const { cache, load } = setup()
      load.mockResolvedValueOnce({ ok: true, data: [lease('A'), lease('B')] })
      await cache.getLeases()

      cache.replaceLease(lease('A', { stage: 'terminated' }))

      const read = await cache.getLeases()
      expect(read.ok && ids(read.leases)).toEqual(['B'])
    })

    it('puts the lease in place again on top of a load that started before the write', async () => {
      const { cache, load } = setup()
      load.mockResolvedValueOnce({
        ok: true,
        data: [lease('A', { version: 1 })],
      })
      await cache.getLeases()

      jest.setSystemTime(Date.now() + TTL_MS)
      const pending = deferred<LoadResult>()
      load.mockReturnValueOnce(pending.promise)
      await cache.getLeases()

      jest.setSystemTime(Date.now() + 1)
      cache.replaceLease(lease('A', { version: 2 }))
      // The load read the lease before the write.
      pending.resolve({ ok: true, data: [lease('A', { version: 1 })] })
      await jest.advanceTimersByTimeAsync(0)

      const read = await cache.getLeases()
      expect(read.ok && read.leases.map((l) => l.version)).toEqual([2])
    })
  })

  describe('invalidate', () => {
    it('makes the next read reload', async () => {
      const { cache, load } = setup()
      load.mockResolvedValueOnce({ ok: true, data: [lease('A')] })
      await cache.getLeases()

      cache.invalidate()

      jest.setSystemTime(Date.now() + 1)
      load.mockResolvedValueOnce({ ok: true, data: [lease('B')] })
      await cache.getLeases()
      await jest.advanceTimersByTimeAsync(0)

      expect(load).toHaveBeenCalledTimes(2)
      const read = await cache.getLeases()
      expect(read.ok && ids(read.leases)).toEqual(['B'])
    })
  })
})
