import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from 'onecore-utilities'
import { getRentalObject } from '../adapters/xpand-adapter'

/**
 * @swagger
 * tags:
 *   - name: Rental Objects
 *     description: Endpoints related to rental objects operations
 */

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /rental-object/by-code/{rentalObjectCode}:
   *   get:
   *     summary: Get a rental object
   *     description: Fetches a rental object by Rental Object Code.
   *     tags:
   *       - RentalObject
   *     responses:
   *       '200':
   *         description: Successfully retrieved the rental object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalObject'
   *       '500':
   *         description: Internal server error. Failed to fetch rental object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   */
  router.get('(.*)/rental-object/by-code/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const rentalObjectCode = ctx.params.rentalObjectCode

    const result = await getRentalObject(rentalObjectCode)
    console.log('result .*)/rental-object/by-code/:rentalObjectCode', result)

    if (!result.ok) {
      logger.error(result.err, 'Error fetching rental object:')
      ctx.status = 500
      ctx.body = {
        error: 'An error occurred while fetching rental object.',
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })
}
