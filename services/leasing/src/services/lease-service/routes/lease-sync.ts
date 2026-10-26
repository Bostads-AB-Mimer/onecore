import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { getLeaseChanges } from '../adapters/xpand/cmlog-lease-adapter'
import { parseSinceQuery } from '../adapters/xpand/cmlog-rows'
import { getLeases } from '../adapters/xpand/tenant-lease-adapter'
import {
  getSignedContractPdf,
  getTerminationDocumentPdf,
} from '../adapters/xpand/lease-document-adapter'
import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { z } from 'zod'

const SyncLeaseRequestSchema = z.object({
  leaseId: z.string(),
  contactCode: z.string().optional(),
  action: z.enum(['create', 'terminate', 'void']),
})

type DocumentOutcome = 'attached' | 'already-attached' | 'missing'
type DocumentFailure =
  | { ok: true; data: DocumentOutcome }
  | {
      ok: false
      err:
        | 'contract-pdf-check-failed'
        | 'contract-pdf-lookup-failed'
        | 'contract-pdf-upload-failed'
        | 'termination-pdf-check-failed'
        | 'termination-pdf-lookup-failed'
        | 'termination-pdf-upload-failed'
    }

/**
 * Attaches the signed contract from Xpand to a Tenfast lease, unless it has
 * one. A failure here fails the sync row so core retries it; the lease
 * import itself is safe to repeat.
 */
const attachSignedContract = async (
  leaseId: string,
  tenfastLeaseId: string
): Promise<DocumentFailure> => {
  const tenfastLease = await tenfastAdapter.getLeaseByExternalId(leaseId)
  if (!tenfastLease.ok) {
    logger.error(
      { leaseId, error: tenfastLease.err },
      'Lease created in Tenfast but could not check its contract file'
    )
    return { ok: false, err: 'contract-pdf-check-failed' }
  }
  if (tenfastLease.data.file) {
    logger.info(
      { leaseId },
      'Tenfast lease already has a contract file, skipping upload'
    )
    return { ok: true, data: 'already-attached' }
  }

  const pdf = await getSignedContractPdf(leaseId)
  if (!pdf.ok) return { ok: false, err: 'contract-pdf-lookup-failed' }
  if (!pdf.data) {
    logger.warn(
      { leaseId },
      'Tenfast lease created but no signed PDF found in xpand'
    )
    return { ok: true, data: 'missing' }
  }

  const upload = await tenfastAdapter.uploadLeaseFile(
    tenfastLeaseId,
    pdf.data.content,
    pdf.data.filename
  )
  if (!upload.ok) {
    logger.error(
      { leaseId, error: upload.err },
      'Tenfast lease created but PDF upload failed'
    )
    return { ok: false, err: 'contract-pdf-upload-failed' }
  }
  logger.info(
    { leaseId, filename: pdf.data.filename },
    'Attached signed PDF to Tenfast lease'
  )
  return { ok: true, data: 'attached' }
}

/**
 * Attaches the uppsägning document from Xpand to a terminated Tenfast lease,
 * unless it has one. A failure here fails the sync row so core retries it.
 */
const attachTerminationDocument = async (
  leaseId: string
): Promise<DocumentFailure> => {
  const tenfastLease = await tenfastAdapter.getLeaseByExternalId(leaseId)
  if (!tenfastLease.ok) {
    logger.error(
      { leaseId, error: tenfastLease.err },
      'Lease terminated in Tenfast but could not look it up for its termination file'
    )
    return { ok: false, err: 'termination-pdf-check-failed' }
  }
  const tenfastLeaseId = tenfastLease.data._id

  const hasFile = await tenfastAdapter.hasTerminationFile(tenfastLeaseId)
  if (!hasFile.ok) {
    logger.error(
      { leaseId, error: hasFile.err },
      'Could not check Tenfast termination file status'
    )
    return { ok: false, err: 'termination-pdf-check-failed' }
  }
  if (hasFile.data) {
    logger.info(
      { leaseId },
      'Tenfast lease already has a termination file, skipping upload'
    )
    return { ok: true, data: 'already-attached' }
  }

  const pdf = await getTerminationDocumentPdf(leaseId)
  if (!pdf.ok) return { ok: false, err: 'termination-pdf-lookup-failed' }
  if (!pdf.data) {
    logger.warn(
      { leaseId },
      'Tenfast lease terminated but no uppsägning PDF found in xpand'
    )
    return { ok: true, data: 'missing' }
  }

  const upload = await tenfastAdapter.uploadTerminationFile(
    tenfastLeaseId,
    pdf.data.content,
    pdf.data.filename
  )
  if (!upload.ok) {
    logger.error(
      { leaseId, error: upload.err },
      'Tenfast lease terminated but uppsägning PDF upload failed'
    )
    return { ok: false, err: 'termination-pdf-upload-failed' }
  }
  logger.info(
    { leaseId, filename: pdf.data.filename },
    'Attached uppsägning PDF to Tenfast lease'
  )
  return { ok: true, data: 'attached' }
}

