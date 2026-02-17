import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import * as keyEventsAdapter from '../adapters/key-events-adapter'
import * as keyEventService from '../key-event-service'

const {
  KeyEventSchema,
  CreateKeyEventRequestSchema,
  UpdateKeyEventRequestSchema,
} = keys
type CreateKeyEventRequest = keys.CreateKeyEventRequest
type UpdateKeyEventRequest = keys.UpdateKeyEventRequest

/**
 * @swagger
 * tags:
 *   - name: KeyEvents
 *     description: Operations for key events
 */
export const routes = (router: KoaRouter) => {
  registerSchema('CreateKeyEventRequest', CreateKeyEventRequestSchema)
  registerSchema('UpdateKeyEventRequest', UpdateKeyEventRequestSchema)
  registerSchema('KeyEvent', KeyEventSchema)

  /**
   * @swagger
   * /key-events:
   *   get:
   *     summary: Get all key events
   *     description: Returns all key events ordered by creation date.
   *     tags: [KeyEvents]
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
   */
  router.get('/key-events', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await keyEventsAdapter.getAllKeyEvents(db)

      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key events')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-events/by-key/{keyId}:
   *   get:
   *     summary: Get all key events for a specific key
   *     description: Returns all key events associated with a specific key ID. Optionally limit results to get only the latest event(s).
   *     tags: [KeyEvents]
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
   */
  router.get('/key-events/by-key/:keyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const limit = ctx.query.limit
        ? parseInt(ctx.query.limit as string)
        : undefined
      const rows = await keyEventsAdapter.getKeyEventsByKey(
        ctx.params.keyId,
        db,
        limit
      )

      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key events by key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-events/{id}:
   *   get:
   *     summary: Get key event by ID
   *     description: Fetch a specific key event by its ID.
   *     tags: [KeyEvents]
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
   *       500:
   *         description: An error occurred while fetching the key event.
   */
  router.get('/key-events/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row = await keyEventsAdapter.getKeyEventById(ctx.params.id, db)
      if (!row) {
        ctx.status = 404
        ctx.body = { reason: 'Key event not found', ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key event')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-events:
   *   post:
   *     summary: Create a key event
   *     description: Create a new key event record. Will fail with 409 if any of the keys have an incomplete event (status not COMPLETED).
   *     tags: [KeyEvents]
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
   *       409:
   *         description: Conflict - one or more keys have incomplete events.
   *       500:
   *         description: An error occurred while creating the key event.
   */
  router.post(
    '/key-events',
    parseRequestBody(CreateKeyEventRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: CreateKeyEventRequest = ctx.request.body

        // Validate keys using service layer
        const validationResult = await keyEventService.validateKeyEventCreation(
          payload.keys,
          db
        )

        if (!validationResult.ok) {
          // Map service errors to HTTP responses
          if (validationResult.err === 'incomplete-event-conflict') {
            ctx.status = 409
            ctx.body = {
              reason: 'One or more keys have incomplete events',
              conflictingKeys: validationResult.details?.conflictingKeys,
              ...metadata,
            }
            return
          }

          // All other errors are 400 Bad Request
          const errorMessages = {
            'invalid-keys-format': 'Invalid keys format',
            'empty-keys-array': 'Keys array cannot be empty',
          }

          ctx.status = 400
          ctx.body = {
            reason:
              errorMessages[
                validationResult.err as keyof typeof errorMessages
              ] || 'Invalid keys format',
            ...metadata,
          }
          return
        }

        const row = await keyEventsAdapter.createKeyEvent(payload, db)

        ctx.status = 201
        ctx.body = { content: row, ...metadata }
      } catch (err) {
        logger.error(err, 'Error creating key event')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /key-events/{id}:
   *   put:
   *     summary: Update a key event
   *     description: Update an existing key event.
   *     tags: [KeyEvents]
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
   *       400:
   *         description: Invalid request body.
   *       500:
   *         description: An error occurred while updating the key event.
   */
  router.put(
    '/key-events/:id',
    parseRequestBody(UpdateKeyEventRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: UpdateKeyEventRequest = ctx.request.body
        const row = await keyEventsAdapter.updateKeyEvent(
          ctx.params.id,
          payload,
          db
        )

        if (!row) {
          ctx.status = 404
          ctx.body = { reason: 'Key event not found', ...metadata }
          return
        }

        ctx.status = 200
        ctx.body = { content: row, ...metadata }
      } catch (err) {
        logger.error(err, 'Error updating key event')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )
}
