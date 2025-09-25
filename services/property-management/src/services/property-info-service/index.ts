/**
 * Self-contained service, ready to be extracted into a micro service if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'

import { getRentalProperty } from './adapters/contech-os-adapter'

import { logger, generateRouteMetadata } from '@onecore/utilities'
import {
  getRentalPropertyInfo,
  getMaintenanceUnits,
  getApartmentRentalPropertyInfo,
} from './adapters/xpand-adapter'

import { routes as materialChoiceRoutes } from './routes/materialChoices'
/**
 * The routes of this service are exported as the routes object. The service can also have
 * other exports (named or default) to provide externally usable helper functions, types etc.
 */

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Property management
 *     description: Operations related to property management
 */
export const routes = (router: KoaRouter) => {
  materialChoiceRoutes(router)

  /**
   * @swagger
   * /rentalproperties/{id}:
   *   get:
   *     summary: Get rental property details by ID
   *     tags:
   *       -  Property management
   *     description: Retrieve the details of a rental property identified by {id}.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to fetch details for.
   *     responses:
   *       '200':
   *         description: Successfully retrieved rental property details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */

  router.get('(.*)/rentalproperties/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const responseData = await getRentalProperty(ctx.params.id)

    ctx.body = { content: responseData, ...metadata }
  })

  /**
   * @swagger
   * /rentalPropertyInfo/{id}:
   *   get:
   *     summary: Get rental property information by ID
   *     tags:
   *       - Property management
   *     description: Retrieve detailed information about a rental property identified by {id}.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to fetch information for.
   *     responses:
   *       '200':
   *         description: Successful response with the requested rental property information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */

  router.get('(.*)/rentalPropertyInfo/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const responseData = await getRentalPropertyInfo(ctx.params.id)
      if (!responseData) {
        ctx.status = 404
        ctx.body = {
          reason:
            'No rental property info found for property with id: ' +
            ctx.params.id,
          ...metadata,
        }
        return
      }
      ctx.status = 200
      ctx.body = { content: responseData, ...metadata }
    } catch (error) {
      logger.error(error, 'Error fetching rental property info')
      ctx.status = 500 // Internal Server Error
      ctx.body = {
        error:
          'An error occurred while fetching the rental property info for property with id: ' +
          ctx.params.id,
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /rentalPropertyInfo/apartment/{rentalObjectCode}:
   *   get:
   *     summary: Get apartment rental property information by rental object code
   *     tags:
   *       - Property management
   *     description: Retrieve detailed information about a rental property identified by {rentalObjectCode}.
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: rentalObjectCode of the rental property to fetch information for.
   *     responses:
   *       '200':
   *         description: Successful response with the requested rental property information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       '404':
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */
  router.get(
    '(.*)/rentalPropertyInfo/apartment/:rentalObjectCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const result = await getApartmentRentalPropertyInfo(
        ctx.params.rentalObjectCode
      )

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = {
            reason: `No rental property info found for property with rental object code: ${ctx.params.rentalObjectCode}`,
            ...metadata,
          }

          return
        } else {
          ctx.status = 500
          ctx.body = {
            error: `An error occurred while fetching the rental property info for property with rentalObjectCode: ${ctx.params.rentalObjectCode}`,
            ...metadata,
          }
          return
        }
      }

      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    }
  )

  /**
   * @swagger
   * /maintenanceUnits/{id}:
   *   get:
   *     summary: Get maintenance units by ID
   *     tags:
   *       - Property management
   *     description: Retrieve maintenance units associated with a specific ID.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the maintenance unit to fetch.
   *     responses:
   *       '200':
   *         description: Successful response with the requested maintenance units
   *         content:
   *          application/json:
   *             schema:
   *               type: object
   */

  router.get('(.*)/maintenanceUnits/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const responseData = await getMaintenanceUnits(ctx.params.id)
      if (!responseData) {
        ctx.status = 404
        ctx.body = {
          reason: 'No maintenance unit found with the given id',
          ...metadata,
        }
      } else {
        ctx.status = 200
        ctx.body = { content: responseData, ...metadata }
      }
    } catch (error) {
      logger.error(error, 'Error fetching maintenance unit by id:')
      ctx.status = 500 // Internal Server Error
      ctx.body = {
        error: 'An error occurred while fetching the maintenance unit.',
        ...metadata,
      }
    }
  })
}
