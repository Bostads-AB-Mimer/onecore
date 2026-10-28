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
  LeaseDocumentLookup,
} from '../adapters/xpand/lease-document-adapter'
import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { AdapterResult } from '../adapters/types'
import { z } from 'zod'

const SyncLeaseRequestSchema = z.object({
  leaseId: z.string(),
  contactCode: z.string().optional(),
  action: z.enum(['create', 'terminate', 'void']),
})

type DocumentKind = 'contract' | 'termination'

type DocumentResult<K extends DocumentKind> = AdapterResult<
  'attached' | 'already-attached' | 'missing',
  `${K}-pdf-${'check' | 'lookup' | 'upload'}-failed`
>

/**
 * Attaches a PDF from Xpand to a Tenfast lease, unless the lease has one.
 */
const attachDocument = async <K extends DocumentKind>(
  kind: K,
  leaseId: string,
  steps: {
    hasFile: () => Promise<AdapterResult<boolean, unknown>>
    fetchPdf: (leaseId: string) => Promise<LeaseDocumentLookup>
    upload: (
      content: Buffer,
      filename: string
    ) => Promise<AdapterResult<unknown, unknown>>
  }
): Promise<DocumentResult<K>> => {
  const hasFile = await steps.hasFile()
  if (!hasFile.ok) {
    logger.error(
      { leaseId, kind, error: hasFile.err },
      'Could not check whether the Tenfast lease has the document'
    )
    return { ok: false, err: `${kind}-pdf-check-failed` as const }
  }
  if (hasFile.data) {
    logger.info(
      { leaseId, kind },
      'Tenfast lease already has the document, skipping upload'
    )
    return { ok: true, data: 'already-attached' }
  }

  const pdf = await steps.fetchPdf(leaseId)
  if (!pdf.ok) return { ok: false, err: `${kind}-pdf-lookup-failed` as const }
  if (!pdf.data) {
    logger.warn({ leaseId, kind }, 'No document for the lease found in xpand')
    return { ok: true, data: 'missing' }
  }

  const upload = await steps.upload(pdf.data.content, pdf.data.filename)
  if (!upload.ok) {
    logger.error(
      { leaseId, kind, error: upload.err },
      'Document upload to Tenfast lease failed'
    )
    return { ok: false, err: `${kind}-pdf-upload-failed` as const }
  }
  logger.info(
    { leaseId, kind, filename: pdf.data.filename },
    'Attached document to Tenfast lease'
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

          const { _id: tenfastLeaseId, hasContractFile } = createResult.data
          const document = await attachDocument('contract', leaseId, {
            hasFile: async () => ({ ok: true, data: hasContractFile }),
            fetchPdf: getSignedContractPdf,
            upload: (content, filename) =>
              tenfastAdapter.uploadLeaseFile(tenfastLeaseId, content, filename),
          })
          ctx.status = 201
          ctx.body = makeSuccessResponseBody(
            document.ok
              ? { action: 'created', leaseId, document: document.data }
              : {
                  action: 'created',
                  leaseId,
                  document: 'failed',
                  documentError: document.err,
                },
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

          const {
            action: terminateAction,
            tenfastLeaseId,
            skipReason,
          } = result.data
          if (skipReason === 'not-required') {
            ctx.status = 200
            ctx.body = makeSuccessResponseBody(
              { action: terminateAction, leaseId },
              metadata
            )
            return
          }

          const document = await attachDocument('termination', leaseId, {
            hasFile: () => tenfastAdapter.hasTerminationFile(tenfastLeaseId),
            fetchPdf: getTerminationDocumentPdf,
            upload: (content, filename) =>
              tenfastAdapter.uploadTerminationFile(
                tenfastLeaseId,
                content,
                filename
              ),
          })
          if (!document.ok) {
            ctx.status = 500
            ctx.body = { error: document.err, ...metadata }
            return
          }

          ctx.status = 200
          ctx.body = makeSuccessResponseBody(
            { action: terminateAction, leaseId, document: document.data },
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
