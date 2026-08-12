import KoaRouter from '@koa/router'
import { z } from 'zod'
import { generateRouteMetadata } from '@onecore/utilities'

import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import {
  RentalObjectSummarySchema,
  RentalObjectTypeSchema,
} from './schemas'

const GetRentalObjectsQuerySchema = z
  .object({
    propertyCode: z.string().min(1).optional(),
    buildingCode: z.string().min(1).optional(),
    exclude: z
      .union([RentalObjectTypeSchema, z.array(RentalObjectTypeSchema)])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .optional(),
  })
  .refine((q) => !!q.propertyCode !== !!q.buildingCode, {
    message: 'Provide exactly one of propertyCode or buildingCode.',
  })

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
   *       - { in: query, name: propertyCode, schema: { type: string } }
   *       - { in: query, name: buildingCode, schema: { type: string } }
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
   *               required: [content]
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalObjectSummary'
   *       400:
   *         description: Invalid query parameters
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/rental-objects', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsed = GetRentalObjectsQuerySchema.safeParse(ctx.query)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = {
        reason: 'Invalid query parameters',
        errors: parsed.error.errors,
        ...metadata,
      }
      return
    }

    const result = await propertyBaseAdapter.getRentalObjects(parsed.data)
    if (!result.ok) {
      ctx.status = 500
      ctx.body = { reason: 'Internal server error', ...metadata }
      return
    }

    ctx.body = {
      content: result.data.map((r) => RentalObjectSummarySchema.parse(r)),
      ...metadata,
    }
  })
}
