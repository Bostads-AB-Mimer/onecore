import KoaRouter from '@koa/router'
import {
  buildPaginatedResponse,
  chunk,
  generateRouteMetadata,
  logger,
  parsePaginationParams,
  runWithConcurrency,
} from '@onecore/utilities'
import { z } from 'zod'
import { keys, leasing } from '@onecore/types'

import { KeysApi, KeyLoansApi, KeyNotesApi } from '../../adapters/keys-adapter'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import {
  LeaseSummary,
  deriveStatus,
  pickOutgoingIncoming,
  toDate,
} from './move-in-out-derive'

type MoveInOutRow = keys.MoveInOutRow

const LEASE_SEARCH_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 100
const BATCH_SIZE = 100
const OBJECT_CACHE_TTL_MS = 2 * 60 * 1000
const SEARCH_CONCURRENCY = 5
const BATCH_CONCURRENCY = 6
// A neighbour lease further away than this counts as vacant
const NEIGHBOUR_WINDOW_MONTHS = 3

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')

const sortBySchema = z.enum([
  'rentalObjectCode',
  'lastDebitDate',
  'leaseStartDate',
])
type SortBy = z.infer<typeof sortBySchema>

const querySchema = z
  .object({
    endDateFrom: dateString.optional(),
    endDateTo: dateString.optional(),
    startDateFrom: dateString.optional(),
    startDateTo: dateString.optional(),
    q: z.string().trim().min(1).optional(),
    sortBy: sortBySchema.optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    debug: z.enum(['true', 'false']).optional(),
  })
  .refine(
    (q) => (q.endDateFrom && q.endDateTo) || (q.startDateFrom && q.startDateTo),
    'Provide endDateFrom+endDateTo and/or startDateFrom+startDateTo'
  )

type Query = z.infer<typeof querySchema>

/** Keys service is rebuilding its DAX card owner mirror (after a restart). */
export class KeysUnavailableError extends Error {
  constructor() {
    super('keys service unavailable')
    this.name = 'KeysUnavailableError'
  }
}

/** Per-search profile, logged with the request timings */
export type LeaseSearchStats = {
  ms: number
  pages: number
  avgPageMs: number
  maxPageMs: number
  total: number
  unique: number
}

async function fetchAllPages(filters: Record<string, string>): Promise<{
  leases: leasing.v1.LeaseSearchResult[]
  total: number
  pageMs: number[]
}> {
  const pageMs: number[] = []
  const fetchPage = async (page: number) => {
    const started = Date.now()
    const result = await leasingAdapter.searchLeases({
      ...filters,
      includeEnded: 'true',
      // leaseId is unique; every other order loses rows between parallel pages
      sortBy: 'leaseId',
      page: String(page),
      limit: String(LEASE_SEARCH_PAGE_SIZE),
    })
    pageMs.push(Date.now() - started)
    return result
  }

  const first = await fetchPage(1)
  const total = first._meta.totalRecords
  const pageCount = Math.ceil(total / LEASE_SEARCH_PAGE_SIZE)
  const rest = await runWithConcurrency(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => i + 2),
    (page) => fetchPage(page),
    SEARCH_CONCURRENCY
  )
  return { leases: [first, ...rest].flatMap((r) => r.content), total, pageMs }
}

/**
 * All pages of one lease search, fetched in parallel and ordered by leaseId.
 * Measured: date orders drop ~2% of leases between pages and rental object
 * code occasionally loses one; leaseId is the only stable order leasing offers.
 */
async function searchAllLeases(filters: Record<string, string>): Promise<{
  leases: leasing.v1.LeaseSearchResult[]
  stats: LeaseSearchStats
}> {
  const started = Date.now()
  const { leases, total, pageMs } = await fetchAllPages(filters)
  const unique = [...new Map(leases.map((l) => [l.leaseId, l])).values()]
  if (unique.length < total) {
    logger.warn(
      { filters, unique: unique.length, total },
      'move-in-out: lease paging lost rows despite leaseId order'
    )
  }
  return {
    leases: unique,
    stats: {
      ms: Date.now() - started,
      pages: pageMs.length,
      avgPageMs: Math.round(pageMs.reduce((a, b) => a + b, 0) / pageMs.length),
      maxPageMs: Math.max(...pageMs),
      total,
      unique: unique.length,
    },
  }
}

/** Shift a YYYY-MM-DD date by whole months. */
export function shiftMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10)
}

