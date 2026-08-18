import KoaRouter from '@koa/router'
import { z } from 'zod'
import { generateRouteMetadata } from '@onecore/utilities'

import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import {
  RentalObjectSubtypeSchema,
  RentalObjectDetailsSchema,
  RentalObjectSummarySchema,
  RentalObjectTypeSchema,
} from './schemas'

const repeatable = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : [v]))
  .optional()

const GetRootRentalObjectsQuerySchema = z.object({
  groupBy: z.enum(['costCenter', 'marketArea', 'company']),
  rootId: z.string().min(1),
})

// Where to look for rental objects — alternatives, not a conjunction. Shared
// by the search and the details lookup so both read a selection the same way.
const RentalObjectScopeShape = {
  costCenterIds: repeatable,
  kvvAreaIds: repeatable,
  marketAreaCodes: repeatable,
  propertyCodes: repeatable,
  buildingCodes: repeatable,
  staircaseCodes: repeatable,
  parkingAreaCodes: repeatable,
  rentalIds: repeatable,
}

const SCOPE_KEYS = Object.keys(
  RentalObjectScopeShape
) as (keyof typeof RentalObjectScopeShape)[]

type RentalObjectScopes = Partial<Record<(typeof SCOPE_KEYS)[number], string[]>>

const hasAnyScope = (query: RentalObjectScopes): boolean =>
  SCOPE_KEYS.some((key) => (query[key]?.length ?? 0) > 0)

// Details take the same scopes as the search; the property service resolves
// them to property codes, so a trapphus costs one fastighet, not its district.
const GetRentalObjectDetailsQuerySchema = z
  .object(RentalObjectScopeShape)
  .refine(hasAnyScope, { message: 'Provide at least one scope.' })

