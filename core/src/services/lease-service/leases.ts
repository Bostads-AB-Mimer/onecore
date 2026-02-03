import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { leasing } from '@onecore/types'

import { mapLease } from './schemas/lease'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import { getHomeInsuranceOfferMonthlyAmount } from './helpers/lease'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /leases/search:
   *   get:
   *     summary: Search and filter leases
   *     tags:
   *       - Lease service
   *     description: Search leases with comprehensive filtering options including text search, object type, status, date ranges, and property hierarchy filters.
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Free-text search (contract ID, tenant name, PNR, contact code, address)
   *       - in: query
   *         name: objectType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Object types (e.g., residence, parking))
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: ['0', '1', '2', '3']
   *         description: Contract status filter (0=Current, 1=Upcoming, 2=AboutToEnd, 3=Ended)
   *       - in: query
   *         name: startDateFrom
   *         schema:
   *           type: string
   *           format: date
   *         description: Minimum start date (YYYY-MM-DD)
   *       - in: query
   *         name: startDateTo
   *         schema:
   *           type: string
   *           format: date
   *         description: Maximum start date (YYYY-MM-DD)
   *       - in: query
   *         name: endDateFrom
   *         schema:
   *           type: string
   *           format: date
   *         description: Minimum end date (YYYY-MM-DD)
   *       - in: query
   *         name: endDateTo
   *         schema:
   *           type: string
   *           format: date
   *         description: Maximum end date (YYYY-MM-DD)
   *       - in: query
   *         name: property
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Property/estate names
   *       - in: query
   *         name: buildingCodes
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Building codes
   *       - in: query
   *         name: areaCodes
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Area codes (Område)
   *       - in: query
   *         name: districtNames
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: District names
   *       - in: query
   *         name: buildingManager
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Building manager names (Kvartersvärd)
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           maximum: 100
   *         description: Items per page
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [leaseStartDate, lastDebitDate, leaseId]
   *         description: Sort field
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *         description: Sort direction
   *     responses:
   *       '200':
   *         description: Successfully retrieved lease search results with pagination
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/LeaseSearchResult'
   *                 _meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *                 _links:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/PaginationLinks'
   *       '400':
   *         description: Invalid query parameters
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  // TODO: Move move to new microservice governingn organization. for now here just to make it available for the filter in /leases
  /**
   * @swagger
   * /leases/building-managers:
   *   get:
   *     summary: Get all building managers
   *     tags: [Leases]
   *     description: Returns a list of all building managers (Kvartersvärd) with their code, name and district.
   *     responses:
   *       '200':
   *         description: List of building managers
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       code:
   *                         type: string
   *                       name:
   *                         type: string
   *                       district:
   *                         type: string
   *       '500':
   *         description: Internal server error
   */
  router.get('/leases/building-managers', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const result = await leasingAdapter.getBuildingManagers()
      ctx.status = 200
      ctx.body = { content: result, ...metadata }
    } catch (error: unknown) {
      logger.error({ error, metadata }, 'Error fetching building managers')
      ctx.status = 500
      ctx.body = {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred fetching building managers',
        ...metadata,
      }
    }
  })

  router.get('/leases/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const result = await leasingAdapter.searchLeases(ctx.query)

      ctx.status = 200
      ctx.body = result
    } catch (error: unknown) {
      logger.error({ error, metadata }, 'Error searching leases')
      ctx.status = 500
      ctx.body = {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred during lease search',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /leases/by-rental-object-code/{rentalObjectCode}:
   *   get:
   *     summary: Get leases with related entities for a specific rental object code.
   *     tags:
   *       - Lease service
   *     description: Retrieves lease information along with related entities (such as tenants) for the specified rental object code.
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: Rental roperty id of the building/residence to fetch leases for.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *         required: false
   *         description: Whether to include related contacts in the response.
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         required: false
   *         description: >-
   *           Comma-separated list of statuses to include leases by.
   *           Valid values are "current", "upcoming", "about-to-end", and "ended".
   *           Default is all statuses.
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
  // TODO(BREAKING): Changed the path by-rental-property-id => by-rental-object-code
  router.get('/leases/by-rental-object-code/:rentalObjectCode', async (ctx) => {
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
        ctx.params.rentalObjectCode,
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
   *     description: Retrieves lease information along with related entities (such as tenants) for the specified Personal Number (PNR).
   *     parameters:
   *       - in: path
   *         name: pnr
   *         required: true
   *         schema:
   *           type: string
   *         description: Personal Number (PNR) of the individual to fetch leases for.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *         required: false
   *         description: Whether to include related contacts in the response.
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         required: false
   *         description: >-
   *           Comma-separated list of statuses to include leases by.
   *           Valid values are "current", "upcoming", "about-to-end", and "ended".
   *           Default is all statuses.
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
   *     security:
   *       - bearerAuth: []
   */

  // TODO: Can we remove this route and use contact code instead?
  router.get('/leases/by-pnr/:pnr', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
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

      const contact = await leasingAdapter.getContactForPnr(ctx.params.pnr)

      // TODO(BREAKING): includeContacts no longer defaults to true
      const leases = await leasingAdapter.getLeasesByContactCode(
        contact.contactCode,
        queryParams.data
      )

      ctx.body = {
        content: leases,
        ...metadata,
      }
    } catch (err) {
      logger.error({ err, metadata }, 'Error fetching leases from leasing')
      ctx.status = 500
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
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *         required: false
   *         description: Whether to include related contacts in the response.
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         required: false
   *         description: >-
   *           Comma-separated list of statuses to include leases by.
   *           Valid values are "current", "upcoming", "about-to-end", and "ended".
   *           Default is all statuses.
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

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance:
   *   get:
   *     summary: Get home insurance for a lease
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *     responses:
   *       200:
   *         description: Home insurance retrieved.
   *       404:
   *         description: Lease or home insurance not found.
   *       500:
   *         description: Internal server error.
   */
  router.get('/leases/:leaseId/home-insurance', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await leasingAdapter.getLeaseHomeInsurance(
      ctx.params.leaseId
    )

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = {
          error: 'Not found',
          ...metadata,
        }
        return
      }

      ctx.status = 500
      ctx.body = {
        error: result.err,
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: result.data,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance/offer:
   *   get:
   *     summary: Get home insurance offer for a lease
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *     responses:
   *       200:
   *         description: Home insurance offer retrieved.
   *       404:
   *         description: Lease or rental object not found.
   *       500:
   *         description: Internal server error.
   */
  router.get('/leases/:leaseId/home-insurance/offer', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const lease = await leasingAdapter.getLease(ctx.params.leaseId, {
        includeContacts: false,
      })

      if (!lease.rentalPropertyId) {
        ctx.status = 404
        ctx.body = {
          error: 'Rental object not found',
          ...metadata,
        }
        return
      }

      const residenceResponse =
        await propertyBaseAdapter.getResidenceByRentalId(lease.rentalPropertyId)

      if (!residenceResponse.ok) {
        if (residenceResponse.err === 'not-found') {
          ctx.status = 404
          ctx.body = {
            error: 'Rental object not found',
            ...metadata,
          }
          return
        }

        ctx.status = 500
        ctx.body = {
          error: residenceResponse.err,
          ...metadata,
        }
        return
      }

      const monthlyAmount = getHomeInsuranceOfferMonthlyAmount(
        residenceResponse.data.type.roomCount
      )

      if (!monthlyAmount) {
        throw {
          error: 'No monthly amount found for residence',
          residence: JSON.stringify(residenceResponse.data, null, 2),
        }
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ monthlyAmount }, metadata)
    } catch (err) {
      logger.error({ err, metadata }, 'Error fetching home insurance offer')
      ctx.status = 500
      ctx.body = {
        error: 'Unknown error',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance:
   *   post:
   *     summary: Add home insurance to a lease
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *     responses:
   *       201:
   *         description: Successfully added home insurance.
   *       500:
   *         description: Internal server error.
   */
  router.post('/leases/:leaseId/home-insurance', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await leasingAdapter.addLeaseHomeInsurance(
      ctx.params.leaseId
    )

    if (!result.ok) {
      ctx.status = 500
      ctx.body = {
        error: result.err,
        ...metadata,
      }
      return
    }

    ctx.status = 201
    ctx.body = {
      content: result.data,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /leases/{leaseId}/rent-rows/{rentRowId}:
   *   delete:
   *     summary: Delete a rent row for a lease
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *       - in: path
   *         name: rentRowId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the rent row.
   *     responses:
   *       200:
   *         description: Rent row deleted.
   *       500:
   *         description: Internal server error.
   */

  router.delete('/leases/:leaseId/rent-rows/:rentRowId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const deleteRentRowResult = await leasingAdapter.deleteLeaseRentRow({
      leaseId: ctx.params.leaseId,
      rentRowId: ctx.params.rentRowId,
    })

    if (!deleteRentRowResult.ok) {
      ctx.status = 500
      ctx.body = {
        error: deleteRentRowResult.err,
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: deleteRentRowResult.data,
      ...metadata,
    }
  })
}
