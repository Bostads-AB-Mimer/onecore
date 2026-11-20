import { logger } from '@onecore/utilities'

import { TenfastLease } from '../adapters/tenfast/schemas'
import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import { AdapterResult } from '../adapters/types'

export type HomeInsuranceCacheRead =
  | { ok: true; leases: TenfastLease[] }
  | { ok: false; err: 'cache-warming' | 'upstream-failed' }

type HomeInsuranceCacheOptions = {
  load: () => Promise<AdapterResult<TenfastLease[], unknown>>
  // How long a load is served before the next read reloads it.
  ttlMs?: number
  // How long a read waits for the first load before answering cache-warming.
  warmupWaitMs?: number
  // How long after a failed load no new load is started.
  retryCooldownMs?: number
}

const DEFAULT_TTL_MS = 5 * 60 * 1000
const DEFAULT_WARMUP_WAIT_MS = 10_000
const DEFAULT_RETRY_COOLDOWN_MS = 30_000

// A lease written through in another stage is no longer one Tenfast lists.
const LISTED_STAGES: ReadonlySet<string> = new Set(
  tenfastAdapter.HOME_INSURANCE_LEASE_STAGES
)

const isListed = (lease: TenfastLease) => LISTED_STAGES.has(lease.stage)

const withLease = (
  leases: TenfastLease[],
  lease: TenfastLease
): TenfastLease[] => {
  const others = leases.filter((l) => l.externalId !== lease.externalId)
  return isListed(lease) ? [...others, lease] : others
}

/**
 * The leases with home insurance, held in memory for the staff list, since
 * Tenfast can neither search, sort nor page them.
 *
 * - A load is shared by everyone who asks while it runs.
 * - Until the first load is done a read waits up to warmupWaitMs, then
 *   answers cache-warming. After it, a read older than ttlMs is answered from
 *   memory while a load refreshes it in the background.
 * - A failed load keeps what was loaded before, and no new load starts for
 *   retryCooldownMs.
 * - Writes go through: a route that changed a lease's home insurance rows
 *   puts the lease as read after the write in place (replaceLease), or makes
 *   the cache reload when it could not read it (invalidate). Such a lease is
 *   put in place again on top of a load that started before the write.
 *
 * Each pod holds its own copy, so a write through one pod shows on the
 * others only when they next load, at most ttlMs later.
 */
export const createHomeInsuranceCache = (
  options: HomeInsuranceCacheOptions
) => {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const warmupWaitMs = options.warmupWaitMs ?? DEFAULT_WARMUP_WAIT_MS
  const retryCooldownMs = options.retryCooldownMs ?? DEFAULT_RETRY_COOLDOWN_MS

  let leases: TenfastLease[] | null = null
  // When the load that gave leases started: its data is as old as that.
  let loadedAt = 0
  // A write whose lease could not be read again makes everything loaded
  // before it stale.
  let invalidatedAt = 0
  let failedAt: number | null = null
  let ongoingLoad: Promise<boolean> | null = null
  const writes = new Map<string, { lease: TenfastLease; at: number }>()

  const inUse = () => leases !== null || ongoingLoad !== null

  const coolingDown = () =>
    failedAt !== null && Date.now() - failedAt < retryCooldownMs

  const isStale = () =>
    loadedAt <= invalidatedAt || Date.now() - loadedAt >= ttlMs

  const load = (): Promise<boolean> => {
    if (ongoingLoad) return ongoingLoad

    const startedAt = Date.now()
    ongoingLoad = options
      .load()
      .catch((err: unknown): AdapterResult<never, unknown> => ({
        ok: false,
        err,
      }))
      .then((result) => {
        if (!result.ok) {
          failedAt = Date.now()
          // The adapter has logged the failure itself.
          logger.warn(
            { err: result.err, keptLeases: leases?.length ?? 0 },
            'home-insurance-cache: load failed, keeping what was loaded before'
          )
          return false
        }

        let loaded = result.data
        for (const [leaseId, write] of writes) {
          if (write.at >= startedAt) loaded = withLease(loaded, write.lease)
          else writes.delete(leaseId)
        }
        leases = loaded
        loadedAt = startedAt
        failedAt = null
        logger.info(
          { leases: loaded.length, ms: Date.now() - startedAt },
          'home-insurance-cache: loaded'
        )
        return true
      })
      .finally(() => {
        ongoingLoad = null
      })

    return ongoingLoad
  }

  const waitForFirstLoad = async (): Promise<boolean | 'timeout'> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), warmupWaitMs)
    })
    try {
      return await Promise.race([load(), timeout])
    } finally {
      clearTimeout(timer)
    }
  }

  const getLeases = async (): Promise<HomeInsuranceCacheRead> => {
    if (leases) {
      if (isStale() && !coolingDown()) {
        // Answer from memory; the shared load refreshes it in the background
        // and never rejects.
        void load()
      }
      return { ok: true, leases }
    }

    if (!ongoingLoad && coolingDown()) {
      return { ok: false, err: 'upstream-failed' }
    }

    const loaded = await waitForFirstLoad()
    if (loaded === 'timeout') return { ok: false, err: 'cache-warming' }
    if (!loaded || !leases) return { ok: false, err: 'upstream-failed' }
    return { ok: true, leases }
  }

  /**
   * Makes everything loaded so far stale, for a write whose lease could not
   * be read again: the next read of the cache reloads.
   */
  const invalidate = (): void => {
    invalidatedAt = Date.now()
  }

  /** Puts the lease, as read after a write, in place of the cached one. */
  const replaceLease = (lease: TenfastLease): void => {
    if (!inUse()) return
    writes.set(lease.externalId, { lease, at: Date.now() })
    if (leases) leases = withLease(leases, lease)
  }

  return { getLeases, replaceLease, invalidate }
}

export type HomeInsuranceCache = ReturnType<typeof createHomeInsuranceCache>

// Calls through the adapter module at call time, so tests can spy on it.
export const homeInsuranceCache: HomeInsuranceCache = createHomeInsuranceCache({
  load: () => tenfastAdapter.getLeasesWithHomeInsurance(),
})
