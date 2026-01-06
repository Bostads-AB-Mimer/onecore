import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import * as cardsAdapter from '../adapters/cards-adapter'
import { db } from '../adapters/db'
import { registerSchema } from '../../../utils/openapi'

const { CardSchema, CardDetailsSchema } = keys.v1

// Register schemas for OpenAPI
registerSchema('Card', CardSchema)
registerSchema('CardDetails', CardDetailsSchema)

/**
 * @swagger
 * tags:
 *   name: Cards
 *   description: Access control card management (from DAX)
 */

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /cards/by-rental-object/{rentalObjectCode}:
   *   get:
   *     summary: Get cards by rental object code
   *     description: |
   *       Fetch all access control cards from DAX for a specific rental object.
   *       Cards can optionally be enriched with loan information.
   *     tags: [Cards]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code to fetch cards for
   *       - in: query
   *         name: includeLoans
   *         required: false
   *         schema:
   *           type: boolean
   *         description: Whether to include loan information for cards
   *     responses:
   *       200:
   *         description: An array of cards (with optional loan details)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CardDetails'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/cards/by-rental-object/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const includeLoans = ctx.query.includeLoans === 'true'
      const rows = await cardsAdapter.getCardsDetails(
        ctx.params.rentalObjectCode,
        db,
        { includeLoans }
      )

      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching cards by rental object code')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
