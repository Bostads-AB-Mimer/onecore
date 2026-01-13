import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { leasing } from '@onecore/types'
import { z } from 'zod'

import { mapLease } from './schemas/lease'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import { parseRequestBody } from '../../middlewares/parse-request-body'

export const routes = (router: KoaRouter) => {
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

  const CreateInvoiceRowRequestSchema = z.object({
    amount: z.number(),
    article: z.string().nullable(),
    label: z.string().nullable(),
    from: z.string().optional(),
    to: z.string().optional(),
  })

  /**
   * @swagger
   * /leases/{leaseId}/invoice-rows:
   *   post:
   *     summary: Create an invoice row for a lease
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               amount:
   *                 type: number
   *               article:
   *                 type: string
   *                 nullable: true
   *               label:
   *                 type: string
   *                 nullable: true
   *               from:
   *                 type: string
   *                 nullable: true
   *                 description: Optional start date in YYYY-MM format.
   *               to:
   *                 type: string
   *                 nullable: true
   *                 description: Optional end date in YYYY-MM format.
   *             required:
   *               - amount
   *               - vat
   *     responses:
   *       201:
   *         description: Successfully created invoice row.
   *       400:
   *         description: Invalid request body.
   *       500:
   *         description: Internal server error.
   */
  router.post(
    '/leases/:leaseId/invoice-rows',
    parseRequestBody(CreateInvoiceRowRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const createInvoiceRowResult = await leasingAdapter.createInvoiceRow({
        leaseId: ctx.params.leaseId,
        invoiceRow: ctx.request.body,
      })

      if (!createInvoiceRowResult.ok) {
        ctx.status = 500
        ctx.body = {
          error: createInvoiceRowResult.err,
          ...metadata,
        }
        return
      }

      ctx.status = 201
      ctx.body = {
        content: createInvoiceRowResult.data,
        ...metadata,
      }
    }
  )

  /**
   * @swagger
   * /leases/{leaseId}/invoice-rows/{invoiceRowId}:
   *   delete:
   *     summary: Delete an invoice row for a lease
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
   *         name: invoiceRowId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the invoice row.
   *     responses:
   *       200:
   *         description: Invoice row deleted.
   *       500:
   *         description: Internal server error.
   */
  router.delete('/leases/:leaseId/invoice-rows/:invoiceRowId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const deleteInvoiceRowResult = await leasingAdapter.deleteInvoiceRow({
      leaseId: ctx.params.leaseId,
      invoiceRowId: ctx.params.invoiceRowId,
    })

    if (!deleteInvoiceRowResult.ok) {
      ctx.status = 500
      ctx.body = {
        error: deleteInvoiceRowResult.err,
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: deleteInvoiceRowResult.data,
      ...metadata,
    }
  })
}