export const routes = (router: KoaRouter) => {
  router.get('(.*)/leases/sync', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['since'])

    try {
      const since = parseSinceQuery(ctx.query.since)

      if (since === undefined) {
        ctx.status = 400
        ctx.body = {
          error: 'Invalid since parameter, expected ISO 8601 date',
          ...metadata,
        }
        return
      }

      const changes = await getLeaseChanges(since)

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(changes, metadata)
    } catch (error: unknown) {
      logger.error(
        { error, metadata },
        'Error fetching lease changes from cmlog'
      )
      ctx.status = 500
      ctx.body = {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred fetching lease changes',
        ...metadata,
      }
    }
  })

  router.post(
    '(.*)/leases/sync',
    parseRequestBody(SyncLeaseRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { leaseId, contactCode, action } = ctx.request.body

      try {
        if (action === 'create') {
          if (!contactCode) {
            ctx.status = 400
            ctx.body = {
              error: 'contactCode is required for action "create"',
              ...metadata,
            }
            return
          }
          const slashIndex = leaseId.lastIndexOf('/')
          const rentalObjectCode =
            slashIndex !== -1 ? leaseId.substring(0, slashIndex) : leaseId

          const xpandLeases = await getLeases([leaseId])
          if (!xpandLeases.length) {
            ctx.status = 404
            ctx.body = { error: 'Lease not found in xpand', ...metadata }
            return
          }

          const startDate = xpandLeases[0].leaseStartDate
          if (!startDate) {
            ctx.status = 400
            ctx.body = {
              error: 'xpand lease has no leaseStartDate',
              ...metadata,
            }
            return
          }

          const createResult = await tenfastAdapter.importLease(
            leaseId,
            contactCode,
            rentalObjectCode,
            new Date(startDate)
          )

          if (!createResult.ok) {
            logger.error(
              { error: createResult.err, leaseId },
              'Failed to create lease in Tenfast'
            )
            ctx.status = 500
            ctx.body = { error: createResult.err, ...metadata }
            return
          }

          logger.info({ leaseId }, 'Lease created in Tenfast')

          const document = await attachSignedContract(
            leaseId,
            createResult.data._id
          )
          if (!document.ok) {
            ctx.status = 500
            ctx.body = { error: document.err, ...metadata }
            return
          }

          ctx.status = 201
          ctx.body = makeSuccessResponseBody(
            { action: 'created', leaseId, document: document.data },
            metadata
          )
          return
        }

        if (action === 'terminate') {
          const xpandLeases = await getLeases([leaseId])
          if (!xpandLeases.length) {
            ctx.status = 404
            ctx.body = { error: 'Lease not found in xpand', ...metadata }
            return
          }

          const endDate = xpandLeases[0].lastDebitDate
          if (!endDate) {
            ctx.status = 400
            ctx.body = {
              error: 'xpand lease has no lastDebitDate',
              ...metadata,
            }
            return
          }

          logger.info({ leaseId, endDate }, 'terminating lease in Tenfast')

          const result = await tenfastAdapter.terminateLease(leaseId, {
            endDate: new Date(endDate),
            reason: 'Synced from xpand',
            notifyHg: false,
            supplementaryAgreements: false,
            handled: true,
          })

          if (!result.ok) {
            if (result.err === 'lease-not-found') {
              ctx.status = 200
              ctx.body = makeSuccessResponseBody(
                { action: 'skipped', leaseId },
                metadata
              )
              return
            }
            logger.error(
              { action, error: result.err, leaseId },
              'Failed to terminate lease in Tenfast'
            )
            ctx.status = 500
            ctx.body = { error: result.err, ...metadata }
            return
          }

          logger.info({ leaseId }, 'Lease terminated in Tenfast')

          // Also runs when terminate returns skipped (already terminated), so
          // a failed earlier upload is repaired on retry.
          const document = await attachTerminationDocument(leaseId)
          if (!document.ok) {
            ctx.status = 500
            ctx.body = { error: document.err, ...metadata }
            return
          }

          ctx.status = 200
          ctx.body = makeSuccessResponseBody(
            { ...result.data, document: document.data },
            metadata
          )
          return
        }

        if (action === 'void') {
          const result = await tenfastAdapter.voidLease(leaseId)

          if (!result.ok) {
            if (result.err === 'lease-not-found') {
              ctx.status = 200
              ctx.body = makeSuccessResponseBody(
                { action: 'skipped', leaseId },
                metadata
              )
              return
            }
            logger.error(
              { action, error: result.err, leaseId },
              'Failed to void lease in Tenfast'
            )
            ctx.status = 500
            ctx.body = { error: result.err, ...metadata }
            return
          }

          logger.info({ leaseId }, 'Lease voided in Tenfast')
          ctx.status = 200
          ctx.body = makeSuccessResponseBody(result.data, metadata)
          return
        }
      } catch (error: unknown) {
        logger.error({ error, metadata }, 'Error syncing lease to Tenfast')
        ctx.status = 500
        ctx.body = {
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error occurred syncing lease',
          ...metadata,
        }
      }
    }
  )
}
