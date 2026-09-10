import { leasing } from '@onecore/types'
import { logger } from '@onecore/utilities'

type CacheStatus = 'uninitialized' | 'syncing' | 'ready' | 'error'

const DELTA_BUFFER_MS = 30_000

type FetchFn = () => Promise<leasing.v1.LeaseSearchResult[]>
type DeltaFetchFn = (since: Date) => Promise<leasing.v1.LeaseSearchResult[]>

const state: {
  leases: leasing.v1.LeaseSearchResult[]
  lastSyncedAt: Date | null
  status: CacheStatus
  fullFetchFn: FetchFn | null
  deltaFetchFn: DeltaFetchFn | null
  ongoingSync: Promise<void> | null
} = {
  leases: [],
  lastSyncedAt: null,
  status: 'uninitialized',
  fullFetchFn: null,
  deltaFetchFn: null,
  ongoingSync: null,
}

export function isReady(): boolean {
  return state.status === 'ready'
}

// Resolves true when cache becomes ready, false if it errors or times out.
export function whenReady(timeoutMs: number): Promise<boolean> {
  if (state.status === 'ready') return Promise.resolve(true)
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (state.status === 'ready' || state.status === 'error') {
        clearInterval(interval)
        resolve(state.status === 'ready')
      }
    }, 200)
    setTimeout(() => {
      clearInterval(interval)
      resolve(false)
    }, timeoutMs)
  })
}

export function getAll(): leasing.v1.LeaseSearchResult[] {
  return state.leases
}

export function getCacheInfo() {
  return {
    status: state.status,
    count: state.leases.length,
    lastSyncedAt: state.lastSyncedAt,
  }
}

/**
 * If the cache is stale (older than thresholdMs), awaits a sync before returning.
 * Concurrent callers share the same sync promise — only one sync runs at a time.
 * Falls back to existing data if the sync exceeds timeoutMs.
 */
export async function refreshIfStale(
  thresholdMs: number,
  timeoutMs: number
): Promise<void> {
  if (!state.lastSyncedAt || !state.fullFetchFn || !state.deltaFetchFn) return

  const ageMs = Date.now() - state.lastSyncedAt.getTime()
  if (ageMs < thresholdMs) return

  logger.info(
    { ageMs, thresholdMs },
    'lease-cache: cache is stale, awaiting sync'
  )

  const start = Date.now()

  try {
    await Promise.race([
      sync(state.fullFetchFn, state.deltaFetchFn),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error('refreshIfStale timed out')),
          timeoutMs
        )
      ),
    ])
    logger.info(
      { durationMs: Date.now() - start },
      'lease-cache: stale refresh complete'
    )
  } catch (err) {
    logger.warn(
      { err, durationMs: Date.now() - start },
      'lease-cache: stale refresh timed out or failed, using existing data'
    )
  }
}

async function sync(
  fullFetchFn: FetchFn,
  deltaFetchFn: DeltaFetchFn
): Promise<void> {
  // Share ongoing sync promise across concurrent callers
  if (state.ongoingSync) return state.ongoingSync

  state.ongoingSync = doSync(fullFetchFn, deltaFetchFn).finally(() => {
    state.ongoingSync = null
  })

  return state.ongoingSync
}

async function doSync(
  fullFetchFn: FetchFn,
  deltaFetchFn: DeltaFetchFn
): Promise<void> {
  if (state.status === 'syncing') return

  const hasData = state.leases.length > 0
  const lastSync = state.lastSyncedAt
  state.status = 'syncing'

  try {
    if (hasData && lastSync) {
      const syncStartedAt = new Date()
      const since = new Date(lastSync.getTime() - DELTA_BUFFER_MS)
      const changed = await deltaFetchFn(since)
      const idMap = new Map(state.leases.map((l) => [l.leaseId, l]))
      for (const lease of changed) {
        idMap.set(lease.leaseId, lease)
      }
      state.leases = Array.from(idMap.values())
      state.lastSyncedAt = syncStartedAt
      state.status = 'ready'
      logger.info(
        { changed: changed.length, total: state.leases.length },
        'lease-cache: delta sync complete'
      )
    } else {
      const leases = await fullFetchFn()
      state.leases = leases
      state.lastSyncedAt = new Date()
      state.status = 'ready'
      logger.info({ count: leases.length }, 'lease-cache: full sync complete')
    }
  } catch (err) {
    if (hasData) {
      state.status = 'ready'
      logger.error({ err }, 'lease-cache: sync failed, keeping previous data')
    } else {
      state.status = 'error'
      logger.error({ err }, 'lease-cache: sync failed, no data available')
    }
  }
}

export function startLeaseCache(
  fullFetchFn: FetchFn,
  deltaFetchFn: DeltaFetchFn
): void {
  state.fullFetchFn = fullFetchFn
  state.deltaFetchFn = deltaFetchFn
  sync(fullFetchFn, deltaFetchFn).catch(() => {})
}
