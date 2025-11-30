import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { leasing, WaitingListType, RouteErrorResponse } from '@onecore/types'
import { z } from 'zod'

import * as tenantLeaseAdapter from '../adapters/xpand/tenant-lease-adapter'
import * as applicationProfileAdapter from '../adapters/application-profile-adapter'
import * as contactCommentsAdapter from '../adapters/xpand/contact-comments-adapter'
import {
  getContactByContactCode,
  getContactByNationalRegistrationNumber,
  getContactByPhoneNumber,
} from '../adapters/xpand/tenant-lease-adapter'

import {
  addApplicantToToWaitingList,
  removeApplicantFromWaitingList,
} from '../adapters/xpand/xpand-soap-adapter'
import { getTenant } from '../get-tenant'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { createOrUpdateApplicationProfile } from '../create-or-update-application-profile'

/**
 * @swagger
 * tags:
 *   - name: Contacts
 *     description: Endpoints related to contact operations
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /contacts/search:
   *   get:
   *     summary: Search contact based by query
   *     description: Search contacts based on a query string.
   *     tags: [Contacts]
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *         description: The search query string.
   *     responses:
   *       200:
   *         description: Successfully retrieved contacts data.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                   description: The array of contacts matching the search query.
   *       400:
   *         description: Bad request. The query parameter 'q' must be a string.
   *       500:
   *         description: Internal server error. Failed to retrieve contacts data.
   */
  router.get('(.*)/contacts/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q'])

    if (typeof ctx.query.q !== 'string') {
      ctx.status = 400
      ctx.body = { reason: 'Invalid query parameter', ...metadata }
      return
    }

    const result = await tenantLeaseAdapter.getContactsDataBySearchQuery(
      ctx.query.q
    )

    if (!result.ok) {
      ctx.status = 500
      ctx.body = { error: result.err, ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  //todo: rename singular routes to plural

  /**
   * @swagger
   * /contact/nationalRegistrationNumber/{pnr}:
   *   get:
   *     summary: Get contact by PNR
   *     description: Retrieve contact information by national registration number (pnr).
   *     tags: [Contacts]
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
   *         description: Optional. Whether to include terminated leases in the response.
   *     responses:
   *       200:
   *         description: Successfully retrieved contact information.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The contact data.
   *       500:
   *         description: Internal server error. Failed to retrieve contact information.
   */

  const getContactByPnrQueryParamSchema = z
    .object({
      includeTerminatedLeases: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value === 'true'),
    })
    .default({ includeTerminatedLeases: 'false' })

  router.get('(.*)/contact/nationalRegistrationNumber/:pnr', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['includeTerminatedLeases'])
    const queryParams = getContactByPnrQueryParamSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      return
    }

    const responseData = await getContactByNationalRegistrationNumber(
      ctx.params.pnr,
      queryParams.data.includeTerminatedLeases
    )

    ctx.status = 200
    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /contact/contactCode/{contactCode}:
   *   get:
   *     summary: Get contact by contact code
   *     description: Retrieve contact information by contact code.
   *     tags: [Contacts]
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
   *         description: Optional. Whether to include terminated leases in the response.
   *     responses:
   *       200:
   *         description: Successfully retrieved contact information.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The contact data.
   *       500:
   *         description: Internal server error. Failed to retrieve contact information.
   */

  const getContactByContactCodeQueryParamSchema = z
    .object({
      includeTerminatedLeases: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value === 'true'),
    })
    .default({ includeTerminatedLeases: 'false' })

  router.get('(.*)/contact/contactCode/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['includeTerminatedLeases'])

    const queryParams = getContactByContactCodeQueryParamSchema.safeParse(
      ctx.query
    )

    if (!queryParams.success) {
      ctx.status = 400
      return
    }

    const result = await getContactByContactCode(
      ctx.params.contactCode,
      queryParams.data.includeTerminatedLeases
    )

    if (!result.ok) {
      ctx.status = 500
      ctx.body = { error: result.err, ...metadata }
      return
    }

    if (!result.data) {
      ctx.status = 404
      ctx.body = { reason: 'Contact not found', ...metadata }
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
   * /tenants/contactCode/{contactCode}:
   *   get:
   *     summary: Gets tenant by contact code
   *     description: Retrieve tenant information by contact code.
   *     tags: [Tenants]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code of the tenant.
   *     responses:
   *       200:
   *         description: Successfully retrieved tenant information.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The tenant data.
   *       404:
   *         description: Not found.
   *       500:
   *         description: Internal server error. Failed to retrieve Tenant information.
   */
  router.get('(.*)/tenants/contactCode/:contactCode', async (ctx) => {
    const result = await getTenant({ contactCode: ctx.params.contactCode })
    const metadata = generateRouteMetadata(ctx)

    if (!result.ok) {
      if (result.err === 'contact-not-found') {
        ctx.status = 404
        ctx.body = {
          type: result.err,
          title: 'Contact not found',
          status: 404,
          ...metadata,
        } satisfies RouteErrorResponse
        return
      }

      if (result.err === 'no-valid-housing-contract') {
        ctx.status = 500
        ctx.body = {
          type: result.err,
          title: 'No valid housing contract found',
          status: 500,
          detail: 'No active or upcoming contract found.',
          ...metadata,
        } satisfies RouteErrorResponse
        return
      }

      if (result.err === 'contact-not-tenant') {
        ctx.status = 500
        ctx.body = {
          type: result.err,
          title: 'Contact is not a tenant',
          status: 500,
          detail: 'No active or upcoming contract found.',
          ...metadata,
        } satisfies RouteErrorResponse
        return
      }

      ctx.status = 500
      ctx.body = {
        type: result.err,
        title: 'Unknown error',
        status: 500,
        ...metadata,
      } satisfies RouteErrorResponse
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
   * /contact/phoneNumber/{phoneNumber}:
   *   get:
   *     summary: Get contact by phone number
   *     description: Retrieve contact information by phone number.
   *     tags: [Contacts]
   *     parameters:
   *       - in: path
   *         name: phoneNumber
   *         required: true
   *         schema:
   *           type: string
   *         description: The phone number of the contact.
   *     responses:
   *       200:
   *         description: Successfully retrieved contact information.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The contact data.
   *       500:
   *         description: Internal server error. Failed to retrieve contact information.
   */

  const getContactByPhoneNumberQueryParamSchema = z
    .object({
      includeTerminatedLeases: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value === 'true'),
    })
    .default({ includeTerminatedLeases: 'false' })

  router.get('(.*)/contact/phoneNumber/:phoneNumber', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const queryParams = getContactByPhoneNumberQueryParamSchema.safeParse(
      ctx.query
    )

    if (!queryParams.success) {
      ctx.status = 400
      return
    }
    const responseData = await getContactByPhoneNumber(
      ctx.params.phoneNumber,
      queryParams.data.includeTerminatedLeases
    )

    ctx.status = 200
    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  interface CreateWaitingListRequest {
    contactCode: string
    waitingListType: WaitingListType
  }

  /**
   * @swagger
   * /contacts/{contactCode}/waitingLists:
   *   post:
   *     summary: Add contact to waiting list in xpand
   *     description: Add a contact to a waiting list by contact code.
   *     tags: [Contacts]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *           description: The contact code of the contact.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               waitingListType:
   *                 type: WaitingListType
   *                 description: The type of the waiting list.
   *     responses:
   *       201:
   *         description: Contact successfully added to the waiting list.
   *       500:
   *         description: Internal server error. Failed to add contact to the waiting list.
   */
  router.post('(.*)/contacts/:contactCode/waitingLists', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const request = <CreateWaitingListRequest>ctx.request.body
    try {
      const res = await addApplicantToToWaitingList(
        ctx.params.contactCode,
        request.waitingListType
      )

      if (!res.ok && res.err == 'unknown') {
        ctx.status = 500
        ctx.body = { error: 'Unknown error' }
        return
      }

      if (!res.ok && res.err == 'waiting-list-type-not-implemented') {
        ctx.status = 404
        ctx.body = { error: 'Waiting List Type not Implemented' }
        return
      }

      ctx.status = 201
      ctx.body = {
        message: 'Applicant successfully added to waiting list',
        ...metadata,
      }
    } catch (error: unknown) {
      logger.error(error, 'Error adding contact to waitingList')
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
   * /contacts/{contactCode}/waitingLists/reset:
   *   post:
   *     summary: Reset a waiting list for a contact in XPand
   *     description: Resets a waiting list for a contact by contact code.
   *     tags: [Contacts]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *           description: The code of the contact whose waiting list should be reset.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               waitingListType:
   *                 type: WaitingListType
   *                 description: The type of the waiting list.
   *     responses:
   *       201:
   *         description: Waiting list successfully reset for contact.
   *       500:
   *         description: Internal server error. Failed to reset waiting list for contact.
   */
  router.post('(.*)/contacts/:contactCode/waitingLists/reset', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const request = <CreateWaitingListRequest>ctx.request.body
    try {
      //remove from waitinglist
      const res = await removeApplicantFromWaitingList(
        ctx.params.contactCode,
        request.waitingListType
      )

      if (!res.ok && res.err == 'unknown') {
        ctx.status = 500
        ctx.body = { error: 'Unknown error' }
        return
      }

      if (!res.ok && res.err == 'waiting-list-type-not-implemented') {
        ctx.status = 404
        ctx.body = { error: 'Waiting List Type not Implemented' }
        return
      }

      //add to waitinglist
      await addApplicantToToWaitingList(
        ctx.params.contactCode,
        request.waitingListType as WaitingListType
      )

      if (!res.ok && res.err == 'unknown') {
        ctx.status = 500
        ctx.body = { error: 'Unknown error' }
        return
      }

      if (!res.ok && res.err == 'waiting-list-type-not-implemented') {
        ctx.status = 404
        ctx.body = { error: 'Waiting List Type not Implemented' }
        return
      }

      ctx.status = 200
      ctx.body = {
        content: {
          message: 'Waiting List time successfullt reset for applicant',
        },
        ...metadata,
      }
    } catch (error: unknown) {
      logger.error(
        error,
        `Error resetting waitingList ${WaitingListType} for applicant ${ctx.params.contactCode}`
      )
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
   * /contacts/{contactCode}/application-profile:
   *   get:
   *     summary: Gets an application profile by contact code
   *     description: Retrieve application profile information by contact code.
   *     tags: [Contacts]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code associated with the application profile.
   *     responses:
   *       200:
   *         description: Successfully retrieved application profile.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The application profile data.
   *       404:
   *         description: Not found.
   *       500:
   *         description: Internal server error. Failed to retrieve application profile information.
   */

  type GetApplicationProfileResponseData = z.infer<
    typeof leasing.v1.GetApplicationProfileResponseDataSchema
  >

  router.get('(.*)/contacts/:contactCode/application-profile', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const profile = await applicationProfileAdapter.getByContactCode(
      db,
      ctx.params.contactCode
    )

    if (!profile.ok) {
      if (profile.err === 'not-found') {
        ctx.status = 404
        ctx.body = { error: 'not-found', ...metadata }
        return
      }

      ctx.status = 500
      ctx.body = { error: 'unknown', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: profile.data satisfies GetApplicationProfileResponseData,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /contacts/{contactCode}/application-profile:
   *   post:
   *     summary: Creates or updates an application profile by contact code
   *     description: Create or update application profile information by contact code.
   *     tags: [Contacts]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code associated with the application profile.
   *     requestBody:
   *       required: true
   *       content:
   *          application/json:
   *             schema:
   *               type: object
   *       properties:
   *         numAdults:
   *           type: number
   *           description: Number of adults in the current housing.
   *         numChildren:
   *           type: number
   *           description: Number of children in the current housing.
   *         expiresAt:
   *           type: string
   *           format: date
   *           nullable: true
   *           description: Number of children in the current housing.
   *     responses:
   *       200:
   *         description: Successfully updated application profile.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The application profile data.
   *       201:
   *         description: Successfully created application profile.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The application profile data.
   *       404:
   *         description: Not found.
   *       500:
   *         description: Internal server error. Failed to update application profile information.
   */

  type CreateOrUpdateApplicationProfileResponseData = z.infer<
    typeof leasing.v1.CreateOrUpdateApplicationProfileResponseDataSchema
  >

  router.post(
    '(.*)/contacts/:contactCode/application-profile',
    parseRequestBody(
      leasing.v1.CreateOrUpdateApplicationProfileRequestParamsSchema
    ),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const result = await createOrUpdateApplicationProfile(
        db,
        ctx.params.contactCode,
        ctx.request.body
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      const [operation, profile] = result.data
      ctx.status = operation === 'created' ? 201 : 200
      ctx.body = {
        content: profile satisfies CreateOrUpdateApplicationProfileResponseData,
        ...metadata,
      }
      return
    }
  )

  /**
   * @swagger
   * /contacts/{contactCode}/comments:
   *   get:
   *     summary: Get comments/notes for a contact
   *     description: Retrieve all comments (type 210) associated with a contact from Xpand. RTF formatted text is automatically converted to plain text.
   *     tags: [Contacts]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code
   *         example: "P086890"
   *     responses:
   *       200:
   *         description: Successfully retrieved contact comments
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
   *                       contactKey:
   *                         type: string
   *                       contactCode:
   *                         type: string
   *                       commentKey:
   *                         type: string
   *                       id:
   *                         type: integer
   *                       commentType:
   *                         type: string
   *                         nullable: true
   *                         description: Comment type/category name
   *                       notes:
   *                         type: array
   *                         description: Array of individual notes parsed from comment text
   *                         items:
   *                           type: object
   *                           properties:
   *                             date:
   *                               type: string
   *                               format: date
   *                               nullable: true
   *                               description: Date in YYYY-MM-DD format
   *                             time:
   *                               type: string
   *                               nullable: true
   *                               description: Time in HH:MM format
   *                             author:
   *                               type: string
   *                               description: Author initials (6 letters) or "Notering utan signatur"
   *                             text:
   *                               type: string
   *                               description: Note content (plain text)
   *                       priority:
   *                         type: integer
   *                         nullable: true
   *                       kind:
   *                         type: integer
   *                         nullable: true
   *       404:
   *         description: Contact not found
   *       500:
   *         description: Database error
   */
  router.get('(.*)/contacts/:contactCode/comments', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await contactCommentsAdapter.getContactCommentsByContactCode(
      ctx.params.contactCode
    )

    if (!result.ok) {
      if (result.err === 'contact-not-found') {
        ctx.status = 404
        ctx.body = {
          type: result.err,
          title: 'Contact not found',
          status: 404,
          detail: `No contact found with code: ${ctx.params.contactCode}`,
          ...metadata,
        } satisfies RouteErrorResponse
        return
      }

      ctx.status = 500
      ctx.body = {
        type: 'database-error',
        title: 'Internal server error',
        status: 500,
        ...metadata,
      } satisfies RouteErrorResponse
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
   * /contacts/{contactCode}/comments:
   *   post:
   *     summary: Create or append to contact comment
   *     description: Creates a new comment if none exists, or appends to existing comment
   *     tags:
   *       - Contacts
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *           example: P000047
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - content
   *               - author
   *             properties:
   *               content:
   *                 type: string
   *                 description: Plain text content of the note
   *                 example: Contacted customer regarding payment
   *               author:
   *                 type: string
   *                 description: Author name or code (1-50 characters, any format)
   *                 minLength: 1
   *                 maxLength: 50
   *                 example: DAVLIN
   *     responses:
   *       200:
   *         description: Comment updated successfully
   *       201:
   *         description: Comment created successfully
   *       400:
   *         description: Invalid request body
   *       404:
   *         description: Contact not found
   *       500:
   *         description: Database error
   */
  router.post(
    '(.*)/contacts/:contactCode/comments',
    parseRequestBody(leasing.v1.CreateContactCommentRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { content, author } = ctx.request.body

      const result = await contactCommentsAdapter.upsertContactComment(
        ctx.params.contactCode,
        content,
        author
      )

      if (!result.ok) {
        if (result.err === 'contact-not-found') {
          ctx.status = 404
          ctx.body = {
            type: result.err,
            title: 'Contact not found',
            status: 404,
            detail: `No contact found with code: ${ctx.params.contactCode}`,
            ...metadata,
          } satisfies RouteErrorResponse
          return
        }

        ctx.status = 500
        ctx.body = {
          type: 'database-error',
          title: 'Internal server error',
          status: 500,
          ...metadata,
        } satisfies RouteErrorResponse
        return
      }

      ctx.status = result.data.operation === 'created' ? 201 : 200
      ctx.body = {
        content: result.data.comment,
        ...metadata,
      }
    }
  )
}
