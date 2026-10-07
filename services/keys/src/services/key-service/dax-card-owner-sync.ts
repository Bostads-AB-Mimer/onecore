import { logger } from '@onecore/utilities'
import type { CardOwner } from 'dax-client'
import * as daxAdapter from './adapters/dax-adapter'
import * as mirror from './dax-card-owner-mirror'
import { toOwnerRows } from './dax-card-owner-mirror'

const PAGE_SIZE = 200
const PARALLEL_PAGES = 5
export const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000

const MIN_PAGE_SIZE = 25
// Refuse a resync that would shrink the mirror below this share of the previous size
const MIN_KEEP_RATIO = 0.8

/**
 * DAX times out (500 "No reply from client") on some heavy 200-row pages,
 * deterministically. Split a failing range in half until it fits.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchRange(offset: number, limit: number): Promise<CardOwner[]> {
  try {
    return await daxAdapter.searchCardOwners({ offset, limit })
  } catch {
    await sleep(2000) // one plain retry covers network blips
  }
  try {
    return await daxAdapter.searchCardOwners({ offset, limit })
  } catch (err) {
    if (limit <= MIN_PAGE_SIZE) throw err
    const half = Math.ceil(limit / 2)
    logger.warn(
      { offset, limit, half },
      'dax-card-owner-sync: page failed, splitting'
    )
    const [a, b] = await Promise.all([
      fetchRange(offset, half),
      fetchRange(offset + half, limit - half),
    ])
    return [...a, ...b]
  }
}

/**
 * Worker pool: each lane takes the next offset from a shared cursor, so a
 * slow or split page never idles the other lanes. A short page marks the end.
 */
async function fetchAllCardOwners(): Promise<CardOwner[]> {
  const pages = new Map<number, CardOwner[]>()
  let cursor = 0
  let end = Number.POSITIVE_INFINITY

  const lane = async () => {
    while (cursor < end) {
      const offset = cursor
      cursor += PAGE_SIZE
      const page = await fetchRange(offset, PAGE_SIZE)
      pages.set(offset, page)
      if (page.length < PAGE_SIZE) end = Math.min(end, offset)
    }
  }

  await Promise.all(Array.from({ length: PARALLEL_PAGES }, lane))

  return [...pages.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, page]) => page)
}

let inFlight: Promise<{ fetched: number; stored: number }> | null = null
let lastResult: {
  finishedAt: Date
  ok: boolean
  fetched?: number
  stored?: number
  error?: string
} | null = null

export function isSyncRunning(): boolean {
  return inFlight !== null
}

export function getLastSyncResult() {
  return lastResult
}

/** Full resync of the in-memory mirror. Concurrent calls share one run. */
export function syncDaxCardOwners(): Promise<{
  fetched: number
  stored: number
}> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    const started = Date.now()
    const owners = await fetchAllCardOwners()
    if (owners.length === 0) {
      throw new Error('DAX returned no card owners, keeping existing mirror')
    }
    const rows = toOwnerRows(owners)
    // A short non-final page would truncate the list; keep the old mirror instead
    const previous = mirror.getState().count
    if (previous > 0 && rows.length < previous * MIN_KEEP_RATIO) {
      throw new Error(
        `DAX returned ${rows.length} active owners, previous mirror had ${previous}; keeping it`
      )
    }
    const stored = mirror.replaceAll(rows)
    logger.info(
      { fetched: owners.length, stored, ms: Date.now() - started },
      'dax-card-owner-sync: completed'
    )
    lastResult = {
      finishedAt: new Date(),
      ok: true,
      fetched: owners.length,
      stored,
    }
    return { fetched: owners.length, stored }
  })()
    .catch((err) => {
      lastResult = {
        finishedAt: new Date(),
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
      throw err
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

const BOOT_RETRY_DELAYS_MS = [60_000, 5 * 60_000]

const run = () =>
  syncDaxCardOwners().catch((err) =>
    logger.error({ err }, 'dax-card-owner-sync: failed')
  )

/** Start a sync if the mirror is empty and none is running (called on demand). */
export function ensureSyncStarted(): void {
  if (!mirror.isReady() && !inFlight) void run()
}

/**
 * Sync on start (mirror lives in memory) with two retries if DAX is down,
 * then every 24h. After that, a request against an empty mirror restarts it.
 */
export function startDaxCardOwnerSyncScheduler(): void {
  const bootAttempt = async (attempt: number) => {
    await run()
    if (!mirror.isReady() && attempt < BOOT_RETRY_DELAYS_MS.length) {
      setTimeout(
        () => void bootAttempt(attempt + 1),
        BOOT_RETRY_DELAYS_MS[attempt]
      ).unref()
    }
  }
  void bootAttempt(0)
  setInterval(run, SYNC_INTERVAL_MS).unref()
}