function summaryFromSearch(l: leasing.v1.LeaseSearchResult): LeaseSummary {
  return {
    leaseId: l.leaseId,
    names: l.contacts.map((c) => c.name),
    contactCodes: l.contacts.map((c) => c.contactCode),
    leaseStartDate: toDate(l.startDate),
    lastDebitDate: toDate(l.lastDebitDate),
  }
}

type ObjectBucket = {
  address: string | null
  objectTypeCode: string | null
  endLeaseIds: Set<string>
  startLeaseIds: Set<string>
  leases: Map<string, LeaseSummary>
}

function inRange(date: Date | null, from?: string, to?: string): boolean {
  if (!date || !from || !to) return false
  const day = date.toISOString().slice(0, 10)
  return day >= from && day <= to
}

/**
 * Group both wide searches per object. A lease is a row match only when its
 * end/start date falls inside the requested range; the rest are neighbours.
 */
function collectObjects(
  ending: leasing.v1.LeaseSearchResult[],
  starting: leasing.v1.LeaseSearchResult[],
  query: Query
): Map<string, ObjectBucket> {
  const objects = new Map<string, ObjectBucket>()
  const add = (l: leasing.v1.LeaseSearchResult) => {
    if (!l.rentalObjectCode) return
    let bucket = objects.get(l.rentalObjectCode)
    if (!bucket) {
      bucket = {
        address: l.address,
        objectTypeCode: l.objectTypeCode ?? null,
        endLeaseIds: new Set(),
        startLeaseIds: new Set(),
        leases: new Map(),
      }
      objects.set(l.rentalObjectCode, bucket)
    }
    const summary = summaryFromSearch(l)
    bucket.leases.set(l.leaseId, summary)
    if (inRange(summary.lastDebitDate, query.endDateFrom, query.endDateTo)) {
      bucket.endLeaseIds.add(l.leaseId)
    }
    if (
      inRange(summary.leaseStartDate, query.startDateFrom, query.startDateTo)
    ) {
      bucket.startLeaseIds.add(l.leaseId)
    }
  }
  ending.forEach(add)
  starting.forEach(add)
  for (const [code, bucket] of objects) {
    if (bucket.endLeaseIds.size === 0 && bucket.startLeaseIds.size === 0) {
      objects.delete(code)
    }
  }
  return objects
}

export type MoveInOutTimings = {
  leaseSearchMs: number
  leasesFound: number
  /** Present on a cold load only; cached loads did no lease search */
  leaseSearch?: { ending: LeaseSearchStats; starting: LeaseSearchStats }
  objects: number
  keysAndLoansMs: number
  keysBatchMs: number
  loansBatchMs: number
  notesBatchMs: number
  totalMs: number
}

type ResolvedObject = {
  rentalObjectCode: string
  address: string | null
  objectTypeCode: string | null
  outgoing: LeaseSummary | null
  incoming: LeaseSummary | null
}

type ObjectCacheEntry = {
  at: number
  objects: ResolvedObject[]
  leaseSearchMs: number
  leasesFound: number
  leaseSearch: { ending: LeaseSearchStats; starting: LeaseSearchStats }
}

// Lease-derived object list per filter; pages 2..n and re-sorts skip the search
const objectCache = new Map<string, ObjectCacheEntry>()

function cacheKey(query: Query): string {
  return [
    query.endDateFrom,
    query.endDateTo,
    query.startDateFrom,
    query.startDateTo,
  ].join('|')
}

async function resolveObjects(query: Query): Promise<ObjectCacheEntry> {
  const key = cacheKey(query)
  const cached = objectCache.get(key)
  if (cached && Date.now() - cached.at < OBJECT_CACHE_TTL_MS) return cached

  const t0 = Date.now()
  // Both searches always run so the neighbour of a row is found in bulk:
  // leases ending up to 3 months before the range, starting up to 3 months after.
  const from = [query.endDateFrom, query.startDateFrom]
    .filter((d): d is string => Boolean(d))
    .sort()[0]
  const to = [query.endDateTo, query.startDateTo]
    .filter((d): d is string => Boolean(d))
    .sort()
    .reverse()[0]
  const [endingSearch, startingSearch] = await Promise.all([
    searchAllLeases({
      endDateFrom: shiftMonths(from, -NEIGHBOUR_WINDOW_MONTHS),
      endDateTo: to,
    }),
    searchAllLeases({
      startDateFrom: from,
      startDateTo: shiftMonths(to, NEIGHBOUR_WINDOW_MONTHS),
    }),
  ])
  const ending = endingSearch.leases
  const starting = startingSearch.leases

  const objects = [...collectObjects(ending, starting, query)].map(
    ([rentalObjectCode, bucket]) => ({
      rentalObjectCode,
      address: bucket.address,
      objectTypeCode: bucket.objectTypeCode,
      ...pickOutgoingIncoming(
        [...bucket.leases.values()],
        bucket.endLeaseIds,
        bucket.startLeaseIds
      ),
    })
  )

  const entry = {
    at: Date.now(),
    objects,
    leaseSearchMs: Date.now() - t0,
    leasesFound: ending.length + starting.length,
    leaseSearch: { ending: endingSearch.stats, starting: startingSearch.stats },
  }
  for (const [k, v] of objectCache) {
    if (Date.now() - v.at >= OBJECT_CACHE_TTL_MS) objectCache.delete(k)
  }
  objectCache.set(key, entry)
  return entry
}

