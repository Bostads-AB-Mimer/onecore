import { leasing } from '@onecore/types'
import { logger } from '@onecore/utilities'

type CacheStatus = 'uninitialized' | 'syncing' | 'ready' | 'error'

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
  fetchFn: () => Promise<leasing.v1.LeaseSearchResult[]>
): Promise<void> {
  if (state.status === 'syncing') return

  const hasData = state.leases.length > 0
  state.status = 'syncing'
  logger.info({ count: state.leases.length }, 'lease-cache: starting sync')

  try {
    const leases = await fetchFn()
    state.leases = leases
    state.lastSyncedAt = new Date()
    state.status = 'ready'
    logger.info({ count: leases.length }, 'lease-cache: sync complete')
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
  fetchFn: () => Promise<leasing.v1.LeaseSearchResult[]>,
  intervalMs = 10 * 60 * 1000
): void {
  sync(fetchFn).catch(() => {})
  setInterval(() => sync(fetchFn).catch(() => {}), intervalMs)
}
