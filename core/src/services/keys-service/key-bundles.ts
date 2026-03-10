import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { KeyBundlesApi } from '../../adapters/keys-adapter'
import { createLogEntry } from './helpers'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /key-bundles:
   *   get:
   *     summary: List key bundles with pagination
   *     description: Fetches a paginated list of all key bundles ordered by name.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number (starts from 1)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 20
   *         description: Number of records per page
   *     responses:
   *       200:
   *         description: A paginated list of key bundles.
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/PaginatedResponse'
   *                 - type: object
   *                   properties:
   *                     content:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/KeyBundle'
   *       500:
   *         description: An error occurred while listing key bundles.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-bundles', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyBundlesApi.list(ctx.query)

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching key bundles')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })

  /**
   * @swagger
   * /key-bundles/search:
   *   get:
   *     summary: Search key bundles with pagination
   *     description: Search key bundles with flexible filtering and pagination.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number (starts from 1)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 20
   *         description: Number of records per page
   *       - in: query
   *         name: q
   *         required: false
   *         schema:
   *           type: string
   *           minLength: 3
   *       - in: query
   *         name: fields
   *         required: false
   *         schema:
   *           type: string
   *         description: Comma-separated list of fields for OR search.
   *     responses:
   *       200:
   *         description: Paginated search results
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/PaginatedResponse'
   *                 - type: object
   *                   properties:
   *                     content:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/KeyBundle'
   *       400:
   *         description: Invalid search parameters
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-bundles/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'q',
      'fields',
      'page',
      'limit',
    ])

    const result = await KeyBundlesApi.search(ctx.query)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { reason: 'Invalid search parameters', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error searching key bundles')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })

  /**
   * @swagger
   * /key-bundles/by-key/{keyId}:
   *   get:
   *     summary: Get all bundles containing a specific key
   *     description: Returns all bundle records containing the specified key ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: keyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key ID to search for
   *     responses:
   *       200:
   *         description: Array of bundles containing this key
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyBundle'
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-bundles/by-key/:keyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyBundlesApi.getByKey(ctx.params.keyId)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching key bundles by key'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-bundles/{id}:
   *   get:
   *     summary: Get key bundle by ID
   *     description: Fetch a specific key bundle by its ID.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key bundle to retrieve.
   *     responses:
   *       200:
   *         description: A key bundle object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyBundle'
   *       404:
   *         description: Key bundle not found.
   *       500:
   *         description: An error occurred while fetching the key bundle.
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-bundles/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyBundlesApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key bundle not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching key bundle')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-bundles:
   *   post:
   *     summary: Create a new key bundle
   *     description: Create a new key bundle record.
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateKeyBundleRequest'
   *     responses:
   *       201:
   *         description: Key bundle created successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyBundle'
   *       400:
   *         description: Invalid request body
   *       500:
   *         description: An error occurred while creating the key bundle.
   *     security:
   *       - bearerAuth: []
   */
  router.post('/key-bundles', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyBundlesApi.create(ctx.request.body)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request body', ...metadata }
        return
      }

      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = { error: 'Conflict creating key bundle', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key bundle')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'creation',
      objectType: 'keyBundle',
      objectId: result.data.id,
      autoGenerateDescription: true,
      entityData: result.data,
      action: 'Skapad',
    })

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-bundles/{id}:
   *   patch:
   *     summary: Update a key bundle
   *     description: Partially update an existing key bundle.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key bundle to update.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateKeyBundleRequest'
   *     responses:
   *       200:
   *         description: Key bundle updated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyBundle'
   *       400:
   *         description: Invalid request body
   *       404:
   *         description: Key bundle not found.
   *       500:
   *         description: An error occurred while updating the key bundle.
   *     security:
   *       - bearerAuth: []
   */
  router.put('/key-bundles/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyBundlesApi.update(ctx.params.id, ctx.request.body)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key bundle not found', ...metadata }
        return
      }

      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request body', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key bundle')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'update',
      objectType: 'keyBundle',
      objectId: ctx.params.id,
      autoGenerateDescription: true,
      entityData: result.data,
      action: 'Uppdaterad',
    })

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-bundles/{id}:
   *   delete:
   *     summary: Delete a key bundle
   *     description: Delete a key bundle by ID.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key bundle to delete.
   *     responses:
   *       204:
   *         description: Key bundle deleted successfully.
   *       404:
   *         description: Key bundle not found.
   *       500:
   *         description: An error occurred while deleting the key bundle.
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/key-bundles/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const getResult = await KeyBundlesApi.get(ctx.params.id)

    if (!getResult.ok) {
      if (getResult.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key bundle not found', ...metadata }
        return
      }
      logger.error(
        { err: getResult.err, metadata },
        'Error fetching key bundle before deletion'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const result = await KeyBundlesApi.remove(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key bundle not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error deleting key bundle')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'delete',
      objectType: 'keyBundle',
      objectId: ctx.params.id,
      autoGenerateDescription: true,
      entityData: getResult.data,
      action: 'Raderad',
    })

    ctx.status = 204
  })

  /**
   * @swagger
   * /key-bundles/{id}/keys-with-loan-status:
   *   get:
   *     summary: Get keys in bundle with maintenance loan status
   *     description: Fetches all keys in a key bundle along with their active maintenance loan information
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The key bundle ID
   *     responses:
   *       200:
   *         description: Bundle information and keys with loan status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyBundleDetailsResponse'
   *       404:
   *         description: Key bundle not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-bundles/:id/keys-with-loan-status', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'includeLoans',
      'includeEvents',
      'includeKeySystem',
    ])

    const result = await KeyBundlesApi.getWithLoanStatus(
      ctx.params.id,
      ctx.query
    )

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key bundle not found', ...metadata }
        return
      }

      logger.error(
        { err: result.err, metadata },
        'Error fetching key bundle with loan status'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-bundles/by-contact/{contactCode}/with-loaned-keys:
   *   get:
   *     summary: Get key bundles with keys loaned to a contact
   *     description: Fetches all key bundles that have keys currently loaned to a specific contact.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code (F-number) to find bundles for
   *     responses:
   *       200:
   *         description: A list of bundles with loaned keys info.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/BundleWithLoanedKeysInfo'
   *       500:
   *         description: An error occurred while fetching bundles.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '/key-bundles/by-contact/:contactCode/with-loaned-keys',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const result = await KeyBundlesApi.getByContactWithLoanedKeys(
        ctx.params.contactCode
      )

      if (!result.ok) {
        logger.error(
          { err: result.err, metadata },
          'Error fetching bundles by contact with loaned keys'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    }
  )
}
