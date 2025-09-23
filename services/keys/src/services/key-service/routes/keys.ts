import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { db } from '../adapters/db'

const TABLE = 'keys'
const ALLOWED_KEY_TYPES = new Set(['LGH', 'PB', 'FS', 'HN'])

/**
 * @swagger
 * tags:
 *   - name: Keys
 *     description: CRUD operations for keys
 *
 * components:
 *   schemas:
 *     Key:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         keyName:
 *           type: string
 *         keySequenceNumber:
 *           type: integer
 *         flexNumber:
 *           type: integer
 *         rentalObjectCode:
 *           type: string
 *         keyType:
 *           type: string
 *           enum: [LGH, PB, FS, HN]
 *         keySystemId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     CreateKeyRequest:
 *       type: object
 *       required: [keyName, keyType]
 *       properties:
 *         keyName:
 *           type: string
 *           example: "Front door A"
 *         keySequenceNumber:
 *           type: integer
 *           example: 101
 *         flexNumber:
 *           type: integer
 *           example: 1
 *         rentalObjectCode:
 *           type: string
 *           example: "APT-1001"
 *         keyType:
 *           type: string
 *           enum: [LGH, PB, FS, HN]
 *           example: "LGH"
 *         keySystemId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           example: null
 *
 *     UpdateKeyRequest:
 *       type: object
 *       description: Partial update; provide any subset of fields
 *       properties:
 *         keyName:
 *           type: string
 *           example: "Front door A (updated)"
 *         keySequenceNumber:
 *           type: integer
 *         flexNumber:
 *           type: integer
 *         rentalObjectCode:
 *           type: string
 *         keyType:
 *           type: string
 *           enum: [LGH, PB, FS, HN]
 *         keySystemId:
 *           type: string
 *           format: uuid
 *           nullable: true
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
 *           example: "Key not found"
 */

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /keys:
   *   get:
   *     summary: List keys
   *     description: Returns keys ordered by createdAt (desc).
   *     tags: [Keys]
   *     responses:
   *       200:
   *         description: List of keys
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
   */
  router.get('/keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await db(TABLE).select('*').orderBy('createdAt', 'desc')
      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error listing keys')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /keys/{id}:
   *   get:
   *     summary: Get key by ID
   *     tags: [Keys]
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
   */
  router.get('/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row = await db(TABLE).where({ id: ctx.params.id }).first()
      if (!row) {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /keys:
   *   post:
   *     summary: Create a key
   *     tags: [Keys]
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
   *         description: Invalid keyType
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
  router.post('/keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: any = ctx.request.body || {}

      // Minimal normalization (no zod yet)
      if (typeof payload.keyType === 'string') {
        payload.keyType = payload.keyType.toUpperCase()
      }
      // Optional tiny guard to avoid obvious typos
      if (payload.keyType && !ALLOWED_KEY_TYPES.has(payload.keyType)) {
        ctx.status = 400
        ctx.body = { error: 'Invalid keyType', ...metadata }
        return
      }

      const [row] = await db(TABLE).insert(payload).returning('*')
      ctx.status = 201
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error creating key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /keys/{id}:
   *   patch:
   *     summary: Update a key (partial)
   *     tags: [Keys]
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
   *         description: Invalid keyType
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
  router.patch('/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: any = ctx.request.body || {}

      if (typeof payload.keyType === 'string') {
        payload.keyType = payload.keyType.toUpperCase()
      }
      if (payload.keyType && !ALLOWED_KEY_TYPES.has(payload.keyType)) {
        ctx.status = 400
        ctx.body = { error: 'Invalid keyType', ...metadata }
        return
      }

      const [row] = await db(TABLE)
        .where({ id: ctx.params.id })
        .update({ ...payload, updatedAt: db.fn.now() })
        .returning('*')

      if (!row) {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error updating key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /keys/{id}:
   *   delete:
   *     summary: Delete a key
   *     tags: [Keys]
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
  router.delete('/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const n = await db(TABLE).where({ id: ctx.params.id }).del()
      if (!n) {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { ...metadata }
    } catch (err) {
      logger.error(err, 'Error deleting key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
