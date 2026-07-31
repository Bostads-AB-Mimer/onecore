import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { communication } from '@onecore/types'

import * as communicationAdapter from '../../adapters/communication-adapter'
import { registerSchema } from '../../utils/openapi'

/**
 * Read-side routes for the communication log: customer timeline, dispatch
 * search/list, a single dispatch, and paginated recipients. Split out of the
 * main communication-service routes (sends, webhooks, schedule mutations).
 */
export const logReadRoutes = (router: KoaRouter) => {
  registerSchema('CustomerMessage', communication.CustomerMessageSchema)
  registerSchema(
    'DispatchWithRecipients',
    communication.DispatchWithRecipientsSchema
  )
  registerSchema('DispatchListItem', communication.DispatchListItemSchema)

  /**
   * @swagger
   * /communication-log/customers/{contactCode}/messages:
   *   get:
   *     summary: Get the communication timeline for a customer
   *     description: Returns every message_recipient row owned by the given contactCode, each paired with its parent dispatch. Newest first.
   *     tags:
   *       - Communication service
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: Customer id (contactCode)
   *     responses:
   *       '200':
   *         description: Array of (dispatch + recipient) pairs, newest first
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CustomerMessage'
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '(.*)/communication-log/customers/:contactCode/messages',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const result = await communicationAdapter.getCustomerMessages(
        ctx.params.contactCode
      )

      if (result.ok) {
        ctx.status = 200
        ctx.body = { content: result.data, ...metadata }
      } else {
        ctx.status = result.statusCode ?? 500
        ctx.body = { error: result.err, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /communication-log/dispatches:
   *   get:
   *     summary: Search and list dispatches
   *     description: Paginated dispatch search. Filters by content (q), channel, messageType, derived status, source (manual/automatic), sendAt range, contactCode, minRecipients, and audience codes (district/building/area). Newest first by default.
   *     tags:
   *       - Communication service
   *     responses:
   *       '200':
   *         description: Paginated dispatches
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/DispatchListItem'
   *                 _meta:
   *                   type: object
   *                 _links:
   *                   type: array
   *                   items:
   *                     type: object
   *       '400':
   *         description: Invalid query parameters
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/communication-log/dispatches', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await communicationAdapter.searchDispatches(
      ctx.query as Record<string, string | string[] | undefined>
    )

    if (result.ok) {
      ctx.status = 200
      ctx.body = result.data
    } else {
      ctx.status = result.statusCode ?? 500
      ctx.body = { error: result.err, ...metadata }
    }
  })

  /**
   * @swagger
   * /communication-log/dispatches/{id}/recipients:
   *   get:
   *     summary: Paginated recipients of a dispatch
   *     description: Page through a dispatch's recipients, optionally filtered by status or a toAddress/contactCode substring. Use instead of the full dispatch-by-id read for large bulks.
   *     tags:
   *       - Communication service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Dispatch id (UUID)
   *     responses:
   *       '200':
   *         description: Paginated recipients
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '(.*)/communication-log/dispatches/:id/recipients',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const result = await communicationAdapter.getDispatchRecipients(
        ctx.params.id,
        ctx.query as Record<string, string | string[] | undefined>
      )

      if (result.ok) {
        ctx.status = 200
        ctx.body = result.data
      } else {
        ctx.status = result.statusCode ?? 500
        ctx.body = { error: result.err, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /communication-log/dispatches/{id}:
   *   get:
   *     summary: Get a dispatch and its recipients by dispatch id
   *     tags:
   *       - Communication service
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Dispatch id (UUID)
   *     responses:
   *       '200':
   *         description: Dispatch + recipients
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/DispatchWithRecipients'
   *       '404':
   *         description: Dispatch not found
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/communication-log/dispatches/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await communicationAdapter.getDispatchById(ctx.params.id)

    if (result.ok) {
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } else {
      ctx.status = result.statusCode ?? 500
      ctx.body = { error: result.err, ...metadata }
    }
  })
}
