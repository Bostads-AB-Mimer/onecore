import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { KeyEventsApi } from '../../adapters/keys-adapter'
import { createLogEntry } from './helpers'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /key-events:
   *   get:
   *     summary: Get all key events
   *     description: Returns all key events ordered by creation date.
   *     tags: [Keys Service]
   *     responses:
   *       200:
   *         description: List of key events.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyEvent'
   *       500:
   *         description: An error occurred while fetching key events.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/key-events', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyEventsApi.list()

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching key events')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-events/by-key/{keyId}:
   *   get:
   *     summary: Get all key events for a specific key
   *     description: Returns all key events associated with a specific key ID. Optionally limit results to get only the latest event(s).
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: keyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key ID to filter events by.
   *       - in: query
   *         name: limit
   *         required: false
   *         schema:
   *           type: integer
   *         description: Optional limit on number of results (e.g., 1 for latest event only).
   *     responses:
   *       200:
   *         description: List of key events for the key.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyEvent'
   *       500:
   *         description: An error occurred while fetching key events.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/key-events/by-key/:keyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyEventsApi.getByKey(ctx.params.keyId, ctx.query)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching key events by key'
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
   * /key-events/{id}:
   *   get:
   *     summary: Get key event by ID
   *     description: Fetch a specific key event by its ID.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key event to retrieve.
   *     responses:
   *       200:
   *         description: A key event object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyEvent'
   *       404:
   *         description: Key event not found.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: An error occurred while fetching the key event.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/key-events/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyEventsApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key event not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching key event')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-events:
   *   post:
   *     summary: Create a key event
   *     description: Create a new key event record. Will fail with 409 if any of the keys have an incomplete event (status not COMPLETED).
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateKeyEventRequest'
   *     responses:
   *       201:
   *         description: Key event created successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyEvent'
   *       400:
   *         description: Invalid request body.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: Conflict - one or more keys have incomplete events.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                 conflictingKeys:
   *                   type: array
   *                   items:
   *                     type: string
   *       500:
   *         description: An error occurred while creating the key event.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post('/key-events', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyEventsApi.create(ctx.request.body)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request body', ...metadata }
        return
      }

      if (result.err === 'conflict') {
        logger.error({ metadata }, 'Conflict creating key event')
        ctx.status = 409
        ctx.body = { error: 'Conflict creating key event', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key event')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const keyEvent = result.data
    const requestKeys = ctx.request.body?.keys
    const keyCount = Array.isArray(requestKeys) ? requestKeys.length : 0

    const eventTypeLabel =
      keyEvent.type === 'FLEX'
        ? 'Flex'
        : keyEvent.type === 'ORDER'
          ? 'Extranyckel'
          : 'Bortappad'
    const description = `Skapad ${eventTypeLabel}-händelse för ${keyCount} ${keyCount === 1 ? 'nyckel' : 'nycklar'}, status: ${keyEvent.status}`

    await createLogEntry(ctx, {
      eventType: 'creation',
      objectType: 'keyEvent',
      objectId: keyEvent.id,
      description,
    })

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-events/{id}:
   *   patch:
   *     summary: Update a key event
   *     description: Update an existing key event.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key event to update.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateKeyEventRequest'
   *     responses:
   *       200:
   *         description: Key event updated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyEvent'
   *       404:
   *         description: Key event not found.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       400:
   *         description: Invalid request body.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: An error occurred while updating the key event.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.put('/key-events/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyEventsApi.update(ctx.params.id, ctx.request.body)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key event not found', ...metadata }
        return
      }

      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request body', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key event')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const keyEvent = result.data
    const requestKeysForUpdate = ctx.request.body?.keys
    const keyCount = Array.isArray(requestKeysForUpdate)
      ? requestKeysForUpdate.length
      : 0

    const eventTypeLabel =
      keyEvent.type === 'FLEX'
        ? 'Flex'
        : keyEvent.type === 'ORDER'
          ? 'Extranyckel'
          : 'Bortappad'
    const statusLabel =
      keyEvent.status === 'ORDERED'
        ? 'Beställd'
        : keyEvent.status === 'RECEIVED'
          ? 'Inkommen'
          : 'Klar'
    const description = `Uppdaterat ${eventTypeLabel}-händelse (status: ${statusLabel}) för ${keyCount} ${keyCount === 1 ? 'nyckel' : 'nycklar'}`

    await createLogEntry(ctx, {
      eventType: 'update',
      objectType: 'keyEvent',
      objectId: ctx.params.id,
      description,
    })

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })
}
