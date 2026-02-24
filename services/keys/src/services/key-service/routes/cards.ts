import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import * as cardsAdapter from '../adapters/cards-adapter'
import { db } from '../adapters/db'
import { registerSchema } from '../../../utils/openapi'

const { CardSchema, CardDetailsSchema } = keys

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

  /**
   * @swagger
   * /cards/{cardId}:
   *   get:
   *     summary: Get a card by ID
   *     description: Fetch a single access control card from DAX by its ID
   *     tags: [Cards]
   *     parameters:
   *       - in: path
   *         name: cardId
   *         required: true
   *         schema:
   *           type: string
   *         description: The card ID
   *     responses:
   *       200:
   *         description: Card found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Card'
   *       404:
   *         description: Card not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/cards/:cardId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const card = await cardsAdapter.getCardById(ctx.params.cardId)

      if (!card) {
        ctx.status = 404
        ctx.body = { error: 'Card not found', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: card, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching card by ID')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
