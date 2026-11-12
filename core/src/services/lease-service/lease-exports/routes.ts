import assert from 'node:assert'
import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import type { FileListItem } from '@onecore/types'

import * as fileStorageAdapter from '../../../adapters/file-storage-adapter'
import { registerSchema } from '../../../utils/openapi'
import { LEASE_EXPORT_STORAGE_PREFIX } from './constants'
import { leaseExportRegistry } from './registry'
import type { LeaseExportJob } from './registry'
import { runLeaseExport } from './run-lease-export'
import { LeaseExportSchema } from './schemas'
import type { LeaseExport } from './schemas'

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const URL_EXPIRY_SECONDS = 300

type StoredLeaseExport = {
  file: FileListItem
  userId: string
  exportId: string
  fileName: string
}

// Keys look like lease-exports/<userId>/<exportId>/<fileName>.
const parseStorageKey = (file: FileListItem): StoredLeaseExport | null => {
  const segments = file.name.split('/')
  if (
    segments.length !== 4 ||
    `${segments[0]}/` !== LEASE_EXPORT_STORAGE_PREFIX
  )
    return null
  const [, userId, exportId, fileName] = segments
  if (!userId || !exportId || !fileName) return null
  return { file, userId, exportId, fileName }
}

const fileExpiresAt = (file: FileListItem): Date =>
  new Date(new Date(file.lastModified).getTime() + RETENTION_MS)

const isExpired = (file: FileListItem, now: Date): boolean =>
  fileExpiresAt(file).getTime() < now.getTime()

const userPrefix = (userId: string) =>
  `${LEASE_EXPORT_STORAGE_PREFIX}${userId}/`

const toStatusFilter = (status: string | string[] | undefined): string[] =>
  status === undefined ? [] : Array.isArray(status) ? status : [status]

const fromJob = (job: LeaseExportJob): LeaseExport => ({
  id: job.id,
  status: job.status,
  phase: job.phase,
  statusFilter: toStatusFilter(job.filters.status),
  leaseCount: job.leaseCount,
  startedAt: job.startedAt.toISOString(),
  finishedAt: job.finishedAt?.toISOString() ?? null,
  fileName: null,
  sizeBytes: null,
  expiresAt: null,
  failureReason: job.failureReason,
})

const fromStoredFile = (
  stored: StoredLeaseExport,
  job: LeaseExportJob | undefined
): LeaseExport => ({
  id: stored.exportId,
  status: 'done',
  phase: null,
  statusFilter: job ? toStatusFilter(job.filters.status) : [],
  leaseCount: job?.leaseCount ?? null,
  startedAt: job?.startedAt.toISOString() ?? stored.file.lastModified,
  finishedAt: job?.finishedAt?.toISOString() ?? stored.file.lastModified,
  fileName: stored.fileName,
  sizeBytes: stored.file.size,
  expiresAt: fileExpiresAt(stored.file).toISOString(),
  failureReason: null,
})

/** Deletes stored exports of every user past retention. Never rejects. */
const deleteExpiredExports = async (): Promise<void> => {
  try {
    const result = await fileStorageAdapter.listFiles(
      LEASE_EXPORT_STORAGE_PREFIX
    )
    if (!result.ok) {
      logger.error(
        { err: result.err },
        'Listing lease exports to expire failed'
      )
      return
    }
    const now = new Date()
    const expired = result.data.filter((file) => isExpired(file, now))
    const deletions = await Promise.all(
      expired.map((file) => fileStorageAdapter.deleteFile(file.name))
    )
    deletions.forEach((deletion, i) => {
      if (!deletion.ok && deletion.err !== 'not_found') {
        logger.error(
          { err: deletion.err, key: expired[i].name },
          'Deleting expired lease export failed'
        )
      }
    })
  } catch (err: unknown) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      'Expiring lease exports failed'
    )
  }
}

const listOwnStoredExports = async (
  userId: string,
  exportId?: string
): Promise<
  { ok: true; data: StoredLeaseExport[] } | { ok: false; err: 'unknown' }
> => {
  const prefix = userPrefix(userId) + (exportId ? `${exportId}/` : '')
  const result = await fileStorageAdapter.listFiles(prefix)
  if (!result.ok) return result
  const now = new Date()
  return {
    ok: true,
    data: result.data
      .filter((file) => !isExpired(file, now))
      .map(parseStorageKey)
      .filter(
        (stored): stored is StoredLeaseExport =>
          stored !== null &&
          stored.userId === userId &&
          (exportId === undefined || stored.exportId === exportId)
      ),
  }
}

const requireUserId = (state: { user?: { id?: string } }): string => {
  // requireAuth runs before every route and guarantees ctx.state.user.id
  assert(
    state.user?.id,
    'requireAuth middleware must run before this route — ctx.state.user.id is not set'
  )
  return state.user.id
}

