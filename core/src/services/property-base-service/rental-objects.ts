import KoaRouter from '@koa/router'
import { z } from 'zod'
import { generateRouteMetadata } from '@onecore/utilities'

import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import {
  parseQuery,
  parseUpstream,
  replyError,
} from '../../utils/route-helpers'
import {
  RentalObjectSubtypeSchema,
  RentalObjectDetailsSchema,
  RentalObjectSummarySchema,
  RentalObjectTypeSchema,
} from './schemas'

const repeatable = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : [v]).filter((s) => s.length > 0))
  .optional()

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
  // Same cap as upstream — fail fast here instead of spending a round trip.
  rentalIds: repeatable.pipe(z.array(z.string()).max(200).optional()),
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
    // Trim-or-drop, mirroring the property service: a cleared search box
    // sends q= and must not turn into an upstream 400.
    q: z
      .string()
      .optional()
      .transform((v) => v?.trim() || undefined),
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
    const query = parseQuery(ctx, GetRentalObjectsQuerySchema, metadata)
    if (!query) return

    const result = await propertyBaseAdapter.getRentalObjects(query)
    if (!result.ok) return replyError(ctx, result.err, metadata)

    const content = parseUpstream(
      ctx,
      RentalObjectSummarySchema.array(),
      result.data,
      metadata
    )
    if (!content) return
    ctx.body = { content, ...metadata }
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
    const query = parseQuery(ctx, SearchRentalObjectsQuerySchema, metadata)
    if (!query) return

    const result = await propertyBaseAdapter.searchRentalObjects(query)
    if (!result.ok) {
      // The missing-scope case is caught by the schema above, so an upstream
      // 400 is something this schema doesn't check — a malformed uuid, or
      // more rentalIds than the property service accepts.
      return replyError(ctx, result.err, metadata)
    }

    const content = parseUpstream(
      ctx,
      RentalObjectSummarySchema.array(),
      result.data.content,
      metadata
    )
    if (!content) return
    ctx.body = { content, totalCount: result.data.totalCount, ...metadata }
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
    const query = parseQuery(ctx, GetRentalObjectDetailsQuerySchema, metadata)
    if (!query) return

    const result = await propertyBaseAdapter.getRentalObjectDetails(query)
    if (!result.ok) return replyError(ctx, result.err, metadata)

    const content = parseUpstream(
      ctx,
      RentalObjectDetailsSchema.array(),
      result.data,
      metadata
    )
    if (!content) return
    ctx.body = { content, ...metadata }
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
    if (!result.ok) return replyError(ctx, result.err, metadata)

    const content = parseUpstream(
      ctx,
      RentalObjectSubtypeSchema.array(),
      result.data,
      metadata
    )
    if (!content) return
    ctx.body = { content, ...metadata }
  })
}
