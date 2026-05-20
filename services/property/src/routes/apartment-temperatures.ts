import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import { parseRequest } from '../middleware/parse-request'
import {
  ApartmentNodeNotFoundError,
  getApartmentTemperatures,
} from '../services/curves-service'
import { ApartmentTemperaturesQuerySchema } from '../types/curves'

/**
 * @swagger
 * openapi: 3.0.0
 * components:
 *   schemas:
 *     ApartmentTemperaturePoint:
 *       type: object
 *       properties:
 *         time:
 *           type: integer
 *           description: Unix timestamp (seconds) at the start of the aggregation bucket.
 *         avg:
 *           type: number
 *           nullable: true
 *           description: Average temperature for the bucket.
 *         min:
 *           type: number
 *           nullable: true
 *           description: Minimum temperature for the bucket.
 *         max:
 *           type: number
 *           nullable: true
 *           description: Maximum temperature for the bucket.
 *     ApartmentTemperatureSeries:
 *       type: object
 *       properties:
 *         subNodeId:
 *           type: integer
 *           description: EcoGuard sub-node id (one per physical sensor under the apartment node).
 *         subNodeName:
 *           type: string
 *           description: EcoGuard sub-node name.
 *         points:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ApartmentTemperaturePoint'
 *     ApartmentTemperaturesResponse:
 *       type: object
 *       properties:
 *         objectNumber:
 *           type: string
 *         nodeId:
 *           type: integer
 *           description: EcoGuard apartment node id.
 *         from:
 *           type: integer
 *           description: Unix timestamp (seconds) — inclusive start of the requested range.
 *         to:
 *           type: integer
 *           description: Unix timestamp (seconds) — inclusive end of the requested range.
 *         interval:
 *           type: string
 *           enum: [H, D]
 *           description: Aggregation bucket size (hourly or daily).
 *         unit:
 *           type: string
 *           description: Temperature unit reported by EcoGuard (e.g. "cel").
 *         series:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ApartmentTemperatureSeries'
 * tags:
 *   - name: Apartment Temperatures
 *     description: Indoor temperature data sourced from EcoGuard Curves.
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /apartments/{objectNumber}/temperatures:
   *   get:
   *     summary: Get indoor temperatures for an apartment
   *     description: |
   *       Fetches indoor temperature time series for an apartment by its
   *       object number, sourced from the EcoGuard "Curves" platform.
   *       Aggregates per-sensor (sub-node) data into avg/min/max points
   *       per time bucket. Defaults to the last 24 hours at hourly intervals.
   *     tags:
   *       - Apartment Temperatures
   *     parameters:
   *       - in: path
   *         name: objectNumber
   *         required: true
   *         schema:
   *           type: string
   *         description: Apartment object number (e.g. "806-032-01-0101").
   *       - in: query
   *         name: from
   *         required: false
   *         schema:
   *           type: integer
   *         description: Unix timestamp (seconds) for range start. Defaults to `to - 86400`.
   *       - in: query
   *         name: to
   *         required: false
   *         schema:
   *           type: integer
   *         description: Unix timestamp (seconds) for range end. Defaults to now.
   *       - in: query
   *         name: interval
   *         required: false
   *         schema:
   *           type: string
   *           enum: [H, D]
   *         description: Aggregation bucket size. Defaults to "H" (hourly).
   *     responses:
   *       200:
   *         description: Temperature series successfully retrieved.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ApartmentTemperaturesResponse'
   *       400:
   *         description: Invalid query parameters.
   *       404:
   *         description: No apartment node found for the given object number.
   *       500:
   *         description: Internal server error.
   */
  router.get(
    '(.*)/apartments/:objectNumber/temperatures',
    parseRequest({ query: ApartmentTemperaturesQuerySchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { objectNumber } = ctx.params

      try {
        const content = await getApartmentTemperatures(
          objectNumber,
          ctx.request.parsedQuery
        )

        ctx.status = 200
        ctx.body = { content, ...metadata }
      } catch (err) {
        logger.error({ err }, 'apartment-temperatures.get')

        if (err instanceof ApartmentNodeNotFoundError) {
          ctx.status = 404
          ctx.body = { error: 'apartment-node-not-found', ...metadata }
          return
        }

        ctx.status = 500
        ctx.body = { error: 'temperature-fetch-failed', ...metadata }
      }
    }
  )
}
