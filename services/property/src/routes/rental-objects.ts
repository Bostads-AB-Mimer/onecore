import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import {
  resolveDetailsPropertyCodes,
  resolveSearchPropertyCodes,
} from '@src/adapters/property-grouping-adapter'
import {
  buildRentalObjectDetails,
  getRentalObjects,
  searchRentalObjects,
} from '@src/adapters/rental-object-adapter'
import { listRentalObjectSubtypes } from '@src/adapters/rental-object-subtype-adapter'
import {
  GetRentalObjectDetailsQueryParamsSchema,
  GetRentalObjectsQueryParamsSchema,
  SearchRentalObjectsQueryParamsSchema,
} from '@src/types/rental-object'

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

  /**
   * @swagger
   * /rental-objects/search:
   *   get:
   *     summary: Search rental objects across several scopes
   *     description: |
   *       Returns rental objects under ANY of the given scopes — cost centres,
   *       KVV-areas,
   *       marknadsområden, properties, buildings, trapphus or
   *       parkeringsområden — narrowed by object type, subtype and a free-text
   *       match on rental id, address or property name. At least one scope is
   *       required; a district-wide search is thousands of objects, so results
   *       are paginated.
   *
   *       Cost centres and marknadsområden are resolved to property codes
   *       first, since the structure table carries neither.
   *     tags:
   *       - Rental objects
   *     parameters:
   *       - { in: query, name: costCenterIds, schema: { type: array, items: { type: string, format: uuid } } }
   *       - { in: query, name: kvvAreaIds, schema: { type: array, items: { type: string, format: uuid } } }
   *       - { in: query, name: marketAreaCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: propertyCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: buildingCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: staircaseCodes, schema: { type: array, items: { type: string } }, description: 'Composite buildingCode-staircaseCode' }
   *       - { in: query, name: parkingAreaCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: rentalIds, schema: { type: array, items: { type: string } }, description: 'Individually picked objects, max 200' }
   *       - { in: query, name: types, schema: { type: array, items: { type: string, enum: [residence, parkingSpace, facility, other] } } }
   *       - { in: query, name: subtypes, schema: { type: array, items: { type: string } }, description: 'type:code pairs, e.g. residence:12' }
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
   */
  router.get(
    '(.*)/rental-objects/search',
    parseRequest({ query: SearchRentalObjectsQueryParamsSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const params = ctx.request.parsedQuery

      try {
        const propertyCodes = await resolveSearchPropertyCodes(params)
        const { rows, totalCount } = await searchRentalObjects(
          params,
          propertyCodes
        )
        ctx.status = 200
        ctx.body = { content: rows, totalCount, ...metadata }
      } catch (err) {
        logger.error({ err }, 'Error searching rental objects')
        ctx.status = 500
        ctx.body = { reason: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /rental-objects/details:
   *   get:
   *     summary: Listing-only values for the objects a selection covers
   *     description: |
   *       Grundhyra, BRA, "annan information av vikt" and anläggnings-ID keyed
   *       by rental id. Kept apart from the objects themselves so the tree, the
   *       picker and the sidebar — which never show these — neither fetch nor
   *       hold them. Cached on a shorter TTL than the structure, since rent
   *       changes more often.
   *
   *       Takes the same scopes as the search, but resolves all of them to
   *       property codes: the cache is keyed per property, so a trapphus costs
   *       its fastighet and nothing wider. Type and subtype filters are
   *       deliberately absent — the values are looked up by rental id, so
   *       narrowing them would only cost cache hits.
   *     tags:
   *       - Rental objects
   *     parameters:
   *       - { in: query, name: costCenterIds, schema: { type: array, items: { type: string, format: uuid } } }
   *       - { in: query, name: kvvAreaIds, schema: { type: array, items: { type: string, format: uuid } } }
   *       - { in: query, name: marketAreaCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: propertyCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: buildingCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: staircaseCodes, schema: { type: array, items: { type: string } }, description: 'Composite buildingCode-staircaseCode' }
   *       - { in: query, name: parkingAreaCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: rentalIds, schema: { type: array, items: { type: string } }, description: 'Individually picked objects, max 200' }
   *     responses:
   *       200:
   *         description: Details per rental id
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalObjectDetails'
   *       400:
   *         description: Invalid query parameters
   *       500:
   *         description: Internal server error
   */
  router.get(
    '(.*)/rental-objects/details',
    parseRequest({ query: GetRentalObjectDetailsQueryParamsSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const params = ctx.request.parsedQuery

      try {
        const propertyCodes = await resolveDetailsPropertyCodes(params)
        const content = await buildRentalObjectDetails(propertyCodes)
        ctx.status = 200
        ctx.body = { content, ...metadata }
      } catch (err) {
        logger.error({ err }, 'Error fetching rental object details')
        ctx.status = 500
        ctx.body = { reason: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /rental-object-subtypes:
   *   get:
   *     summary: List the subtype captions rental objects can carry
   *     description: |
   *       The Xpand type captions ("3 rum och kök", "Centralgarage", "3G
   *       Antenner") grouped by the object type they belong to. Only subtypes
   *       in use by operating-company stock are returned, so every option
   *       matches something. Codes are unique within a type, not across types.
   *     tags:
   *       - Rental objects
   *     responses:
   *       200:
   *         description: List of subtypes
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalObjectSubtype'
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/rental-object-subtypes', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const content = await listRentalObjectSubtypes()
      ctx.status = 200
      ctx.body = { content, ...metadata }
    } catch (err) {
      logger.error({ err }, 'Error fetching rental object subtypes')
      ctx.status = 500
      ctx.body = { reason: 'Internal server error', ...metadata }
    }
  })
}
