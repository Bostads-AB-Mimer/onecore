import KoaRouter from '@koa/router'
import { logger } from '@onecore/utilities'
import * as daxService from '../dax-service'
import createHttpError from 'http-errors'

/**
 * @swagger
 * tags:
 *   - name: DAX API
 *     description: Endpoints for interacting with Amido DAX access control system
 */
export const routes = (router: KoaRouter) => {
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
      const contracts = await daxService.getAllContracts()

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
   *                   type: object
   *                   properties:
   *                     cardOwnerId:
   *                       type: string
   *                     firstname:
   *                       type: string
   *                     lastname:
   *                       type: string
   *                     email:
   *                       type: string
   *                     cards:
   *                       type: array
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

      const cardOwner = await daxService.getCardOwnerById(cardOwnerId)

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
   *     summary: Get all card owners from DAX
   *     description: Retrieve all card owners from the Amido DAX API
   *     tags: [DAX API]
   *     parameters:
   *       - in: query
   *         name: familyName
   *         schema:
   *           type: string
   *         description: Filter by family name (rental object ID / object code)
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
   */
  router.get('/dax/card-owners', async (ctx) => {
    try {
      const params = {
        familyName: ctx.query.familyName as string | undefined,
        offset: ctx.query.offset ? parseInt(ctx.query.offset as string) : undefined,
        limit: ctx.query.limit ? parseInt(ctx.query.limit as string) : undefined,
      }

      const cardOwners = await daxService.searchCardOwners(params)

      ctx.body = {
        cardOwners,
      }
      ctx.status = 200
    } catch (error) {
      logger.error({ error }, 'Failed to fetch DAX card owners')
      throw createHttpError(500, 'Failed to fetch card owners from DAX API')
    }
  })
}
