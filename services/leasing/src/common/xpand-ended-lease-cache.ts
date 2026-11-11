import { leasing } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { AdapterResult } from '../services/lease-service/adapters/types'

type LoadFn = () => Promise<
  AdapterResult<leasing.v1.LeaseSearchResult[], unknown>
>

const RELOAD_INTERVAL_MS = 24 * 60 * 60 * 1000

let leases: leasing.v1.LeaseSearchResult[] = []
let ready = false
let ongoingLoad: Promise<void> | null = null

async function load(loadFn: LoadFn): Promise<void> {
  const started = Date.now()
  const result = await loadFn().catch((err): AdapterResult<never, unknown> => ({
    ok: false,
    err,
  }))
  if (!result.ok) {
    logger.error(
      { err: result.err, keptRows: leases.length },
      'xpand-ended-lease-cache: load failed, keeping previous data'
    )
    return
  }
  leases = result.data
  ready = true
  logger.info(
    { rows: leases.length, ms: Date.now() - started },
    'xpand-ended-lease-cache: loaded'
  )
}

function reload(loadFn: LoadFn): Promise<void> {
  if (!ongoingLoad) {
    ongoingLoad = load(loadFn).finally(() => {
      ongoingLoad = null
    })
  }
  return ongoingLoad
}

export function getAll(): leasing.v1.LeaseSearchResult[] {
  return leases
}

export function isReady(): boolean {
  return ready
}

export function startXpandEndedLeaseCache(loadFn: LoadFn): Promise<void> {
  setInterval(() => reload(loadFn).catch(() => {}), RELOAD_INTERVAL_MS)
  return reload(loadFn)
}
