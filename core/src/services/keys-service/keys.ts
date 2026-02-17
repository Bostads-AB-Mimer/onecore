import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { KeysApi, CardsApi } from '../../adapters/keys-adapter'
import { createLogEntry } from './helpers'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /keys:
   *   get:
   *     summary: List keys with pagination
   *     description: Returns paginated keys ordered by createdAt (desc).
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
   *         description: Paginated list of keys
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
   *                         $ref: '#/components/schemas/KeyDetails'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const page = ctx.query.page ? parseInt(ctx.query.page as string) : undefined
    const limit = ctx.query.limit
      ? parseInt(ctx.query.limit as string)
      : undefined
    const includeKeySystem = ctx.query.includeKeySystem === 'true'

    const result = await KeysApi.list(page, limit, includeKeySystem)

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching keys')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })

  /**
   * @swagger
   * /keys/search:
   *   get:
   *     summary: Search keys
   *     description: |
   *       Search keys with flexible filtering.
   *       - **OR search**: Use `q` with `fields` for multiple field search
   *       - **AND search**: Use any Key field parameter for filtering
   *       - **Comparison operators**: Prefix values with `>`, `<`, `>=`, `<=` for date/number comparisons
   *       - Only one OR group is supported, but you can combine it with multiple AND filters
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
   *         description: Comma-separated list of fields for OR search. Defaults to keyName.
   *       - in: query
   *         name: id
   *         schema:
   *           type: string
   *       - in: query
   *         name: keyName
   *         schema:
   *           type: string
   *       - in: query
   *         name: keySequenceNumber
   *         schema:
   *           type: string
   *       - in: query
   *         name: flexNumber
   *         schema:
   *           type: string
   *       - in: query
   *         name: rentalObjectCode
   *         schema:
   *           type: string
   *       - in: query
   *         name: keyType
   *         schema:
   *           type: string
   *       - in: query
   *         name: keySystemId
   *         schema:
   *           type: string
   *       - in: query
   *         name: createdAt
   *         schema:
   *           type: string
   *       - in: query
   *         name: updatedAt
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Successfully retrieved paginated search results
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
   *                         $ref: '#/components/schemas/KeyDetails'
   *       400:
   *         description: Bad request
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/keys/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    const result = await KeysApi.search(ctx.query)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { reason: 'Invalid search parameters', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error searching keys')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })

  /**
   * @swagger
   * /keys/by-rental-object/{rentalObjectCode}:
   *   get:
   *     summary: Get all keys by rental object code
   *     description: Returns all keys associated with a specific rental object code without pagination
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code to filter keys by
   *     responses:
   *       200:
   *         description: Successfully retrieved keys
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Key'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/keys/by-rental-object/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const includeLoans = ctx.query.includeLoans === 'true'
    const includeEvents = ctx.query.includeEvents === 'true'
    const includeKeySystem = ctx.query.includeKeySystem === 'true'
    const result = await KeysApi.getByRentalObjectCode(
      ctx.params.rentalObjectCode,
      { includeLoans, includeEvents, includeKeySystem }
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching keys by rental object code'
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
   * /cards/by-rental-object/{rentalObjectCode}:
   *   get:
   *     summary: Get cards by rental object code
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: includeLoans
   *         schema:
   *           type: boolean
   *     responses:
   *       200:
   *         description: Cards for the rental object
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CardDetails'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/cards/by-rental-object/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const includeLoans = ctx.query.includeLoans === 'true'
    const result = await CardsApi.getByRentalObjectCode(
      ctx.params.rentalObjectCode,
      { includeLoans }
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching cards by rental object code'
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
   * /cards/{cardId}:
   *   get:
   *     summary: Get card by ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: cardId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Card found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Card'
   *       404:
   *         description: Card not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/cards/:cardId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await CardsApi.getById(ctx.params.cardId)

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching card by ID')
      ctx.status = result.err === 'not-found' ? 404 : 500
      ctx.body = {
        error:
          result.err === 'not-found'
            ? 'Card not found'
            : 'Internal server error',
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys/{id}:
   *   get:
   *     summary: Get key by ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Key found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Key'
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeysApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys:
   *   post:
   *     summary: Create a key
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateKeyRequest'
   *     responses:
   *       201:
   *         description: Created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Key'
   *       400:
   *         description: Invalid key_type
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.post('/keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeysApi.create(payload)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'creation',
      objectType: 'key',
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
   * /keys/bulk-update:
   *   patch:
   *     summary: Bulk update keys
   *     description: Update multiple keys with the same values. Maximum 100 keys per request.
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BulkUpdateKeysRequest'
   *     responses:
   *       200:
   *         description: Keys updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: number
   *                   description: Number of keys updated
   *       400:
   *         description: Invalid request data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.put('/keys/bulk-update', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body as {
      keyIds: string[]
      updates: {
        keyName?: string
        flexNumber?: number | null
        keySystemId?: string | null
        rentalObjectCode?: string
        disposed?: boolean
        notes?: string | null
        clearNotes?: boolean
      }
    }

    const result = await KeysApi.bulkUpdate(payload.keyIds, payload.updates)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error bulk updating keys')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    for (const keyId of payload.keyIds) {
      await createLogEntry(ctx, {
        eventType: 'update',
        objectType: 'key',
        objectId: keyId,
        description: `Massuppdaterad via bulk-uppdatering (${result.data} nycklar)`,
      })
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys/{id}:
   *   patch:
   *     summary: Update a key (partial)
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateKeyRequest'
   *     responses:
   *       200:
   *         description: Updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Key'
   *       400:
   *         description: Invalid key_type
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.put('/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeysApi.update(ctx.params.id, payload)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const isDisposal = payload.disposed === true && result.data.disposed
    const action = isDisposal ? 'Kasserad' : 'Uppdaterad'

    await createLogEntry(ctx, {
      eventType: 'update',
      objectType: 'key',
      objectId: result.data.id,
      autoGenerateDescription: true,
      entityData: result.data,
      action,
    })

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys/{id}:
   *   delete:
   *     summary: Delete a key
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Deleted
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const getResult = await KeysApi.get(ctx.params.id)
    if (!getResult.ok) {
      if (getResult.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }
      logger.error(
        { err: getResult.err, metadata },
        'Error fetching key before deletion'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const result = await KeysApi.remove(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error deleting key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'delete',
      objectType: 'key',
      objectId: ctx.params.id,
      autoGenerateDescription: true,
      entityData: getResult.data,
      action: 'Raderad',
    })

    ctx.status = 200
    ctx.body = { ...metadata }
  })

  /**
   * @swagger
   * /keys/bulk-update-flex:
   *   post:
   *     summary: Bulk update flex number for all keys on a rental object
   *     description: Update the flex number for all keys associated with a specific rental object code. Flex numbers range from 1-3.
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BulkUpdateFlexRequest'
   *     responses:
   *       200:
   *         description: Flex numbers updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: number
   *                   description: Number of keys updated
   *       400:
   *         description: Invalid request data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.post('/keys/bulk-update-flex', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeysApi.bulkUpdateFlex(
      payload.rentalObjectCode,
      payload.flexNumber
    )

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error bulk updating flex')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx, {
      eventType: 'update',
      objectType: 'key',
      description: `Uppdaterade flex-nummer till ${payload.flexNumber} för ${payload.rentalObjectCode} (${result.data} nycklar)`,
    })

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys/bulk-delete:
   *   post:
   *     summary: Bulk delete keys
   *     description: Delete multiple keys by their IDs. Maximum 100 keys per request.
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - keyIds
   *             properties:
   *               keyIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                   format: uuid
   *                 minItems: 1
   *                 maxItems: 100
   *     responses:
   *       200:
   *         description: Keys deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: number
   *                   description: Number of keys deleted
   *       400:
   *         description: Invalid request data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.post('/keys/bulk-delete', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body as { keyIds: string[] }

    const result = await KeysApi.bulkDelete(payload.keyIds)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error bulk deleting keys')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    for (const keyId of payload.keyIds) {
      await createLogEntry(ctx, {
        eventType: 'delete',
        objectType: 'key',
        objectId: keyId,
        description: `Raderad via massradering (${result.data} nycklar)`,
      })
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })
}