export const routes = (router: KoaRouter) => {
  registerSchema('LeaseExport', LeaseExportSchema)

  /**
   * @swagger
   * /lease-exports:
   *   post:
   *     summary: Start a lease export to Excel in the background
   *     tags:
   *       - Lease service
   *     description: Starts exporting the leases that match the filters to an Excel file in file storage. Uses the same filters as /leases/search but without pagination. Answers at once; poll GET /lease-exports for progress. One running export per user. Stored exports older than 7 days are deleted.
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Free-text search (contract ID, tenant name, PNR, contact code, address)
   *       - in: query
   *         name: name
   *         schema:
   *           type: string
   *         description: Search by tenant name
   *       - in: query
   *         name: address
   *         schema:
   *           type: string
   *         description: Search by rental object address
   *       - in: query
   *         name: objectType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Object types (e.g., residence, parking)
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Contract status filter (0=Current, 1=Upcoming, 2=AboutToEnd, 3=Ended)
   *       - in: query
   *         name: leaseType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Lease type filter
   *       - in: query
   *         name: parkingSpaceType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Parking space type filter
   *       - in: query
   *         name: startDateFrom
   *         schema:
   *           type: string
   *           format: date
   *         description: Minimum start date (YYYY-MM-DD)
   *       - in: query
   *         name: startDateTo
   *         schema:
   *           type: string
   *           format: date
   *         description: Maximum start date (YYYY-MM-DD)
   *       - in: query
   *         name: endDateFrom
   *         schema:
   *           type: string
   *           format: date
   *         description: Minimum end date (YYYY-MM-DD)
   *       - in: query
   *         name: endDateTo
   *         schema:
   *           type: string
   *           format: date
   *         description: Maximum end date (YYYY-MM-DD)
   *       - in: query
   *         name: property
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Property/estate names
   *       - in: query
   *         name: buildingCodes
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Building codes
   *       - in: query
   *         name: areaCodes
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Area codes (Område)
   *       - in: query
   *         name: districtNames
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: District names
   *       - in: query
   *         name: buildingManager
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Keycloak user IDs of property managers (kvartersvärdar) — core resolves these to KVV-area codes before filtering
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [leaseStartDate, lastDebitDate, leaseId, address, objectType, rentalObjectCode, tenantName]
   *         description: Sort field
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *         description: Sort direction
   *     responses:
   *       202:
   *         description: Export started
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/LeaseExport'
   *       409:
   *         description: The caller already has an export running
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   enum: [lease-export-already-running]
   *                 exportId:
   *                   type: string
   *                   description: Id of the export that is running
   *     security:
   *       - bearerAuth: []
   */
  router.post('/lease-exports', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const userId = requireUserId(ctx.state)

    const claim = leaseExportRegistry.claim(userId, ctx.query)
    if (!claim.ok) {
      ctx.status = 409
      ctx.body = {
        reason: 'lease-export-already-running',
        exportId: claim.runningId,
        ...metadata,
      }
      return
    }

    void runLeaseExport(claim.job, leaseExportRegistry)
    void deleteExpiredExports()

    ctx.status = 202
    ctx.body = makeSuccessResponseBody(fromJob(claim.job), metadata)
  })

  /**
   * @swagger
   * /lease-exports:
   *   get:
   *     summary: List the caller's lease exports
   *     tags:
   *       - Lease service
   *     description: Lists the caller's running, failed and finished lease exports, newest first. Finished exports come from file storage and are kept 7 days; older ones are deleted on this call.
   *     responses:
   *       200:
   *         description: The caller's lease exports
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/LeaseExport'
   *       500:
   *         description: Listing stored exports failed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   enum: [lease-export-storage-failed]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/lease-exports', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const userId = requireUserId(ctx.state)

    const [stored] = await Promise.all([
      listOwnStoredExports(userId),
      deleteExpiredExports(),
    ])
    if (!stored.ok) {
      ctx.status = 500
      ctx.body = { reason: 'lease-export-storage-failed', ...metadata }
      return
    }

    const jobs = leaseExportRegistry.listForUser(userId)
    const jobsById = new Map(jobs.map((job) => [job.id, job]))
    const exports = [
      ...jobs.filter((job) => job.status !== 'done').map(fromJob),
      ...stored.data.map((s) => fromStoredFile(s, jobsById.get(s.exportId))),
    ].sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(exports, metadata)
  })

  /**
   * @swagger
   * /lease-exports/{exportId}/url:
   *   get:
   *     summary: Get a download URL for one of the caller's finished lease exports
   *     tags:
   *       - Lease service
   *     description: Signs a download URL valid for 300 seconds. Only the caller's own finished exports can be signed.
   *     parameters:
   *       - in: path
   *         name: exportId
   *         required: true
   *         schema:
   *           type: string
   *         description: Id of the export
   *     responses:
   *       200:
   *         description: Signed download URL
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   required: [url, expiresAt]
   *                   properties:
   *                     url:
   *                       type: string
   *                     expiresAt:
   *                       type: string
   *                       format: date-time
   *       404:
   *         description: No finished export with that id for the caller
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   enum: [lease-export-not-found]
   *       500:
   *         description: File storage failed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   enum: [lease-export-storage-failed]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/lease-exports/:exportId/url', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const userId = requireUserId(ctx.state)
    const { exportId } = ctx.params

    const stored = await listOwnStoredExports(userId, exportId)
    if (!stored.ok) {
      ctx.status = 500
      ctx.body = { reason: 'lease-export-storage-failed', ...metadata }
      return
    }

    const [match] = stored.data
    if (!match) {
      ctx.status = 404
      ctx.body = { reason: 'lease-export-not-found', ...metadata }
      return
    }

    const signed = await fileStorageAdapter.getFileUrl(
      match.file.name,
      URL_EXPIRY_SECONDS
    )
    if (!signed.ok) {
      if (signed.err === 'not_found') {
        ctx.status = 404
        ctx.body = { reason: 'lease-export-not-found', ...metadata }
        return
      }
      ctx.status = 500
      ctx.body = { reason: 'lease-export-storage-failed', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(
      {
        url: signed.data.url,
        expiresAt: new Date(
          Date.now() + URL_EXPIRY_SECONDS * 1000
        ).toISOString(),
      },
      metadata
    )
  })
}
