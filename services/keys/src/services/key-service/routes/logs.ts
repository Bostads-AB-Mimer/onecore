import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'

const TABLE = 'logs'

const { LogSchema, CreateLogRequestSchema, UpdateLogRequestSchema } = keys.v1
type CreateLogRequest = keys.v1.CreateLogRequest
type UpdateLogRequest = keys.v1.UpdateLogRequest
type Log = keys.v1.Log

/**
 * @swagger
 * tags:
 *   - name: Logs
 *     description: CRUD operations for audit logs
 * components:
 *   schemas:
 *     CreateLogRequest:
 *       $ref: '#/components/schemas/CreateLogRequest'
 *     UpdateLogRequest:
 *       $ref: '#/components/schemas/UpdateLogRequest'
 *     Log:
 *       $ref: '#/components/schemas/Log'
 */
export const routes = (router: KoaRouter) => {
  // Register schemas from @onecore/types
  registerSchema('CreateLogRequest', CreateLogRequestSchema)
  registerSchema('UpdateLogRequest', UpdateLogRequestSchema)
  registerSchema('Log', LogSchema)
  /**
   * @swagger
   * /logs:
   *   get:
   *     summary: List logs
   *     description: Returns logs ordered by eventTime (desc).
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
      const rows = await db(TABLE).select('*').orderBy('eventTime', 'desc')
      ctx.status = 200
      ctx.body = { content: rows satisfies Log[], ...metadata }
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
        ctx.status = 404
        ctx.body = { reason: 'Log not found', ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { content: row satisfies Log, ...metadata }
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
  router.post(
    '/logs',
    parseRequestBody(CreateLogRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: CreateLogRequest = ctx.request.body

        const [row] = await db(TABLE).insert(payload).returning('*')
        ctx.status = 201
        ctx.body = { content: row satisfies Log, ...metadata }
      } catch (err) {
        logger.error(err, 'Error creating log')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

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
   *         description: Invalid eventType or objectType
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
  router.patch(
    '/logs/:id',
    parseRequestBody(UpdateLogRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: UpdateLogRequest = ctx.request.body

        const [row] = await db(TABLE)
          .where({ id: ctx.params.id })
          .update(payload)
          .returning('*')
        if (!row) {
          ctx.status = 404
          ctx.body = { reason: 'Log not found', ...metadata }
          return
        }
        ctx.status = 200
        ctx.body = { content: row satisfies Log, ...metadata }
      } catch (err) {
        logger.error(err, 'Error updating log')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

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
        ctx.status = 404
        ctx.body = { reason: 'Log not found', ...metadata }
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
