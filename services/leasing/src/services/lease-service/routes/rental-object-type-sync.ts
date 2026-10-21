import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { SyncRentalObjectTypeRequestSchema } from '@onecore/types'

import { getRentalObjectTypeChanges } from '../adapters/xpand/cmlog-rental-object-adapter'
import { parseSinceQuery } from '../adapters/xpand/cmlog-rows'
import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import { TENFAST_RENTAL_OBJECT_CATEGORIES } from '../adapters/tenfast/rental-object-categories'
import { parseRequestBody } from '../../../middlewares/parse-request-body'

/**
 * @swagger
 * tags:
 *   - name: Rental object type sync
 *     description: Copies rental object type changes from Xpand to Tenfast
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /rental-objects/types/sync:
   *   get:
   *     summary: List rental object type changes
   *     description: >
   *       Returns the latest type change per rental object made after `since`,
   *       or every change when `since` is left out, oldest first. `until` is the
   *       time of the newest change log entry read, including entries that
   *       could not be parsed, so a caller can pass it as the next `since`.
   *     tags:
   *       - Rental object type sync
   *     parameters:
   *       - in: query
   *         name: since
   *         required: false
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Only changes after this time.
   *     responses:
   *       '200':
   *         description: The changes.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     changes:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           rentalObjectCode:
   *                             type: string
   *                           code:
   *                             type: string
   *                             nullable: true
   *                             description: The new type code; null when the type was cleared.
   *                           label:
   *                             type: string
   *                             nullable: true
   *                           timestamp:
   *                             type: string
   *                             format: date-time
   *                     until:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *       '400':
   *         description: since is not a date.
   *       '500':
   *         description: Reading the changes failed.
   */
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

  /**
   * @swagger
   * /rental-objects/{rentalObjectCode}/type/sync:
   *   post:
   *     summary: Set a rental object's type in Tenfast
   *     description: >
   *       Sets the rental object's category in Tenfast to the given type code.
   *       Does nothing when the rental object is not in Tenfast (`skipped`) or
   *       already has that category (`unchanged`).
   *     tags:
   *       - Rental object type sync
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [code]
   *             properties:
   *               code:
   *                 type: string
   *                 nullable: true
   *                 example: POÄNGFRITT
   *     responses:
   *       '200':
   *         description: The rental object was updated, unchanged or skipped.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     action:
   *                       type: string
   *                       enum: [updated, unchanged, skipped]
   *                     rentalObjectCode:
   *                       type: string
   *       '400':
   *         description: The body has no code.
   *       '422':
   *         description: >
   *           `unknown-rental-object-type` when Tenfast has no category for the
   *           code, `rental-object-rejected` when Tenfast refuses the update.
   *       '500':
   *         description: Reading or updating the rental object in Tenfast failed.
   */
  router.post(
    '(.*)/rental-objects/:rentalObjectCode/type/sync',
    parseRequestBody(SyncRentalObjectTypeRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { rentalObjectCode } = ctx.params
      const { code } = ctx.request.body

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

        const label =
          code === null ? undefined : TENFAST_RENTAL_OBJECT_CATEGORIES.get(code)
        if (code === null || label === undefined) {
          ctx.status = 422
          ctx.body = { error: 'unknown-rental-object-type', ...metadata }
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