/** Test helper */
export function clearObjectCache(): void {
  objectCache.clear()
}

function matchesSearch(o: ResolvedObject, q: string): boolean {
  const needle = q.toLowerCase()
  return [
    o.rentalObjectCode,
    o.address ?? '',
    ...(o.outgoing?.names ?? []),
    ...(o.outgoing?.contactCodes ?? []),
    ...(o.incoming?.names ?? []),
    ...(o.incoming?.contactCodes ?? []),
  ].some((s) => s.toLowerCase().includes(needle))
}

const time = (d: Date | null | undefined) => d?.getTime() ?? 0

function sortObjects(
  objects: ResolvedObject[],
  sortBy: SortBy,
  sortOrder: 'asc' | 'desc'
): ResolvedObject[] {
  const dir = sortOrder === 'asc' ? 1 : -1
  const value = (o: ResolvedObject): string | number => {
    switch (sortBy) {
      case 'rentalObjectCode':
        return o.rentalObjectCode
      case 'lastDebitDate':
        return time(o.outgoing?.lastDebitDate)
      case 'leaseStartDate':
        return time(o.incoming?.leaseStartDate)
    }
  }
  return [...objects].sort((a, b) => {
    const va = value(a)
    const vb = value(b)
    if (va === vb) return a.rentalObjectCode.localeCompare(b.rentalObjectCode)
    return (va < vb ? -1 : 1) * dir
  })
}

