import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { getLeaseChanges } from '../adapters/xpand/cmlog-lease-adapter'
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

export const routes = (router: KoaRouter) => {
  router.get('(.*)/leases/sync', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['since'])

    try {
      const since = ctx.query.since ? new Date(ctx.query.since as string) : null

      if (since && isNaN(since.getTime())) {
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

          // Best-effort attach the signed PDF from xpand. A missing PDF or
          // failed upload is logged but does not fail the create — the lease
          // already exists in Tenfast either way.
          const pdf = await getSignedContractPdf(leaseId)
          if (pdf) {
            const uploadResult = await tenfastAdapter.uploadLeaseFile(
              createResult.data._id,
              pdf.content,
              pdf.filename
            )
            if (uploadResult.ok) {
              logger.info(
                { leaseId, filename: pdf.filename },
                'Attached signed PDF to Tenfast lease'
              )
            } else {
              logger.warn(
                { leaseId, error: uploadResult.err },
                'Tenfast lease created but PDF upload failed'
              )
            }
          } else {
            logger.warn(
              { leaseId },
              'Tenfast lease created but no signed PDF found in xpand'
            )
          }

          ctx.status = 201
          ctx.body = makeSuccessResponseBody(
            { action: 'created', leaseId },
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

          // Best-effort attach the uppsägning PDF from xpand. Also runs when
          // terminate returns skipped (already terminated) so a failed prior
          // upload can be repaired on retry. A missing PDF or failed upload is
          // logged but does not fail the terminate.
          const tenfastLease =
            await tenfastAdapter.getLeaseByExternalId(leaseId)
          if (!tenfastLease.ok) {
            ctx.status = 200
            ctx.body = makeSuccessResponseBody(result.data, metadata)
            return
          }

          const tenfastLeaseId = tenfastLease.data._id
          const hasFile =
            await tenfastAdapter.hasTerminationFile(tenfastLeaseId)
          if (!hasFile.ok) {
            logger.warn(
              { leaseId, error: hasFile.err },
              'Could not check Tenfast termination file status, skipping upload'
            )
            ctx.status = 200
            ctx.body = makeSuccessResponseBody(result.data, metadata)
            return
          }
          if (hasFile.data) {
            logger.info(
              { leaseId },
              'Tenfast lease already has a termination file, skipping upload'
            )
            ctx.status = 200
            ctx.body = makeSuccessResponseBody(result.data, metadata)
            return
          }

          const pdf = await getTerminationDocumentPdf(leaseId)
          if (!pdf) {
            logger.warn(
              { leaseId },
              'Tenfast lease terminated but no uppsägning PDF found in xpand'
            )
            ctx.status = 200
            ctx.body = makeSuccessResponseBody(result.data, metadata)
            return
          }

          const uploadResult = await tenfastAdapter.uploadTerminationFile(
            tenfastLeaseId,
            pdf.content,
            pdf.filename
          )
          if (!uploadResult.ok) {
            logger.warn(
              { leaseId, error: uploadResult.err },
              'Tenfast lease terminated but uppsägning PDF upload failed'
            )
            ctx.status = 200
            ctx.body = makeSuccessResponseBody(result.data, metadata)
            return
          }

          logger.info(
            { leaseId, filename: pdf.filename },
            'Attached uppsägning PDF to Tenfast lease'
          )

          ctx.status = 200
          ctx.body = makeSuccessResponseBody(result.data, metadata)
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
