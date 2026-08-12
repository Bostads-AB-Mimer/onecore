import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import { getRentalObjects } from '@src/adapters/rental-object-adapter'
import { GetRentalObjectsQueryParamsSchema } from '@src/types/rental-object'

import { parseRequest } from '../middleware/parse-request'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Rental objects
 *     description: Flat rental-object structure rows (residences, parking spaces, facilities, other)
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /rental-objects:
   *   get:
   *     summary: List rental objects of a property or building
   *     description: |
   *       Returns every rental object (residence, parking space, facility,
   *       other) under one property or one building as flat structure rows
   *       with type, subtype caption, postal address and building/staircase
   *       placement. Provide exactly one of propertyCode or buildingCode.
   *     tags:
   *       - Rental objects
   *     parameters:
   *       - in: query
   *         name: propertyCode
   *         schema:
   *           type: string
   *       - in: query
   *         name: buildingCode
   *         schema:
   *           type: string
   *       - in: query
   *         name: exclude
   *         description: Object types to exclude (repeatable)
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: [residence, parkingSpace, facility, other]
   *     responses:
   *       200:
   *         description: List of rental objects
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalObjectSummary'
   *       400:
   *         description: Invalid query parameters
   *       500:
   *         description: Internal server error
   */
  router.get(
    '(.*)/rental-objects',
    parseRequest({ query: GetRentalObjectsQueryParamsSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { propertyCode, buildingCode, exclude } = ctx.request.parsedQuery

      try {
        const content = await getRentalObjects({
          propertyCode,
          buildingCode,
          exclude,
        })
        ctx.status = 200
        ctx.body = { content, ...metadata }
      } catch (err) {
        logger.error({ err }, 'Error fetching rental objects')
        ctx.status = 500
        ctx.body = { reason: 'Internal server error', ...metadata }
      }
    }
  )
}
