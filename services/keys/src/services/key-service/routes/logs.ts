import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { db } from '../adapters/db' 

const TABLE = 'logs'
const EVENT_TYPES = new Set(['update', 'creation', 'delete'])
const OBJECT_TYPES = new Set(['key_system', 'key', 'key_loan'])

/**
 * @swagger
 * tags:
 *   - name: Logs
 *     description: CRUD operations for audit logs
 *
 * components:
 *   schemas:
 *     Log:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_name:
 *           type: string
 *           example: "seb"
 *         event_type:
 *           type: string
 *           enum: [creation, update, delete]
 *           example: "creation"
 *         object_type:
 *           type: string
 *           enum: [key, key_system, key_loan]
 *           example: "key"
 *         event_time:
 *           type: string
 *           format: date-time
 *         description:
 *           type: string
 *           example: "Created key APT-1001"
 *
 *     CreateLogRequest:
 *       type: object
 *       required: [user_name, event_type, object_type]
 *       properties:
 *         user_name:
 *           type: string
 *           example: "seb"
 *         event_type:
 *           type: string
 *           enum: [creation, update, delete]
 *           example: "creation"
 *         object_type:
 *           type: string
 *           enum: [key, key_system, key_loan]
 *           example: "key"
 *         description:
 *           type: string
 *           example: "Initial import"
 *
 *     UpdateLogRequest:
 *       type: object
 *       description: Partial update; provide any subset of fields
 *       properties:
 *         user_name:
 *           type: string
 *         event_type:
 *           type: string
 *           enum: [creation, update, delete]
 *         object_type:
 *           type: string
 *           enum: [key, key_system, key_loan]
 *         description:
 *           type: string
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: "Internal server error"
 *
 *     NotFoundResponse:
 *       type: object
 *       properties:
 *         reason:
 *           type: string
 *           example: "Log not found"
 */

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /logs:
   *   get:
   *     summary: List logs
   *     description: Returns logs ordered by event_time (desc).
   *     tags: [Logs]
   *     responses:
   *       200:
   *         description: List of logs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Log'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/logs', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await db(TABLE).select('*').orderBy('event_time', 'desc')
      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error listing logs')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /logs/{id}:
   *   get:
   *     summary: Get log by ID
   *     tags: [Logs]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Log found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Log'
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
   */
  router.get('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row = await db(TABLE).where({ id: ctx.params.id }).first()
      if (!row) { 
        ctx.status = 404; 
        ctx.body = { reason: 'Log not found', ...metadata }; 
        return 
      }
      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /logs:
   *   post:
   *     summary: Create a log
   *     tags: [Logs]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateLogRequest'
   *     responses:
   *       201:
   *         description: Created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Log'
   *       400:
   *         description: Invalid or missing fields
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
   */
  router.post('/logs', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: any = ctx.request.body || {}
      if (typeof payload.event_type === 'string') payload.event_type = payload.event_type.toLowerCase()

      if (!payload.user_name || !EVENT_TYPES.has(payload.event_type) || !OBJECT_TYPES.has(payload.object_type)) {
        ctx.status = 400
        ctx.body = { error: 'Invalid or missing fields: user_name, event_type, object_type', ...metadata }
        return
      }

      const [row] = await db(TABLE).insert(payload).returning('*')
      ctx.status = 201
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error creating log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /logs/{id}:
   *   patch:
   *     summary: Update a log (partial)
   *     tags: [Logs]
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
   *             $ref: '#/components/schemas/UpdateLogRequest'
   *     responses:
   *       200:
   *         description: Updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Log'
   *       400:
   *         description: Invalid event_type or object_type
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
   */
  router.patch('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: any = ctx.request.body || {}
      if (typeof payload.event_type === 'string') payload.event_type = payload.event_type.toLowerCase()
      if (payload.event_type && !EVENT_TYPES.has(payload.event_type)) {
        ctx.status = 400; ctx.body = { error: 'Invalid event_type', ...metadata }; return
      }
      if (payload.object_type && !OBJECT_TYPES.has(payload.object_type)) {
        ctx.status = 400; ctx.body = { error: 'Invalid object_type', ...metadata }; return
      }

      const [row] = await db(TABLE).where({ id: ctx.params.id }).update(payload).returning('*')
      if (!row) { 
        ctx.status = 404; 
        ctx.body = { reason: 'Log not found', ...metadata }; 
        return 
      }
      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error updating log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /logs/{id}:
   *   delete:
   *     summary: Delete a log
   *     tags: [Logs]
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
   */
  router.delete('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const n = await db(TABLE).where({ id: ctx.params.id }).del()
      if (!n) { 
        ctx.status = 404; 
        ctx.body = { reason: 'Log not found', ...metadata }; 
        return 
      }
      ctx.status = 200
      ctx.body = { ...metadata }
    } catch (err) {
      logger.error(err, 'Error deleting log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
