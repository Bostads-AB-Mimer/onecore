import KoaRouter from '@koa/router'
import { logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import * as daxAdapter from '../adapters/dax-adapter'
import createHttpError from 'http-errors'
import { registerSchema } from '../../../utils/openapi'

const { CardOwnerSchema, CardSchema } = keys.v1

/**
 * @swagger
 * tags:
 *   - name: DAX API
 *     description: Endpoints for interacting with Amido DAX access control system
 */
export const routes = (router: KoaRouter) => {
  registerSchema('CardOwner', CardOwnerSchema)
  registerSchema('Card', CardSchema)
  /**
   * @swagger
   * /dax/contracts:
   *   get:
   *     summary: Get all contracts from DAX
   *     description: Retrieve all contracts from the Amido DAX API
   *     tags: [DAX API]
   *     responses:
   *       200:
   *         description: List of contracts retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 contracts:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       contractId:
   *                         type: string
   *                       promisee:
   *                         type: object
   *                       promisor:
   *                         type: object
   *                       accessControlInstance:
   *                         type: object
   *                       state:
   *                         type: string
   *       500:
   *         description: Failed to fetch contracts
   */
  router.get('/dax/contracts', async (ctx) => {
    try {
      const contracts = await daxAdapter.getContracts()

      ctx.body = {
        contracts,
      }
      ctx.status = 200
    } catch (error) {
      logger.error({ error }, 'Failed to fetch DAX contracts')
      throw createHttpError(500, 'Failed to fetch contracts from DAX API')
    }
  })

  /**
   * @swagger
   * /dax/card-owners/{cardOwnerId}:
   *   get:
   *     summary: Get a specific card owner from DAX
   *     description: Retrieve a card owner by ID from the Amido DAX API
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
   *         name: partnerId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The owning partner ID (defaults to configured partner)
   *       - in: query
   *         name: instanceId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The owning instance ID (defaults to configured instance)
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
   *       400:
   *         description: Missing required parameters
   *       404:
   *         description: Card owner not found
   *       500:
   *         description: Failed to fetch card owner
   */
  router.get('/dax/card-owners/:cardOwnerId', async (ctx) => {
    try {
      const { cardOwnerId } = ctx.params
      const expand = ctx.query.expand as string | undefined

      const cardOwner = await daxAdapter.getCardOwnerById(cardOwnerId, expand)

      ctx.body = {
        cardOwner,
      }
      ctx.status = 200
    } catch (error: any) {
      logger.error(
        { error, cardOwnerId: ctx.params.cardOwnerId },
        'Failed to fetch DAX card owner'
      )

      if (error.statusCode) {
        throw error
      }

      throw createHttpError(500, 'Failed to fetch card owner from DAX API')
    }
  })

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
   *                     $ref: '#/components/schemas/CardOwner'
   *       500:
   *         description: Failed to fetch card owners
   */
  router.get('/dax/card-owners', async (ctx) => {
    try {
      const params = {
        nameFilter: ctx.query.nameFilter as string | undefined,
        offset: ctx.query.offset
          ? parseInt(ctx.query.offset as string)
          : undefined,
        limit: ctx.query.limit
          ? parseInt(ctx.query.limit as string)
          : undefined,
        expand: ctx.query.expand as string | undefined,
      }

      const cardOwners = await daxAdapter.searchCardOwners(params)

      ctx.body = {
        cardOwners,
      }
      ctx.status = 200
    } catch (error) {
      logger.error({ error }, 'Failed to fetch DAX card owners')
      throw createHttpError(500, 'Failed to fetch card owners from DAX API')
    }
  })

  /**
   * @swagger
   * /dax/cards/{cardId}:
   *   get:
   *     summary: Get a specific card from DAX
   *     description: Retrieve a card by ID from the Amido DAX API
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
   *       500:
   *         description: Failed to fetch card
   */
  router.get('/dax/cards/:cardId', async (ctx) => {
    try {
      const { cardId } = ctx.params
      const expand = ctx.query.expand as string | undefined

      const card = await daxAdapter.getCardById(cardId, expand)

      ctx.body = {
        card,
      }
      ctx.status = 200
    } catch (error: any) {
      logger.error(
        { error, cardId: ctx.params.cardId },
        'Failed to fetch DAX card'
      )

      if (error.statusCode) {
        throw error
      }

      throw createHttpError(500, 'Failed to fetch card from DAX API')
    }
  })
}