export async function buildMoveInOutPage(
  query: Query,
  page: number,
  limit: number
): Promise<{
  rows: MoveInOutRow[]
  totalRecords: number
  timings: MoveInOutTimings
}> {
  const t0 = Date.now()
  const resolved = await resolveObjects(query)

  const q = query.q
  const filtered = q
    ? resolved.objects.filter((o) => matchesSearch(o, q))
    : resolved.objects
  const sorted = sortObjects(
    filtered,
    query.sortBy ?? 'lastDebitDate',
    query.sortOrder ?? 'asc'
  )
  const pageObjects = sorted.slice((page - 1) * limit, page * limit)
  const codes = pageObjects.map((o) => o.rentalObjectCode)

  const timings: MoveInOutTimings = {
    leaseSearchMs: resolved.leaseSearchMs,
    leasesFound: resolved.leasesFound,
    ...(resolved.at >= t0 ? { leaseSearch: resolved.leaseSearch } : {}),
    objects: codes.length,
    keysAndLoansMs: 0,
    keysBatchMs: 0,
    loansBatchMs: 0,
    notesBatchMs: 0,
    totalMs: 0,
  }
  if (codes.length === 0) {
    return { rows: [], totalRecords: filtered.length, timings }
  }

  const t1 = Date.now()
  const keysByCode: Record<string, keys.KeyDetails[]> = {}
  const loansByCode: Record<string, keys.KeyLoanWithDetails[]> = {}
  const cardsByCode: Record<string, keys.Card[]> = {}
  const cardsUnresolved = new Set<string>()
  const notesByCode: Record<string, keys.KeyNote[]> = {}
  const timed = async <T>(
    key: 'keysBatchMs' | 'loansBatchMs' | 'notesBatchMs',
    p: Promise<T>
  ) => {
    const start = Date.now()
    const result = await p
    timings[key] += Date.now() - start
    return result
  }
  await runWithConcurrency(
    chunk(codes, BATCH_SIZE),
    async (batch) => {
      const [keysResult, loansResult, notesResult] = await Promise.all([
        timed('keysBatchMs', KeysApi.getBatchByRentalObject(batch)),
        timed('loansBatchMs', KeyLoansApi.getBatchByRentalObject(batch)),
        timed('notesBatchMs', KeyNotesApi.getBatchByRentalObject(batch)),
      ])
      if (!keysResult.ok)
        throw new Error(`keys batch failed: ${keysResult.err}`)
      if (!loansResult.ok) {
        if (loansResult.err === 'unavailable') throw new KeysUnavailableError()
        throw new Error(`key loans batch failed: ${loansResult.err}`)
      }
      // Notes are informational; a failed lookup leaves them empty
      if (notesResult.ok) Object.assign(notesByCode, notesResult.data)
      else
        logger.warn({ err: notesResult.err }, 'move-in-out: notes batch failed')
      Object.assign(keysByCode, keysResult.data)
      Object.assign(loansByCode, loansResult.data.loans)
      Object.assign(cardsByCode, loansResult.data.cards)
      loansResult.data.cardsUnresolved.forEach((c) => cardsUnresolved.add(c))
    },
    BATCH_CONCURRENCY
  )
  timings.keysAndLoansMs = Date.now() - t1

  const rows = pageObjects.map((o) => ({
    rentalObjectCode: o.rentalObjectCode,
    address: o.address,
    objectTypeCode: o.objectTypeCode,
    outgoing: o.outgoing,
    incoming: o.incoming,
    notes: (notesByCode[o.rentalObjectCode] ?? []).map((n) => n.description),
    ...deriveStatus({
      outgoing: o.outgoing,
      incoming: o.incoming,
      keys: keysByCode[o.rentalObjectCode] ?? [],
      cards: cardsByCode[o.rentalObjectCode] ?? [],
      loans: loansByCode[o.rentalObjectCode] ?? [],
      cardsUnresolved: cardsUnresolved.has(o.rentalObjectCode),
    }),
  }))
  timings.totalMs = Date.now() - t0
  logger.info({ ...timings }, 'move-in-out: timings')
  return { rows, totalRecords: filtered.length, timings }
}

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /keys/move-in-out:
   *   get:
   *     summary: Move-in / move-out key status per rental object (paginated)
   *     description: |
   *       Finds leases ending (lastDebitDate) and/or starting in the given ranges, then
   *       returns one row per rental object with the outgoing and incoming tenant,
   *       key/card counts, loan return and handout dates, and a derived status.
   *       Give endDateFrom+endDateTo for move-outs, startDateFrom+startDateTo for
   *       move-ins, or both for the union. Search and sort apply to the whole result;
   *       key and card data (DAX) is fetched only for the requested page.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: query
   *         name: endDateFrom
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: endDateTo
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: startDateFrom
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: startDateTo
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Matches rental object code, address, tenant name or contact code.
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [rentalObjectCode, lastDebitDate, leaseStartDate]
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *       - in: query
   *         name: debug
   *         schema:
   *           type: boolean
   *         description: When true, adds a `timings` block with per-phase durations.
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 100
   *     responses:
   *       200:
   *         description: One page of rows
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/PaginatedResponse'
   *                 - type: object
   *                   properties:
   *                     content:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/MoveInOutRow'
   *       400:
   *         description: Invalid query parameters
   *       503:
   *         description: Keys service is syncing its DAX card owner mirror; retry later
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/keys/move-in-out', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'endDateFrom',
      'endDateTo',
      'startDateFrom',
      'startDateTo',
      'q',
      'sortBy',
      'sortOrder',
      'page',
      'limit',
      'debug',
    ])

    const parsed = querySchema.safeParse(ctx.query)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = {
        reason: 'Invalid query parameters',
        error: parsed.error.flatten(),
        ...metadata,
      }
      return
    }

    try {
      const { page, limit } = parsePaginationParams(ctx, DEFAULT_PAGE_SIZE)
      const { rows, totalRecords, timings } = await buildMoveInOutPage(
        parsed.data,
        page,
        limit
      )
      const additionalParams = Object.fromEntries(
        Object.entries(parsed.data).filter(
          (e): e is [string, string] =>
            typeof e[1] === 'string' && e[0] !== 'debug'
        )
      )
      ctx.status = 200
      ctx.body = {
        ...buildPaginatedResponse({
          content: rows,
          totalRecords,
          ctx,
          additionalParams,
          defaultLimit: DEFAULT_PAGE_SIZE,
        }),
        ...(parsed.data.debug === 'true' ? { timings } : {}),
        ...metadata,
      }
    } catch (err) {
      if (err instanceof KeysUnavailableError) {
        ctx.status = 503
        ctx.set('Retry-After', '60')
        ctx.body = {
          reason:
            'Nyckeltjänsten synkroniserar taggar från DAX, försök igen om några minuter',
          ...metadata,
        }
        return
      }
      logger.error({ err, metadata }, 'move-in-out: failed to build rows')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
