import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { schemas } from '@onecore/types'
import { z } from 'zod'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'

const TABLE = 'keys'

// Type definitions based on schemas (like applicants does)
type CreateKeyRequest = z.infer<typeof schemas.CreateKeyRequestSchema>
type UpdateKeyRequest = z.infer<typeof schemas.UpdateKeyRequestSchema>

/**
 * @swagger
 * tags:
 *   - name: Keys
 *     description: CRUD operations for keys
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
   *         description: A list of keys.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       500:
   *         description: An error occurred while listing keys.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.get('/keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await db(TABLE).select('*').orderBy('created_at', 'desc')
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
   *     description: Fetch a specific key by its ID.
   *     tags: [Keys]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key to retrieve.
   *     responses:
   *       200:
   *         description: A key object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       404:
   *         description: Key not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Key not found
   *       500:
   *         description: An error occurred while fetching the key.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
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
   *     description: Create a new key record.
   *     tags: [Keys]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               key_name:
   *                 type: string
   *                 description: The name of the key.
   *                 example: "Front door A"
   *               key_type:
   *                 type: string
   *                 enum: [LGH, PB, FS, HN]
   *                 description: The type of key.
   *                 example: "LGH"
   *               key_sequence_number:
   *                 type: number
   *                 description: The sequence number of the key.
   *                 example: 101
   *               flex_number:
   *                 type: number
   *                 description: The flex number of the key.
   *                 example: 1
   *               rental_object:
   *                 type: string
   *                 description: The rental object associated with the key.
   *                 example: "APT-1001"
   *               key_system_id:
   *                 type: string
   *                 description: The key system ID.
   *                 example: "123e4567-e89b-12d3-a456-426614174000"
   *             required: [key_name, key_type]
   *     responses:
   *       201:
   *         description: Key created successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       400:
   *         description: Invalid request body.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Invalid request body
   *       500:
   *         description: An error occurred while creating the key.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.post('/keys', parseRequestBody(schemas.CreateKeyRequestSchema), async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: CreateKeyRequest = ctx.request.body

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
   *     summary: Update a key
   *     description: Partially update an existing key.
   *     tags: [Keys]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key to update.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               key_name:
   *                 type: string
   *                 description: The name of the key.
   *                 example: "Front door A (updated)"
   *               key_type:
   *                 type: string
   *                 enum: [LGH, PB, FS, HN]
   *                 description: The type of key.
   *                 example: "LGH"
   *               key_sequence_number:
   *                 type: number
   *                 description: The sequence number of the key.
   *                 example: 102
   *               flex_number:
   *                 type: number
   *                 description: The flex number of the key.
   *                 example: 2
   *               rental_object:
   *                 type: string
   *                 description: The rental object associated with the key.
   *                 example: "APT-1002"
   *               key_system_id:
   *                 type: string
   *                 description: The key system ID.
   *                 example: "123e4567-e89b-12d3-a456-426614174000"
   *     responses:
   *       200:
   *         description: Key updated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       404:
   *         description: Key not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Key not found
   *       400:
   *         description: Invalid request body.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Invalid request body
   *       500:
   *         description: An error occurred while updating the key.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.patch('/keys/:id', parseRequestBody(schemas.UpdateKeyRequestSchema), async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: UpdateKeyRequest = ctx.request.body

      const [row] = await db(TABLE)
        .where({ id: ctx.params.id })
        .update({ ...payload, updated_at: db.fn.now() })
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
   *     description: Delete an existing key by ID.
   *     tags: [Keys]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key to delete.
   *     responses:
   *       200:
   *         description: Key deleted successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       404:
   *         description: Key not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Key not found
   *       500:
   *         description: An error occurred while deleting the key.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
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