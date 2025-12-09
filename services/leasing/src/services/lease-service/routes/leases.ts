import KoaRouter from '@koa/router'
import {
  getLease,
  getLeasesForContactCode,
  getLeasesForNationalRegistrationNumber,
  getLeasesForPropertyId,
  getAllLeasesByDateFilter,
} from '../adapters/xpand/tenant-lease-adapter'
import { createLease } from '../adapters/xpand/xpand-soap-adapter'
import { generateRouteMetadata } from '@onecore/utilities'
import z from 'zod'

/**
 * @swagger
 * tags:
 *   - name: Leases
 *     description: Endpoints related to lease operations
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /leases/for/nationalRegistrationNumber/{pnr}:
   *   get:
   *     summary: Get leases by national registration number
   *     description: Retrieve leases associated with a national registration number (pnr).
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: pnr
   *         required: true
   *         schema:
   *           type: string
   *         description: The national registration number (pnr) of the contact.
   *       - in: query
   *         name: includeTerminatedLeases
   *         schema:
   *           type: boolean
   *         description: Include terminated leases in the result.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *         description: Include contact information in the result.
   *     responses:
   *       200:
   *         description: Successfully retrieved leases.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     description: Lease details.
   *       500:
   *         description: Internal server error. Failed to retrieve leases.
   */

  const getLeasesForPnrQueryParamSchema = z.object({
    includeUpcomingLeases: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    includeTerminatedLeases: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    includeContacts: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
  })

  router.get('(.*)/leases/for/nationalRegistrationNumber/:pnr', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'includeUpcomingLeases',
      'includeTerminatedLeases',
      'includeContacts',
    ])

    const queryParams = getLeasesForPnrQueryParamSchema.safeParse(ctx.query)
    if (queryParams.success === false) {
      ctx.status = 400
      return
    }

    const responseData = await getLeasesForNationalRegistrationNumber(
      ctx.params.pnr,
      {
        includeUpcomingLeases: queryParams.data.includeUpcomingLeases,
        includeTerminatedLeases: queryParams.data.includeTerminatedLeases,
        includeContacts: queryParams.data.includeContacts,
      }
    )

    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /leases/for/contactCode/{contactCode}:
   *   get:
   *     summary: Get leases by contact code
   *     description: Retrieve leases associated with a contact by contact code.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code of the contact.
   *       - in: query
   *         name: includeTerminatedLeases
   *         schema:
   *           type: boolean
   *         description: Include terminated leases in the result.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *         description: Include contact information in the result.
   *     responses:
   *       200:
   *         description: Successfully retrieved leases.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     description: Lease details.
   *       500:
   *         description: Internal server error. Failed to retrieve leases.
   */

  const getLeasesForContactCodeQueryParamSchema = z.object({
    includeUpcomingLeases: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    includeTerminatedLeases: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    includeContacts: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
  })

  router.get('(.*)/leases/for/contactCode/:pnr', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'includeUpcomingLeases',
      'includeTerminatedLeases',
      'includeContacts',
    ])

    const queryParams = getLeasesForContactCodeQueryParamSchema.safeParse(
      ctx.query
    )
    if (queryParams.success === false) {
      ctx.status = 400
      return
    }

    const result = await getLeasesForContactCode(ctx.params.pnr, {
      includeUpcomingLeases: queryParams.data.includeUpcomingLeases,
      includeTerminatedLeases: queryParams.data.includeTerminatedLeases,
      includeContacts: queryParams.data.includeContacts,
    })
    if (!result.ok) {
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
   * /leases/for/propertyId/{propertyId}:
   *   get:
   *     summary: Get leases by property ID
   *     description: Retrieve leases associated with a property by property ID.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: propertyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the property.
   *       - in: query
   *         name: includeTerminatedLeases
   *         schema:
   *           type: boolean
   *         description: Include terminated leases in the result.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *         description: Include contact information in the result.
   *     responses:
   *       200:
   *         description: Successfully retrieved leases.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     description: Lease details.
   *       500:
   *         description: Internal server error. Failed to retrieve leases.
   */

  const getLeasesForPropertyIdQueryParamSchema = z.object({
    includeUpcomingLeases: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    includeTerminatedLeases: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    includeContacts: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
  })

  router.get('(.*)/leases/for/propertyId/:propertyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'includeUpcomingLeases',
      'includeTerminatedLeases',
      'includeContacts',
    ])

    const queryParams = getLeasesForPropertyIdQueryParamSchema.safeParse(
      ctx.query
    )
    if (queryParams.success === false) {
      ctx.status = 400
      return
    }

    const responseData = await getLeasesForPropertyId(ctx.params.propertyId, {
      includeUpcomingLeases: queryParams.data.includeUpcomingLeases,
      includeTerminatedLeases: queryParams.data.includeTerminatedLeases,
      includeContacts: queryParams.data.includeContacts,
    })

    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /leases/{id}:
   *   get:
   *     summary: Get detailed lease by lease ID
   *     description: Retrieve lease details by lease ID.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *         description: Include contact information in the result.
   *     responses:
   *       200:
   *         description: Successfully retrieved lease details.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: Lease details.
   *       404:
   *         description: Lease not found.
   *       500:
   *         description: Internal server error. Failed to retrieve lease details.
   */
  router.get('(.*)/leases/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['includeContacts'])
    const responseData = await getLease(
      ctx.params.id,
      ctx.query.includeContacts
    )

    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  interface CreateLeaseRequest {
    parkingSpaceId: string
    contactCode: string
    fromDate: string
    companyCode: string
  }

  /**
   * @swagger
   * /leases:
   *   post:
   *     summary: Create new lease in xpand for parking space
   *     description: Create a new lease for a parking space.
   *     tags: [Leases]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               parkingSpaceId:
   *                 type: string
   *                 description: The ID of the parking space for the lease.
   *               contactCode:
   *                 type: string
   *                 description: The contact code associated with the lease.
   *               fromDate:
   *                 type: string
   *                 format: date-time
   *                 description: The start date of the lease.
   *               companyCode:
   *                 type: string
   *                 description: The company code associated with the lease.
   *             required:
   *               - parkingSpaceId
   *               - contactCode
   *               - fromDate
   *               - companyCode
   *     responses:
   *       200:
   *         description: Lease created successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 LeaseId:
   *                   type: string
   *                   description: The ID of the newly created lease.
   *       500:
   *         description: Internal server error. Failed to create lease.
   */
  router.post('(.*)/leases', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const request = <CreateLeaseRequest>ctx.request.body

      const createLeaseResult = await createLease(
        new Date(request.fromDate),
        request.parkingSpaceId,
        request.contactCode,
        request.companyCode
      )
      if (createLeaseResult.ok) {
        ctx.body = {
          content: createLeaseResult.data,
          ...metadata,
        }
      } else if (createLeaseResult.err === 'create-lease-not-allowed') {
        ctx.status = 404
        ctx.body = {
          error: 'Lease cannot be created on this rental object',
          ...metadata,
        }
      } else {
        ctx.status = 500
        ctx.body = {
          error: 'Unknown error when creating lease',
          ...metadata,
        }
      }
    } catch (error: unknown) {
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /leases:
   *   get:
   *     summary: Get all leases with optional date filters
   *     description: Retrieve all leases with optional filtering by fromDate and lastDebitDate. Only returns leases that are either active (no lastDebitDate) or terminated within the last 5 years.
   *     tags: [Leases]
   *     parameters:
   *       - in: query
   *         name: fromDateStart
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter leases with fromDate greater than or equal to this date.
   *       - in: query
   *         name: fromDateEnd
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter leases with fromDate less than or equal to this date.
   *       - in: query
   *         name: lastDebitDateStart
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter leases with lastDebitDate greater than or equal to this date.
   *       - in: query
   *         name: lastDebitDateEnd
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter leases with lastDebitDate less than or equal to this date.
   *     responses:
   *       200:
   *         description: Successfully retrieved leases.
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
   *                       leaseId:
   *                         type: string
   *                       rentalPropertyId:
   *                         type: string
   *                       fromDate:
   *                         type: string
   *                         format: date
   *                       lastDebitDate:
   *                         type: string
   *                         format: date
   *                       noticeDate:
   *                         type: string
   *                         format: date
   *                       preferredMoveOutDate:
   *                         type: string
   *                         format: date
   *                       leaseType:
   *                         type: string
   *       400:
   *         description: Bad request. Invalid query parameters.
   *       500:
   *         description: Internal server error. Failed to retrieve leases.
   */
  const getAllLeasesByDateFilterQueryParamSchema = z.object({
    fromDateStart: z.string().optional().transform((val) => val ? new Date(val) : undefined),
    fromDateEnd: z.string().optional().transform((val) => val ? new Date(val) : undefined),
    lastDebitDateStart: z.string().optional().transform((val) => val ? new Date(val) : undefined),
    lastDebitDateEnd: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  })

  router.get('(.*)/leases', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'fromDateStart',
      'fromDateEnd',
      'lastDebitDateStart',
      'lastDebitDateEnd',
    ])

    const queryParams = getAllLeasesByDateFilterQueryParamSchema.safeParse(ctx.query)
    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid query parameters',
        details: queryParams.error.errors,
        ...metadata,
      }
      return
    }

    const result = await getAllLeasesByDateFilter({
      fromDateStart: queryParams.data.fromDateStart,
      fromDateEnd: queryParams.data.fromDateEnd,
      lastDebitDateStart: queryParams.data.lastDebitDateStart,
      lastDebitDateEnd: queryParams.data.lastDebitDateEnd,
    })

    if (!result.ok) {
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
}