const SearchRentalObjectsQuerySchema = z
  .object({
    ...RentalObjectScopeShape,
    types: z
      .union([RentalObjectTypeSchema, z.array(RentalObjectTypeSchema)])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .optional(),
    subtypes: repeatable,
    q: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
  })
  .refine(hasAnyScope, {
    message: 'Provide at least one scope to search within.',
  })

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
      content: RentalObjectSummarySchema.array().parse(result.data),
      ...metadata,
    }
  })
  /**
   * @swagger
   * /rental-objects/search:
   *   get:
   *     summary: Search rental objects across several scopes
   *     description: |
   *       Rental objects under ANY of the given scopes — cost centres,
   *       marknadsområden, properties, buildings, trapphus, parkeringsområden —
   *       narrowed by type, subtype and a free-text match on rental id, address
   *       or property name. At least one scope is required, and results are
   *       paginated since a district is thousands of objects.
   *     tags:
   *       - Rental objects
   *     parameters:
   *       - { in: query, name: costCenterIds, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: kvvAreaIds, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: marketAreaCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: propertyCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: buildingCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: staircaseCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: parkingAreaCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: rentalIds, schema: { type: array, items: { type: string } }, description: 'Individually picked objects, max 200' }
   *       - { in: query, name: types, schema: { type: array, items: { type: string, enum: [residence, parkingSpace, facility, other] } } }
   *       - { in: query, name: subtypes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: q, schema: { type: string } }
   *       - { in: query, name: page, schema: { type: integer } }
   *       - { in: query, name: limit, schema: { type: integer } }
   *     responses:
   *       200:
   *         description: Matching rental objects
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content, totalCount]
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalObjectSummary'
   *                 totalCount:
   *                   type: integer
   *       400:
   *         description: Invalid query parameters
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/rental-objects/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsed = SearchRentalObjectsQuerySchema.safeParse(ctx.query)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = { reason: 'Invalid query parameters', ...metadata }
      return
    }

    const result = await propertyBaseAdapter.searchRentalObjects(parsed.data)
    if (!result.ok) {
      // The missing-scope case is caught by the schema above, so an upstream
      // 400 is something this schema doesn't check — a malformed uuid, or
      // more rentalIds than the property service accepts.
      ctx.status = result.err === 'bad-request' ? 400 : 500
      ctx.body = {
        reason:
          result.err === 'bad-request'
            ? 'Invalid query parameters'
            : 'Internal server error',
        ...metadata,
      }
      return
    }

    ctx.body = {
      content: RentalObjectSummarySchema.array().parse(result.data.content),
      totalCount: result.data.totalCount,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /rental-objects/by-root:
   *   get:
   *     summary: Every rental object under one grouping root
   *     description: |
   *       All rental objects of a district, marknadsområde or company, taking
   *       the same (groupBy, rootId) pair as the property tree and served from
   *       the same cache. Meant for clients that filter, count and list these
   *       locally instead of asking the server per filter change.
   *     tags:
   *       - Rental objects
   *     parameters:
   *       - { in: query, name: groupBy, required: true, schema: { type: string, enum: [costCenter, marketArea, company] } }
   *       - { in: query, name: rootId, required: true, schema: { type: string } }
   *     responses:
   *       200:
   *         description: The root's rental objects
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
   *       404:
   *         description: Root not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/rental-objects/by-root', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsed = GetRootRentalObjectsQuerySchema.safeParse(ctx.query)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = {
        reason: 'Invalid query parameters',
        errors: parsed.error.errors,
        ...metadata,
      }
      return
    }

    const result = await propertyBaseAdapter.getRootRentalObjects(parsed.data)
    if (!result.ok) {
      ctx.status = result.err === 'not-found' ? 404 : 500
      ctx.body = {
        reason:
          result.err === 'not-found'
            ? 'Root not found'
            : 'Internal server error',
        ...metadata,
      }
      return
    }

    ctx.body = {
      content: RentalObjectSummarySchema.array().parse(result.data),
      ...metadata,
    }
  })

  /**
   * @swagger
   * /rental-objects/details:
   *   get:
   *     summary: Listing-only values for the objects a selection covers
   *     description: |
   *       Grundhyra, BRA, "annan information av vikt" and anläggnings-ID per
   *       rental id. Separate from the objects themselves so pages that don't
   *       show these never fetch them. Takes the same scopes as the search,
   *       minus the type and subtype filters: the values are looked up by
   *       rental id, so narrowing them would only cost cache hits.
   *     tags:
   *       - Rental objects
   *     parameters:
   *       - { in: query, name: costCenterIds, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: kvvAreaIds, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: marketAreaCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: propertyCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: buildingCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: staircaseCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: parkingAreaCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: rentalIds, schema: { type: array, items: { type: string } }, description: 'Individually picked objects, max 200' }
   *     responses:
   *       200:
   *         description: Details per rental id
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalObjectDetails'
   *       400:
   *         description: Invalid query parameters
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/rental-objects/details', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsed = GetRentalObjectDetailsQuerySchema.safeParse(ctx.query)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = {
        reason: 'Invalid query parameters',
        errors: parsed.error.errors,
        ...metadata,
      }
      return
    }

    const result = await propertyBaseAdapter.getRentalObjectDetails(parsed.data)
    if (!result.ok) {
      ctx.status = result.err === 'bad-request' ? 400 : 500
      ctx.body = {
        reason:
          result.err === 'bad-request'
            ? 'Invalid query parameters'
            : 'Internal server error',
        ...metadata,
      }
      return
    }

    ctx.body = {
      content: RentalObjectDetailsSchema.array().parse(result.data),
      ...metadata,
    }
  })

  /**
   * @swagger
   * /rental-object-subtypes:
   *   get:
   *     summary: List rental object subtype captions
   *     description: |
   *       Subtype captions grouped by object type, limited to those in use by
   *       operating-company stock. Codes are unique within a type only.
   *     tags:
   *       - Rental objects
   *     responses:
   *       200:
   *         description: List of subtypes
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalObjectSubtype'
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/rental-object-subtypes', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await propertyBaseAdapter.listRentalObjectSubtypes()
    if (!result.ok) {
      ctx.status = 500
      ctx.body = { reason: 'Internal server error', ...metadata }
      return
    }
    ctx.body = {
      content: RentalObjectSubtypeSchema.array().parse(result.data),
      ...metadata,
    }
  })
}
