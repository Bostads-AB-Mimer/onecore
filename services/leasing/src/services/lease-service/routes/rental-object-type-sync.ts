import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { z } from 'zod'

import { getRentalObjectTypeChanges } from '../adapters/xpand/cmlog-rental-object-adapter'
import { parseSinceQuery } from '../adapters/xpand/cmlog-rows'
import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import { TENFAST_RENTAL_OBJECT_CATEGORIES } from '../adapters/tenfast/rental-object-categories'
import { parseRequestBody } from '../../../middlewares/parse-request-body'

const SyncRentalObjectTypeRequestSchema = z.object({
  code: z.string().nullable(),
})

export const routes = (router: KoaRouter) => {
  router.get('(.*)/rental-objects/types/sync', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['since'])
    const since = parseSinceQuery(ctx.query.since)

    if (since === undefined) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid since parameter, expected ISO 8601 date',
        ...metadata,
      }
      return
    }

    try {
      const result = await getRentalObjectTypeChanges(since)
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result, metadata)
    } catch (error: unknown) {
      logger.error(
        { err: error, metadata },
        'Error fetching rental object type changes'
      )
      ctx.status = 500
      ctx.body = {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred fetching rental object type changes',
        ...metadata,
      }
    }
  })

  router.post(
    '(.*)/rental-objects/:rentalObjectCode/type/sync',
    parseRequestBody(SyncRentalObjectTypeRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { rentalObjectCode } = ctx.params
      const { code } = ctx.request.body
      const label =
        code === null ? undefined : TENFAST_RENTAL_OBJECT_CATEGORIES.get(code)

      if (code === null || label === undefined) {
        ctx.status = 422
        ctx.body = { error: 'unknown-rental-object-type', ...metadata }
        return
      }

      try {
        const rentalObject =
          await tenfastAdapter.getRentalObject(rentalObjectCode)

        if (!rentalObject.ok) {
          logger.error(
            { rentalObjectCode, error: rentalObject.err },
            'Failed to fetch rental object from Tenfast'
          )
          ctx.status = 500
          ctx.body = { error: rentalObject.err, ...metadata }
          return
        }

        if (rentalObject.data === null) {
          ctx.status = 200
          ctx.body = makeSuccessResponseBody(
            { action: 'skipped', rentalObjectCode },
            metadata
          )
          return
        }

        if (rentalObject.data.category.code === code) {
          ctx.status = 200
          ctx.body = makeSuccessResponseBody(
            { action: 'unchanged', rentalObjectCode },
            metadata
          )
          return
        }

        const updated = await tenfastAdapter.updateRentalObjectCategory(
          rentalObject.data._id,
          { code, label }
        )

        if (!updated.ok && updated.err === 'update-rejected') {
          ctx.status = 422
          ctx.body = { error: 'rental-object-rejected', ...metadata }
          return
        }

        if (!updated.ok) {
          ctx.status = 500
          ctx.body = { error: updated.err, ...metadata }
          return
        }

        logger.info(
          { rentalObjectCode, code },
          'Rental object category updated in Tenfast'
        )
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(
          { action: 'updated', rentalObjectCode },
          metadata
        )
      } catch (error: unknown) {
        logger.error(
          { err: error, metadata },
          'Error syncing rental object type to Tenfast'
        )
        ctx.status = 500
        ctx.body = {
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error occurred syncing rental object type',
          ...metadata,
        }
      }
    }
  )
}
