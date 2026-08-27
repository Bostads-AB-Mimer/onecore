import { leasing } from '@onecore/types'
import { logger } from '@onecore/utilities'

type CacheStatus = 'uninitialized' | 'syncing' | 'ready' | 'error'

const DELTA_BUFFER_MS = 30_000

const state: {
  leases: leasing.v1.LeaseSearchResult[]
  lastSyncedAt: Date | null
  status: CacheStatus
} = {
  leases: [],
  lastSyncedAt: null,
  status: 'uninitialized',
}

export function isReady(): boolean {
  return state.status === 'ready'
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

async function sync(
  fullFetchFn: () => Promise<leasing.v1.LeaseSearchResult[]>,
  deltaFetchFn: (since: Date) => Promise<leasing.v1.LeaseSearchResult[]>
): Promise<void> {
  if (state.status === 'syncing') return

  const hasData = state.leases.length > 0
  const lastSync = state.lastSyncedAt
  state.status = 'syncing'

  try {
    if (hasData && lastSync) {
      const since = new Date(lastSync.getTime() - DELTA_BUFFER_MS)
      const changed = await deltaFetchFn(since)
      const idMap = new Map(state.leases.map((l) => [l.leaseId, l]))
      for (const lease of changed) {
        idMap.set(lease.leaseId, lease)
      }
      state.leases = Array.from(idMap.values())
      state.lastSyncedAt = new Date()
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
  fullFetchFn: () => Promise<leasing.v1.LeaseSearchResult[]>,
  deltaFetchFn: (since: Date) => Promise<leasing.v1.LeaseSearchResult[]>,
  intervalMs = 10 * 60 * 1000
): void {
  sync(fullFetchFn, deltaFetchFn).catch(() => {})
  setInterval(() => sync(fullFetchFn, deltaFetchFn).catch(() => {}), intervalMs)
}
