import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { Contact } from '@onecore/types'

import { getLeaseChanges } from '../adapters/xpand/cmlog-lease-adapter'
import { getLeases } from '../adapters/xpand/tenant-lease-adapter'
import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { z } from 'zod'

const SyncLeaseRequestSchema = z.object({
  leaseId: z.string(),
  contact: z.custom<Contact>().optional(),
  action: z.enum(['create', 'terminate', 'void']),
})

export const routes = (router: KoaRouter) => {
  router.get('(.*)/leases/sync', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['since'])

    try {
      const since = ctx.query.since
        ? new Date(ctx.query.since as string)
        : null

      if (since && isNaN(since.getTime())) {
        ctx.status = 400
        ctx.body = { error: 'Invalid since parameter, expected ISO 8601 date', ...metadata }
        return
      }

      const changes = await getLeaseChanges(since)

      ctx.status = 200
      ctx.body = { content: changes, ...metadata }
    } catch (error: unknown) {
      logger.error({ error, metadata }, 'Error fetching lease changes from cmlog')
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
      const { leaseId, contact, action } = ctx.request.body

      try {
        if (action === 'create') {
          if (!contact) {
            ctx.status = 400
            ctx.body = { error: 'contact is required for action "create"', ...metadata }
            return
          }
          const slashIndex = leaseId.lastIndexOf('/')
          const rentalObjectCode =
            slashIndex !== -1 ? leaseId.substring(0, slashIndex) : leaseId

          const createResult = await tenfastAdapter.createLease(
            contact,
            rentalObjectCode,
            new Date(),
            false
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
          ctx.status = 201
          ctx.body = {
            content: { action: 'created', leaseId },
            ...metadata,
          }
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

          const result = await tenfastAdapter.terminateLease(
            leaseId,
            new Date(endDate)
          )

          if (!result.ok) {
            if (result.err === 'lease-not-found') {
              ctx.status = 200
              ctx.body = {
                content: { action: 'skipped', leaseId },
                ...metadata,
              }
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
          ctx.status = 200
          ctx.body = { content: result.data, ...metadata }
          return
        }

        if (action === 'void') {
          const result = await tenfastAdapter.voidLease(leaseId)

          if (!result.ok) {
            if (result.err === 'lease-not-found') {
              ctx.status = 200
              ctx.body = {
                content: { action: 'skipped', leaseId },
                ...metadata,
              }
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
          ctx.body = { content: result.data, ...metadata }
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
