import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { DaxApi } from '../../adapters/keys-adapter'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /dax/card-owners:
   *   get:
   *     summary: Search card owners from DAX
   *     description: Search for card owners in the DAX access control system
   *     tags: [DAX API]
   *     parameters:
   *       - in: query
   *         name: nameFilter
   *         schema:
   *           type: string
   *         description: Filter by name (rental object ID / object code)
   *       - in: query
   *         name: expand
   *         schema:
   *           type: string
   *         description: Comma-separated list of fields to expand (e.g., "cards")
   *       - in: query
   *         name: idfilter
   *         schema:
   *           type: string
   *         description: Filter by ID
   *       - in: query
   *         name: attributeFilter
   *         schema:
   *           type: string
   *         description: Filter by attribute
   *       - in: query
   *         name: selectedAttributes
   *         schema:
   *           type: string
   *         description: Select specific attributes to return
   *       - in: query
   *         name: folderFilter
   *         schema:
   *           type: string
   *         description: Filter by folder
   *       - in: query
   *         name: organisationFilter
   *         schema:
   *           type: string
   *         description: Filter by organisation
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *         description: Pagination offset
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Maximum number of results
   *     responses:
   *       200:
   *         description: Card owners retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 cardOwners:
   *                   type: array
   *                   items:
   *                     type: object
   *       500:
   *         description: Failed to fetch card owners
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/dax/card-owners', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await DaxApi.searchCardOwners(ctx.query)

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error searching card owners')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { cardOwners: result.data, ...metadata }
  })

  /**
   * @swagger
   * /dax/card-owners/{cardOwnerId}:
   *   get:
   *     summary: Get a specific card owner from DAX
   *     description: Retrieve a card owner by ID from the DAX access control system
   *     tags: [DAX API]
   *     parameters:
   *       - in: path
   *         name: cardOwnerId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The card owner ID
   *       - in: query
   *         name: expand
   *         schema:
   *           type: string
   *         description: Comma-separated list of fields to expand (e.g., "cards")
   *     responses:
   *       200:
   *         description: Card owner retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 cardOwner:
   *                   $ref: '#/components/schemas/CardOwner'
   *       404:
   *         description: Card owner not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Failed to fetch card owner
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/dax/card-owners/:cardOwnerId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { cardOwnerId } = ctx.params

    const result = await DaxApi.getCardOwner(cardOwnerId, ctx.query)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata, cardOwnerId },
        'Error fetching card owner'
      )
      ctx.status = result.err === 'not-found' ? 404 : 500
      ctx.body = {
        error:
          result.err === 'not-found'
            ? 'Card owner not found'
            : 'Internal server error',
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = { cardOwner: result.data, ...metadata }
  })

  /**
   * @swagger
   * /dax/cards/{cardId}:
   *   get:
   *     summary: Get a specific card from DAX
   *     description: Retrieve a card by ID from the DAX access control system
   *     tags: [DAX API]
   *     parameters:
   *       - in: path
   *         name: cardId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The card ID
   *       - in: query
   *         name: expand
   *         schema:
   *           type: string
   *         description: Comma-separated list of fields to expand (e.g., "codes")
   *     responses:
   *       200:
   *         description: Card retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 card:
   *                   $ref: '#/components/schemas/Card'
   *       404:
   *         description: Card not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Failed to fetch card
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/dax/cards/:cardId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { cardId } = ctx.params

    const result = await DaxApi.getCard(cardId, ctx.query)

    if (!result.ok) {
      logger.error({ err: result.err, metadata, cardId }, 'Error fetching card')
      ctx.status = result.err === 'not-found' ? 404 : 500
      ctx.body = {
        error:
          result.err === 'not-found'
            ? 'Card not found'
            : 'Internal server error',
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = { card: result.data, ...metadata }
  })
}
