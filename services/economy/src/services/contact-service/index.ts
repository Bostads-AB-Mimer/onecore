import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { getContacts } from './service'
import {
  syncContact,
  XledgerDbContact,
} from '../common/adapters/xledger-adapter'
import { SyncContactToEconomySchema } from '@onecore/types'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/contacts', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const contacts = await getContacts()
      ctx.body = makeSuccessResponseBody(contacts, metadata)
    } catch (err: unknown) {
      logger.error(err, 'Error getting contacts')
      ctx.status = 500
    }
  })

  /**
   * @swagger
   * /contacts/{contactCode}/sync:
   *   post:
   *     summary: Sync a contact to Xledger
   *     description: Creates or updates a customer in Xledger based on the provided contact data. If the customer already exists (matched by contactCode), it is updated if any fields have changed. Otherwise, a new customer is created.
   *     tags: [Contacts]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code to sync
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - contactCode
   *               - fullName
   *             properties:
   *               contactCode:
   *                 type: string
   *               fullName:
   *                 type: string
   *               street:
   *                 type: string
   *                 nullable: true
   *               zipCode:
   *                 type: string
   *                 nullable: true
   *               city:
   *                 type: string
   *                 nullable: true
   *               emailAddress:
   *                 type: string
   *                 nullable: true
   *     responses:
   *       200:
   *         description: Contact synced successfully to Xledger
   *       400:
   *         description: Invalid request body
   *       500:
   *         description: Failed to sync contact to Xledger
   */
  router.post('(.*)/contacts/:contactCode/sync', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parseResult = SyncContactToEconomySchema.safeParse(ctx.request.body)

    if (!parseResult.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid request body',
        details: parseResult.error.issues,
        ...metadata,
      }
      return
    }

    const body = parseResult.data
    const { contactCode } = ctx.params as { contactCode: string }

    if (body.contactCode !== contactCode) {
      ctx.status = 400
      ctx.body = {
        error: 'Path contactCode must match body contactCode',
        ...metadata,
      }
      return
    }

    const street = body.street ?? ''

    const dbContact: XledgerDbContact = {
      ContactCode: contactCode,
      FullName: body.fullName,
      StreetAddress: street,
      Street: street,
      PostalCode: body.zipCode ?? '',
      City: body.city ?? '',
      Email: body.emailAddress ?? '',
    }

    try {
      const result = await syncContact(dbContact)

      if (!result.ok) {
        ctx.status = 500
        ctx.body = {
          error: 'Failed to sync contact to Xledger',
          details: result.err,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = {
        ...makeSuccessResponseBody(result.data, metadata),
        skipped: result.data === null,
      }
    } catch (err: unknown) {
      logger.error(err, 'Error syncing contact to Xledger')
      ctx.status = 500
      ctx.body = {
        error: 'Internal server error',
        ...metadata,
      }
    }
  })
}
