import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { Contact } from '@onecore/types'

import { xpandDb } from '../adapters/xpand/xpandDb'
import { getLeaseChanges } from '../adapters/xpand/cmlog-lease-adapter'
import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { z } from 'zod'

const SyncLeaseRequestSchema = z.object({
  leaseId: z.string(),
  contact: z.custom<Contact>(),
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

      const changes = await getLeaseChanges(xpandDb, since)

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

      try {
        const { leaseId, contact } = ctx.request.body

        const tenantResult =
          await tenfastAdapter.getOrCreateAndUpdateTenant(contact)

        if (!tenantResult.ok) {
          logger.error(
            { error: tenantResult.err, leaseId },
            'Failed to get or create tenant in Tenfast'
          )
          ctx.status = 500
          ctx.body = { error: tenantResult.err, ...metadata }
          return
        }

        const existingLease =
          await tenfastAdapter.getLeaseByExternalId(leaseId)

        if (existingLease.ok) {
          logger.info({ leaseId }, 'Lease already exists in Tenfast, skipping')
          ctx.status = 200
          ctx.body = { action: 'skipped', ...metadata }
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
        ctx.body = { action: 'created', content: createResult.data, ...metadata }
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
