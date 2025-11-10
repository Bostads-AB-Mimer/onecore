import KoaRouter from '@koa/router'
import { logger } from '@onecore/utilities'
import * as daxService from '../dax-service'
import Config from '../../../common/config'
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

      // Use query params or fall back to config defaults
      const partnerId =
        (ctx.query.partnerId as string) || Config.alliera.partnerId
      const instanceId =
        (ctx.query.instanceId as string) || Config.alliera.owningInstanceId

      if (!partnerId || !instanceId) {
        throw createHttpError(
          400,
          'partnerId and instanceId are required (either as query params or in configuration)'
        )
      }

      const cardOwner = await daxService.getCardOwnerById(
        partnerId,
        instanceId,
        cardOwnerId
      )

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
   * /dax/card-owners/search:
   *   post:
   *     summary: Search for card owners in DAX
   *     description: Query card owners from the Amido DAX API by various criteria
   *     tags: [DAX API]
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               firstname:
   *                 type: string
   *                 description: Filter by first name
   *               lastname:
   *                 type: string
   *                 description: Filter by last name
   *               email:
   *                 type: string
   *                 description: Filter by email
   *               personnummer:
   *                 type: string
   *                 description: Filter by personnummer (Swedish personal number)
   *               offset:
   *                 type: integer
   *                 description: Pagination offset
   *                 default: 0
   *               limit:
   *                 type: integer
   *                 description: Maximum number of results
   *                 default: 50
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
   *         description: Failed to search card owners
   */
  router.post('/dax/card-owners/search', async (ctx) => {
    try {
      const params = ctx.request.body || {}

      const cardOwners = await daxService.searchCardOwners(params)

      ctx.body = {
        cardOwners,
      }
      ctx.status = 200
    } catch (error) {
      logger.error({ error }, 'Failed to search DAX card owners')
      throw createHttpError(500, 'Failed to search card owners from DAX API')
    }
  })
}
