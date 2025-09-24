import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { schemas } from '@onecore/types'
import { z } from 'zod'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'

const TABLE = 'logs'

// Type definitions based on schemas
type CreateLogRequest = z.infer<typeof schemas.CreateLogRequestSchema>
type UpdateLogRequest = z.infer<typeof schemas.UpdateLogRequestSchema>
type LogResponse = z.infer<typeof schemas.LogSchema)

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
 *         userName:
 *           type: string
 *           example: "seb"
 *         eventType:
 *           type: string
 *           enum: [creation, update, delete]
 *           example: "creation"
 *         objectType:
 *           type: string
 *           enum: [key, key_system, key_loan]
 *           example: "key"
 *         eventTime:
 *           type: string
 *           format: date-time
 *         description:
 *           type: string
 *           example: "Created key APT-1001"
 *
 *     CreateLogRequest:
 *       type: object
 *       required: [userName, eventType, objectType]
 *       properties:
 *         userName:
 *           type: string
 *           example: "seb"
 *         eventType:
 *           type: string
 *           enum: [creation, update, delete]
 *           example: "creation"
 *         objectType:
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
 *         userName:
 *           type: string
 *         eventType:
 *           type: string
 *           enum: [creation, update, delete]
 *         objectType:
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
      ctx.body = { content: rows satisfies LogResponse[], ...metadata }
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
      ctx.body = { content: row satisfies LogResponse, ...metadata }
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
  router.post('/logs', parseRequestBody(schemas.CreateLogRequestSchema), async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: CreateLogRequest = ctx.request.body

      const [row] = await db(TABLE).insert(payload).returning('*')
      ctx.status = 201
      ctx.body = { content: row satisfies LogResponse, ...metadata }
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
  router.patch('/logs/:id', parseRequestBody(schemas.UpdateLogRequestSchema), async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: UpdateLogRequest = ctx.request.body

      const [row] = await db(TABLE).where({ id: ctx.params.id }).update(payload).returning('*')
      if (!row) {
        ctx.status = 404;
        ctx.body = { reason: 'Log not found', ...metadata };
        return
      }
      ctx.status = 200
      ctx.body = { content: row satisfies LogResponse, ...metadata }
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
