import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { Contact, Lease } from '@onecore/types'
import z from 'zod'

import {
  getContactByContactCode,
  getContactsByLeaseId,
} from '../adapters/xpand/tenant-lease-adapter'
import { createLease } from '../adapters/xpand/xpand-soap-adapter'
import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import * as tenfastHelpers from '../helpers/tenfast'
import { AdapterResult } from '../adapters/types'

/**
 * @swagger
 * tags:
 *   - name: Leases
 *     description: Endpoints related to lease operations
 */

const GetLeasesStatusSchema = z.enum([
  'active',
  'upcoming',
  'about-to-end',
  'ended',
])

const GetLeasesQueryParamsSchema = z.object({
  status: z
    .string()
    .nonempty()
    .refine(
      (value) =>
        value
          .split(',')
          .every((v) => GetLeasesStatusSchema.safeParse(v.trim()).success),
      {
        message: `status must be one or more of ${GetLeasesStatusSchema.options.join(', ')}`,
      }
    )
    .transform((value) =>
      value
        .split(',')
        .map((v) => v.trim() as z.infer<typeof GetLeasesStatusSchema>)
    )
    .optional(),
  includeContacts: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})

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
   *       200: *         description: Successfully retrieved leases.
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

  // const getLeasesForPnrQueryParamSchema = z.object({
  //   includeUpcomingLeases: z
  //     .enum(['true', 'false'])
  //     .optional()
  //     .transform((value) => value === 'true'),
  //   includeTerminatedLeases: z
  //     .enum(['true', 'false'])
  //     .optional()
  //     .transform((value) => value === 'true'),
  //   includeContacts: z
  //     .enum(['true', 'false'])
  //     .optional()
  //     .transform((value) => value === 'true'),
  // })

  // TODO: Maybe remove this route and use contact code instead?
  // Core can get that from pnr
  // router.get('(.*)/leases/for/nationalRegistrationNumber/:pnr', async (ctx) => {
  //   const metadata = generateRouteMetadata(ctx, [
  //     'includeUpcomingLeases',
  //     'includeTerminatedLeases',
  //     'includeContacts',
  //   ])

  //   const queryParams = getLeasesForPnrQueryParamSchema.safeParse(ctx.query)
  //   if (queryParams.success === false) {
  //     ctx.status = 400
  //     return
  //   }

  //   const responseData = await getLeasesForNationalRegistrationNumber(
  //     ctx.params.pnr,
  //     {
  //       includeUpcomingLeases: queryParams.data.includeUpcomingLeases,
  //       includeTerminatedLeases: queryParams.data.includeTerminatedLeases,
  //       includeContacts: queryParams.data.includeContacts,
  //     }
  //   )

  //   ctx.body = {
  //     content: responseData,
  //     ...metadata,
  //   }
  // })

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

  // const getLeasesForContactCodeQueryParamSchema = z.object({
  //   includeUpcomingLeases: z
  //     .enum(['true', 'false'])
  //     .optional()
  //     .transform((value) => value === 'true'),
  //   includeTerminatedLeases: z
  //     .enum(['true', 'false'])
  //     .optional()
  //     .transform((value) => value === 'true'),
  //   includeContacts: z
  //     .enum(['true', 'false'])
  //     .optional()
  //     .transform((value) => value === 'true'),
  // })

  // router.get('(.*)/leases/for/contactCode/:contactCode', async (ctx) => {
  //   const metadata = generateRouteMetadata(ctx, [
  //     'includeUpcomingLeases',
  //     'includeTerminatedLeases',
  //     'includeContacts',
  //   ])

  //   const queryParams = getLeasesForContactCodeQueryParamSchema.safeParse(
  //     ctx.query
  //   )

  //   if (queryParams.success === false) {
  //     ctx.status = 400
  //     return
  //   }

  //   const result = await getLeasesForContactCode(
  //     ctx.params.contactCode,
  //     queryParams.data
  //   )

  //   if (!result.ok) {
  //     ctx.status = 500
  //     ctx.body = {
  //       error: result.err,
  //       ...metadata,
  //     }
  //     return
  //   }

  //   ctx.status = 200
  //   ctx.body = {
  //     content: result.data,
  //     ...metadata,
  //   }
  // })

  // Tenfast equivalent of above route
  router.get('(.*)/leases/by-contact-code/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['status', 'includeContacts'])

    const queryParams = GetLeasesQueryParamsSchema.safeParse(ctx.query)

    if (queryParams.success === false) {
      ctx.status = 400
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

  // const getLeasesForPropertyIdQueryParamSchema = z.object({
  //   includeUpcomingLeases: z
  //     .enum(['true', 'false'])
  //     .optional()
  //     .transform((value) => value === 'true'),
  //   includeTerminatedLeases: z
  //     .enum(['true', 'false'])
  //     .optional()
  //     .transform((value) => value === 'true'),
  //   includeContacts: z
  //     .enum(['true', 'false'])
  //     .optional()
  //     .transform((value) => value === 'true'),
  // })

  // router.get('(.*)/leases/for/propertyId/:propertyId', async (ctx) => {
  //   const metadata = generateRouteMetadata(ctx, [
  //     'includeUpcomingLeases',
  //     'includeTerminatedLeases',
  //     'includeContacts',
  //   ])

  //   const queryParams = getLeasesForPropertyIdQueryParamSchema.safeParse(
  //     ctx.query
  //   )
  //   if (queryParams.success === false) {
  //     ctx.status = 400
  //     return
  //   }

  //   const responseData = await getLeasesForPropertyId(ctx.params.propertyId, {
  //     includeUpcomingLeases: queryParams.data.includeUpcomingLeases,
  //     includeTerminatedLeases: queryParams.data.includeTerminatedLeases,
  //     includeContacts: queryParams.data.includeContacts,
  //   })

  //   ctx.body = {
  //     content: responseData,
  //     ...metadata,
  //   }
  // })

  router.get(
    '(.*)/leases/by-rental-object-code/:rentalObjectCode',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx, ['status', 'includeContacts'])

      const queryParams = GetLeasesQueryParamsSchema.safeParse(ctx.query)

      if (queryParams.success === false) {
        ctx.status = 400
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
  // router.get('(.*)/leases/:id', async (ctx) => {
  //   const metadata = generateRouteMetadata(ctx, ['includeContacts'])
  //   const responseData = await getLease(
  //     ctx.params.id,
  //     ctx.query.includeContacts
  //   )

  //   ctx.body = {
  //     content: responseData,
  //     ...metadata,
  //   }
  // })

  router.get('(.*)/leases/:leaseId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['includeContacts'])
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

      if (ctx.params.includeContacts) {
        const contacts = await getContactsByLeaseId(onecoreLease.leaseId)
        const lease = { ...onecoreLease, tenants: contacts }

        ctx.status = 200
        ctx.body = makeSuccessResponseBody(lease, metadata)
      } else {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(onecoreLease, metadata)
      }
    } catch (error) {
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
}

async function patchLeasesWithContacts(
  leases: Lease[]
): Promise<AdapterResult<Lease[], 'no-contact' | 'unknown'>> {
  for (const lease of leases) {
    if (!lease.tenantContactIds) {
      continue
    }

    let contacts: Contact[] = []
    for (const contactId of lease.tenantContactIds) {
      const contact = await getContactByContactCode(contactId, false)
      if (!contact.ok || !contact.data) {
        return { ok: false, err: 'no-contact' }
      }

      contacts.push(contact.data)
    }

    lease.tenants = contacts
  }

  return { ok: true, data: leases }
}
