import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import * as keyEventsAdapter from '../adapters/key-events-adapter'

const {
  KeyEventSchema,
  CreateKeyEventRequestSchema,
  UpdateKeyEventRequestSchema,
} = keys.v1
type CreateKeyEventRequest = keys.v1.CreateKeyEventRequest
type UpdateKeyEventRequest = keys.v1.UpdateKeyEventRequest

/**
 * @swagger
 * tags:
 *   - name: KeyEvents
 *     description: Operations for key events
 * components:
 *   schemas:
 *     CreateKeyEventRequest:
 *       $ref: '#/components/schemas/CreateKeyEventRequest'
 *     UpdateKeyEventRequest:
 *       $ref: '#/components/schemas/UpdateKeyEventRequest'
 *     KeyEvent:
 *       $ref: '#/components/schemas/KeyEvent'
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

        // Parse keys from the payload (assuming it's a JSON array string like keyLoans)
        let keyIds: string[] = []
        try {
          keyIds = JSON.parse(payload.keys)
        } catch {
          // If parsing fails, treat it as a single key ID
          keyIds = [payload.keys]
        }

        // Check for incomplete events on any of the keys
        const conflictCheck = await keyEventsAdapter.checkIncompleteKeyEvents(
          keyIds,
          db
        )

        if (conflictCheck.hasConflict) {
          ctx.status = 409
          ctx.body = {
            reason: 'One or more keys have incomplete events',
            conflictingKeys: conflictCheck.conflictingKeys,
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
   *   patch:
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
  router.patch(
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
