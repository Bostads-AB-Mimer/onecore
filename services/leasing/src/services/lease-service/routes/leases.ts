import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { Contact, Lease, leasing } from '@onecore/types'
import { z } from 'zod'

import {
  getContactByContactCode,
  getContactsByLeaseId,
} from '../adapters/xpand/tenant-lease-adapter'
import { createLease } from '../adapters/xpand/xpand-soap-adapter'
import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import * as tenfastHelpers from '../helpers/tenfast'
import { AdapterResult } from '../adapters/types'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { toYearMonthString } from '../adapters/tenfast/schemas'

/**
 * @swagger
 * tags:
 *   - name: Leases
 *     description: Endpoints related to lease operations
 */

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /leases/by-contact-code/{contactCode}:
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
   *         name: status
   *         schema:
   *           type: string
   *         description: The status of the leases to include.
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
  router.get('(.*)/leases/by-contact-code/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['status', 'includeContacts'])

    const queryParams = leasing.v1.GetLeasesOptionsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { error: queryParams.error.issues, ...metadata }
      return
    }

    const contact = await tenfastAdapter.getTenantByContactCode(
      ctx.params.contactCode
    )

    if (!contact.ok) {
      ctx.status = 500
      ctx.body = {
        error: contact.err,
        ...metadata,
      }

      return
    }

    if (!contact.data) {
      ctx.status = 404
      ctx.body = {
        error: 'Contact not found',
        ...metadata,
      }
      return
    }

    const filters = queryParams.data?.status
      ? { status: queryParams.data.status }
      : undefined

    const getLeases = await tenfastAdapter.getLeasesByTenantId(
      contact.data._id,
      filters
    )

    if (!getLeases.ok) {
      ctx.status = 500
      ctx.body = {
        error: getLeases.err,
        ...metadata,
      }
      return
    }

    const onecoreLeases = getLeases.data.map(tenfastHelpers.mapToOnecoreLease)

    // TODO: When tenfast lease contains hyresgaster as contact codes, we can rewrite this
    if (!queryParams.data.includeContacts) {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(onecoreLeases, metadata)
    } else {
      const patchLeases = await patchLeasesWithContacts(onecoreLeases)
      if (!patchLeases.ok) {
        ctx.status = 500
        ctx.body = {
          error: patchLeases.err,
          ...metadata,
        }

        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(patchLeases.data, metadata)
    }
  })

  /**
   * @swagger
   * /leases/by-rental-object-code/{rentalObjectCode}:
   *   get:
   *     summary: Get leases by rental object code
   *     description: Retrieve leases associated with a rental object by rental object code.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The code of the rental object.
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: The status of the leases to include.
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
  router.get(
    '(.*)/leases/by-rental-object-code/:rentalObjectCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx, ['status', 'includeContacts'])

      const queryParams = leasing.v1.GetLeasesOptionsSchema.safeParse(ctx.query)

      if (!queryParams.success) {
        ctx.status = 400
        ctx.body = { error: queryParams.error.issues, ...metadata }
        return
      }

      // TODO: TenFAST route is coming to get avtal by hyresobjekt
      // EDIT: or is it?
      const property = await tenfastAdapter.getRentalObject(
        ctx.params.rentalObjectCode
      )

      // TODO: Clean this up
      if (!property.ok && property.err === 'could-not-find-rental-object') {
        ctx.status = 404
        ctx.body = {
          error: 'Not found',
          ...metadata,
        }
        return
      }

      if (property.ok && property.data === null) {
        ctx.status = 404
        ctx.body = {
          error: 'Not found',
          ...metadata,
        }
        return
      }

      if (!property.ok) {
        ctx.status = 500
        ctx.body = {
          error: property.err,
          ...metadata,
        }
        return
      }

      if (!property.data) {
        throw 'ffs'
      }

      const getLeases = await tenfastAdapter.getLeasesByRentalPropertyId(
        property.data._id
      )

      if (!getLeases.ok) {
        ctx.status = 500
        ctx.body = {
          error: getLeases.err,
          ...metadata,
        }
        return
      }

      const onecoreLeases = getLeases.data.map(tenfastHelpers.mapToOnecoreLease)

      // TODO: When tenfast lease contains hyresgaster as contact codes, we can rewrite this
      if (!queryParams.data.includeContacts) {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(onecoreLeases, metadata)
      } else {
        const patchLeases = await patchLeasesWithContacts(onecoreLeases)
        if (!patchLeases.ok) {
          ctx.status = 500
          ctx.body = {
            error: 'Not found',
            ...metadata,
          }

          return
        }

        ctx.status = 200
        ctx.body = makeSuccessResponseBody(patchLeases.data, metadata)
      }
    }
  )

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
  router.get('(.*)/leases/:leaseId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['includeContacts'])
    const queryParams = leasing.v1.GetLeaseOptionsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = { error: queryParams.error.issues, ...metadata }
      return
    }

    try {
      const getLease = await tenfastAdapter.getLeaseByLeaseId(
        ctx.params.leaseId
      )

      if (!getLease.ok) {
        ctx.status = 500
        ctx.body = {
          error: getLease.err,
          ...metadata,
        }
        return
      }

      const onecoreLease = tenfastHelpers.mapToOnecoreLease(getLease.data)

      if (queryParams.data.includeContacts) {
        const contacts = await getContactsByLeaseId(onecoreLease.leaseId)
        const lease = { ...onecoreLease, tenants: contacts }

        ctx.status = 200
        ctx.body = makeSuccessResponseBody(lease, metadata)
      } else {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(onecoreLease, metadata)
      }
    } catch (error) {
      console.log(error)
      logger.error(error, 'Error when getting lease')
      ctx.status = 500
      ctx.body = {
        error: 'Unknown error',
        ...metadata,
      }
    }
  })

  interface CreateLeaseRequest {
    parkingSpaceId: string
    contactCode: string
    fromDate: string
    companyCode: string
    includeVAT: boolean
  }

  /**
   * @swagger
   * /leases:
   *   post:
   *     summary: Create new lease for parking space
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
   *               - includeVAT
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

        //Temporary: also create lease to tenfast
        const contactResult = await getContactByContactCode(
          request.contactCode,
          false
        )

        if (!contactResult.ok || !contactResult.data) {
          logger.error(
            {
              contactCode: request.contactCode,
              error: contactResult.ok ? undefined : contactResult.err,
            },
            'Could not retrieve contact to create tenFAST lease'
          )
          return
        }

        const createLeaseTenfastResult = await tenfastAdapter.createLease(
          contactResult.data,
          request.parkingSpaceId,
          new Date(request.fromDate),
          'PARKING_SPACE',
          request.includeVAT
        )

        if (createLeaseTenfastResult.ok) {
          logger.info(
            { result: createLeaseTenfastResult.data },
            'Lease created in tenFAST'
          )
        } else {
          logger.error(
            { error: createLeaseTenfastResult.err },
            'Error creating lease in tenFAST'
          )
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
   * /leases/{id}/invoice-rows:
   *   post:
   *     summary: Create a invoice row
   *     description: Create a invoice row.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: id
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
   *               label:
   *                 type: string
   *               from:
   *                 type: string
   *                 description: Optional start date.
   *               to:
   *                 type: string
   *                 description: Optional end date.
   *             required:
   *               - amount
   *               - article
   *               - label
   *     responses:
   *       201:
   *         description: Successfully created invoice row.
   *       404:
   *         description: Lease not found.
   *       500:
   *         description: Internal server error.
   */
  const CreateInvoiceRowRequestBodySchema = z.object({
    amount: z.number(),
    article: z.string(),
    label: z.string(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })

  router.post(
    '(.*)/leases/:leaseId/invoice-rows',
    parseRequestBody(CreateInvoiceRowRequestBodySchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const createInvoiceRow = await tenfastAdapter.createInvoiceRow({
        leaseId: ctx.params.leaseId,
        invoiceRow: {
          ...ctx.request.body,
          from: ctx.request.body.from
            ? toYearMonthString(ctx.request.body.from)
            : undefined,
          to: ctx.request.body.to
            ? toYearMonthString(ctx.request.body.to)
            : undefined,

          vat: 0.25, // TODO: What to put for VAT?
        },
      })

      if (!createInvoiceRow.ok) {
        ctx.status = 500
        ctx.body = {
          error: createInvoiceRow.err,
          ...metadata,
        }
        return
      }

      ctx.status = 201
      ctx.body = makeSuccessResponseBody(createInvoiceRow.data, metadata)
    }
  )

  /**
   * @swagger
   * /leases/{id}/invoice-rows/{invoiceRowId}:
   *   delete:
   *     summary: Delete an invoice row
   *     description: Delete an invoice row.
   *     tags: [Leases]
   *     parameters:
   *       - in: path
   *         name: id
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
   *         description: Successfully deleted invoice row.
   *       404:
   *         description: Lease not found.
   *       500:
   *         description: Internal server error.
   */
  router.delete(
    '(.*)/leases/:leaseId/invoice-rows/:invoiceRowId',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const deleteInvoiceRow = await tenfastAdapter.deleteInvoiceRow({
        leaseId: ctx.params.leaseId,
        invoiceRowId: ctx.params.invoiceRowId,
      })

      if (!deleteInvoiceRow.ok) {
        ctx.status = 500
        ctx.body = {
          error: deleteInvoiceRow.err,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(null, metadata)
    }
  )

  /**
   * @swagger
   * /articles:
   *   get:
   *     summary: List Tenfast articles
   *     tags: [Leases]
   *     responses:
   *       200:
   *         description: Successfully retrieved articles.
   *       500:
   *         description: Internal server error.
   */
  router.get('(.*)/articles', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const articles = await tenfastAdapter.getArticles()

    if (!articles.ok) {
      ctx.status = 500
      ctx.body = { error: articles.err, ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(articles.data, metadata)
  })
}

async function patchLeasesWithContacts(
  leases: Lease[]
): Promise<AdapterResult<Lease[], 'no-contact' | 'unknown'>> {
  for (const lease of leases) {
    if (!lease.tenantContactIds) {
      continue
    }

    let contacts: Contact[] = []
    for (const contactCode of lease.tenantContactIds) {
      const contact = await getContactByContactCode(contactCode, false)
      if (!contact.ok || !contact.data) {
        return { ok: false, err: 'no-contact' }
      }

      contacts.push(contact.data)
    }

    lease.tenants = contacts
  }

  return { ok: true, data: leases }
}
