import KoaRouter from '@koa/router'
import { Middleware } from 'koa'
import { generateRouteMetadata, logger } from '@onecore/utilities'

import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import { requireRole } from '../../middlewares/keycloak-auth'
import { parseRequestBody } from '../../middlewares/parse-request-body'
import { resolveUserById } from './keycloak-users'
import {
  PropertyKvvAreaLinkSchema,
  PropertyKvvAreaLookupSchema,
  type PutPropertyKvvAreaBody,
  PutPropertyKvvAreaBodySchema,
  ResolveKvvAreaQuerySchema,
} from './schemas'

// Same realm role guarded by GET /cost-centers/:id/tree (capabilities.canEdit).
// MIM-1788: members of the "Förvaltningsområden" Keycloak group have it.
const PROPERTY_AREA_WRITE_ROLE = 'property-areas:write'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Property KVV Area
 *     description: Property → KVV-area (förvaltningsområde) membership
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /properties/{propertyCode}/kvv-area:
   *   get:
   *     summary: Get the KVV-area (förvaltningsområde) and district of a property
   *     description: |
   *       Reverse lookup from a property code to the KVV-area it belongs to,
   *       the cost center (distrikt) of that area and the responsible
   *       kvartersvärd (hydrated from Keycloak; `null` if unset or if Keycloak
   *       is unreachable). Used by Odoo to stamp maintenance requests with
   *       their district. 404 when the property has no KVV-area link.
   *
   *       **Deprecated.** Answers the property default only and ignores
   *       building-level exceptions on split properties. Use
   *       `GET /kvv-areas/resolve` instead. Kept until Odoo has moved over.
   *     deprecated: true
   *     tags:
   *       - Property KVV Area
   *     parameters:
   *       - in: path
   *         name: propertyCode
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: KVV-area, cost center and responsible for the property
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/PropertyKvvAreaLookup'
   *       404:
   *         description: |
   *           Property has no KVV-area link. The body carries
   *           `code: PROPERTY_KVV_AREA_NOT_FOUND` so callers can tell this
   *           apart from a routing 404.
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  // Deprecated: property default only, blind to split-property exceptions.
  // Remove once Odoo calls GET /kvv-areas/resolve (its only caller).
  router.get('(.*)/properties/:propertyCode/kvv-area', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { propertyCode } = ctx.params

    const result =
      await propertyBaseAdapter.getKvvAreaByPropertyCode(propertyCode)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        // `code` lets callers distinguish this from a routing 404 — Odoo maps
        // it to "no district" rather than treating it as a failed request.
        ctx.body = {
          error: 'Property has no KVV-area',
          code: 'PROPERTY_KVV_AREA_NOT_FOUND',
          ...metadata,
        }
        return
      }
      logger.error(
        { err: result.err, metadata },
        'GET /properties/:propertyCode/kvv-area failed'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    // Resolved by id, not via the property-manager role list — see the note in
    // kvv-areas.ts: this is Odoo's per-errand path and must stay one cheap call.
    const { kvvArea, costCenter, responsibleKeycloakUserId } = result.data

    ctx.body = {
      content: PropertyKvvAreaLookupSchema.parse({
        kvvArea,
        costCenter,
        responsible: await resolveUserById(responsibleKeycloakUserId),
      }),
      ...metadata,
    }
  })

  /**
   * @swagger
   * /kvv-areas/resolve:
   *   get:
   *     summary: Resolve the KVV-area (förvaltningsområde) and district of a location
   *     description: |
   *       Location-level lookup for split properties: if the location's
   *       building carries a KVV-area exception, that area wins over the
   *       property's link. Give exactly one of `rentalId` (lägenhet, bilplats,
   *       lokal), `buildingCode` (facilities and building-level errands) or
   *       `propertyCode` (markyta objects and property-level errands). Send
   *       the most specific key you have; the keys are not combined since they
   *       may disagree. The responsible kvartersvärd is hydrated from Keycloak
   *       (`null` if unset or unreachable). This is the per-errand lookup Odoo
   *       should use; `GET /properties/{code}/kvv-area` answers the property
   *       default only.
   *     tags:
   *       - Property KVV Area
   *     parameters:
   *       - in: query
   *         name: rentalId
   *         schema:
   *           type: string
   *         description: Rental object id.
   *       - in: query
   *         name: buildingCode
   *         schema:
   *           type: string
   *         description: Building code.
   *       - in: query
   *         name: propertyCode
   *         schema:
   *           type: string
   *         description: Property code.
   *     responses:
   *       200:
   *         description: KVV-area, cost center and responsible for the location
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/PropertyKvvAreaLookup'
   *       400:
   *         description: Not exactly one of rentalId, buildingCode or propertyCode was given
   *       404:
   *         description: |
   *           Unknown location or no KVV-area resolves. The body carries
   *           `code: KVV_AREA_NOT_FOUND` so callers can tell this apart from
   *           a routing 404.
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/kvv-areas/resolve', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'rentalId',
      'propertyCode',
      'buildingCode',
    ])
    const parsed = ResolveKvvAreaQuerySchema.safeParse(ctx.query)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = {
        error:
          'Exactly one of rentalId, buildingCode or propertyCode is required',
        ...metadata,
      }
      return
    }

    const result = await propertyBaseAdapter.resolveKvvArea(parsed.data)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = {
          error: 'Location has no KVV-area',
          code: 'KVV_AREA_NOT_FOUND',
          ...metadata,
        }
        return
      }
      logger.error(
        { err: result.err, metadata },
        'GET /kvv-areas/resolve failed'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const { kvvArea, costCenter, responsibleKeycloakUserId } = result.data

    ctx.body = {
      content: PropertyKvvAreaLookupSchema.parse({
        kvvArea,
        costCenter,
        responsible: await resolveUserById(responsibleKeycloakUserId),
      }),
      ...metadata,
    }
  })

  /**
   * @swagger
   * /properties/{propertyCode}/kvv-area:
   *   put:
   *     summary: Set the KVV-area (förvaltningsområde) of a property
   *     description: |
   *       Sets the KVV-area a property belongs to. Cross-cost-center moves are
   *       allowed without validation. Requires the `property-areas:write` realm
   *       role (see MIM-1788).
   *     tags:
   *       - Property KVV Area
   *     parameters:
   *       - in: path
   *         name: propertyCode
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/PutPropertyKvvAreaBody'
   *     responses:
   *       200:
   *         description: Property → KVV-area link upserted
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/PropertyKvvAreaLink'
   *       400:
   *         description: Invalid request body
   *       403:
   *         description: Missing `property-areas:write` role
   *       404:
   *         description: Property or KVV-area not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.put(
    '(.*)/properties/:propertyCode/kvv-area',
    requireRole(PROPERTY_AREA_WRITE_ROLE),
    parseRequestBody(PutPropertyKvvAreaBodySchema) as Middleware,
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { propertyCode } = ctx.params
      const { kvvAreaId } = ctx.request.body as PutPropertyKvvAreaBody

      const updatedBy =
        ctx.state.user?.preferred_username ?? ctx.state.user?.email ?? null

      const result = await propertyBaseAdapter.updatePropertyKvvArea(
        propertyCode,
        { kvvAreaId, updatedBy }
      )

      if (!result.ok) {
        if (result.err === 'property-not-found') {
          ctx.status = 404
          ctx.body = { error: 'Property not found', ...metadata }
          return
        }
        if (result.err === 'kvv-area-not-found') {
          ctx.status = 404
          ctx.body = { error: 'KVV-area not found', ...metadata }
          return
        }
        logger.error(
          { err: result.err, metadata },
          'PUT /properties/:propertyCode/kvv-area failed'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: PropertyKvvAreaLinkSchema.parse(result.data),
        ...metadata,
      }
    }
  )
}
