import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { leasing } from '@onecore/types'

import { mapLease } from './schemas/lease'

import * as leasingAdapter from '../../adapters/leasing-adapter'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /leases/by-rental-property-id/{rentalPropertyId}:
   *   get:
   *     summary: Get leases with related entities for a specific rental property id
   *     tags:
   *       - Lease service
   *     description: Retrieves lease information along with related entities (such as tenants, properties, etc.) for the specified rental property id.
   *     parameters:
   *       - in: path
   *         name: rentalPropertyId
   *         required: true
   *         schema:
   *           type: string
   *         description: Rental roperty id of the building/residence to fetch leases for.
   *       - in: query
   *         name: includeUpcomingLeases
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include upcoming leases in the response
   *       - in: query
   *         name: includeTerminatedLeases
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include terminated leases in the response
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include contact information in the response
   *     responses:
   *       '200':
   *         description: Successful response with leases and related entities
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Lease'
   *       '400':
   *         description: Invalid query parameters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *     security:
   *       - bearerAuth: []
   */

  // TODO(BREAKING): Changed the query param structure
  router.get('/leases/by-rental-property-id/:rentalPropertyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const queryParams = leasing.v1.GetLeasesOptionsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = {
        reason: 'Invalid query parameters',
        error: queryParams.error,
        ...metadata,
      }
      return
    }

    try {
      const leases = await leasingAdapter.getLeasesByRentalObjectCode(
        ctx.params.rentalPropertyId,
        queryParams.data
      )

      ctx.status = 200
      ctx.body = {
        content: leases.map(mapLease),
        ...metadata,
      }
    } catch (err) {
      logger.error({ err, metadata }, 'Error fetching leases from leasing')
      ctx.status = 500
    }
  })

  /**
   * @swagger
   * /leases/by-pnr/{pnr}:
   *   get:
   *     summary: Get leases with related entities for a specific Personal Number (PNR)
   *     tags:
   *       - Lease service
   *     description: Retrieves lease information along with related entities (such as tenants, properties, etc.) for the specified Personal Number (PNR).
   *     parameters:
   *       - in: path
   *         name: pnr
   *         required: true
   *         schema:
   *           type: string
   *         description: Personal Number (PNR) of the individual to fetch leases for.
   *     responses:
   *       '200':
   *         description: Successful response with leases and related entities
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/by-pnr/:pnr', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const queryParams = leasing.v1.GetLeasesOptionsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = {
        reason: 'Invalid query parameters',
        error: queryParams.error,
        ...metadata,
      }
      return
    }

    // TODO(BREAKING): includeContacts no longer defaults to true
    const responseData = await leasingAdapter.getLeasesForPnr(
      ctx.params.pnr,
      queryParams.data
    )

    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /leases/by-contact-code/{contactCode}:
   *   get:
   *     summary: Get leases with related entities for a specific contact code
   *     tags:
   *       - Lease service
   *     description: Retrieves lease information along with related entities (such as tenants, properties, etc.) for the specified contact code.
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: Contact code of the individual to fetch leases for.
   *     responses:
   *       '200':
   *         description: Successful response with leases and related entities
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/by-contact-code/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const queryParams = leasing.v1.GetLeasesOptionsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = {
        reason: 'Invalid query parameters',
        error: queryParams.error,
        ...metadata,
      }
      return
    }

    // TODO(BREAKING): includeContacts no longer defaults to true
    const responseData = await leasingAdapter.getLeasesByContactCode(
      ctx.params.contactCode,
      queryParams.data
    )

    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /leases/{id}:
   *   get:
   *     summary: Get lease by ID
   *     tags:
   *       - Lease service
   *     description: Retrieves lease details along with related entities based on the provided ID.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease to retrieve.
   *     responses:
   *       '200':
   *         description: Successful response with the requested lease and related entities
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const queryParams = leasing.v1.GetLeaseOptionsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = {
        reason: 'Invalid query parameters',
        error: queryParams.error,
        ...metadata,
      }
      return
    }

    // TODO(BREAKING): includeContacts no longer defaults to true
    const responseData = await leasingAdapter.getLease(
      ctx.params.id,
      queryParams.data
    )

    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })
}
