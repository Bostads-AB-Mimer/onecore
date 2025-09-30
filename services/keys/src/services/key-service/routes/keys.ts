import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'

const TABLE = 'keys'

const { KeySchema, CreateKeyRequestSchema, UpdateKeyRequestSchema } = keys.v1
type CreateKeyRequest = keys.v1.CreateKeyRequest
type UpdateKeyRequest = keys.v1.UpdateKeyRequest

/**
 * @swagger
 * tags:
 *   - name: Keys
 *     description: CRUD operations for keys
 * components:
 *   schemas:
 *     CreateKeyRequest:
 *       $ref: '#/components/schemas/CreateKeyRequest'
 *     UpdateKeyRequest:
 *       $ref: '#/components/schemas/UpdateKeyRequest'
 *     Key:
 *       $ref: '#/components/schemas/Key'
 */
export const routes = (router: KoaRouter) => {
  // Register schemas from @onecore/types
  registerSchema('CreateKeyRequest', CreateKeyRequestSchema)
  registerSchema('UpdateKeyRequest', UpdateKeyRequestSchema)
  registerSchema('Key', KeySchema)
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
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Key'
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
   * /keys/search:
   *   get:
   *     summary: Search keys
   *     description: |
   *       Search keys with flexible filtering.
   *       - **OR search**: Use `q` with `fields` for multiple field search
   *       - **AND search**: Use any Key field parameter for filtering
   *       - **Comparison operators**: Prefix values with `>`, `<`, `>=`, `<=` for date/number comparisons
   *       - Only one OR group is supported, but you can combine it with multiple AND filters
   *
   *       Examples:
   *       - `?createdAt=>2024-01-01` - Created after Jan 1, 2024
   *       - `?keyName=master&createdAt=<2024-12-31` - Key name contains "master" AND created before Dec 31, 2024
   *     tags: [Keys]
   *     parameters:
   *       - in: query
   *         name: q
   *         required: false
   *         schema:
   *           type: string
   *           minLength: 3
   *         description: Search query for OR search across fields specified in 'fields' parameter
   *       - in: query
   *         name: fields
   *         required: false
   *         schema:
   *           type: string
   *         description: Comma-separated list of fields for OR search (e.g., "keyName,keyType"). Defaults to keyName.
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
   *         description: Successfully retrieved search results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Key'
   *       400:
   *         description: Bad request. Invalid parameters or field names
   *       500:
   *         description: Internal server error
   */
  router.get('/keys/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    try {
      let query = db(TABLE).select('*')

      // Handle OR search (q with fields)
      if (typeof ctx.query.q === 'string' && ctx.query.q.trim().length >= 3) {
        const searchTerm = ctx.query.q.trim()

        // Get fields to search across (OR condition)
        let fieldsToSearch: string[] = []

        if (typeof ctx.query.fields === 'string') {
          fieldsToSearch = ctx.query.fields.split(',').map(f => f.trim())
        } else {
          fieldsToSearch = ['keyName']
        }

        // Add OR conditions
        query = query.where((builder) => {
          fieldsToSearch.forEach((field, index) => {
            if (index === 0) {
              builder.where(field, 'like', `%${searchTerm}%`)
            } else {
              builder.orWhere(field, 'like', `%${searchTerm}%`)
            }
          })
        })
      }

      // Handle AND search (individual field parameters) - search any param that's not q or fields
      const reservedParams = ['q', 'fields']
      for (const [field, value] of Object.entries(ctx.query)) {
        if (!reservedParams.includes(field) && typeof value === 'string' && value.trim().length > 0) {
          const trimmedValue = value.trim()

          // Check if value starts with a comparison operator (>=, <=, >, <)
          const operatorMatch = trimmedValue.match(/^(>=|<=|>|<)(.+)$/)

          if (operatorMatch) {
            const operator = operatorMatch[1]
            const compareValue = operatorMatch[2].trim()
            query = query.where(field, operator, compareValue)
          } else {
            // No operator, use LIKE for partial matching
            query = query.where(field, 'like', `%${trimmedValue}%`)
          }
        }
      }

      // Check if at least one search criteria was provided
      const hasQParam = typeof ctx.query.q === 'string' && ctx.query.q.trim().length >= 3
      const hasFieldParams = Object.entries(ctx.query).some(([key, value]) =>
        !reservedParams.includes(key) && typeof value === 'string' && value.trim().length > 0
      )

      if (!hasQParam && !hasFieldParams) {
        ctx.status = 400
        ctx.body = { reason: 'At least one search parameter is required', ...metadata }
        return
      }

      const rows = await query
        .orderBy('keyName', 'asc')
        .limit(10)

      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error searching keys')
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
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Key'
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
   *             $ref: '#/components/schemas/CreateKeyRequest'
   *     responses:
   *       201:
   *         description: Key created successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Key'
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
  router.post(
    '/keys',
    parseRequestBody(CreateKeyRequestSchema),
    async (ctx) => {
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
    }
  )

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
   *             $ref: '#/components/schemas/UpdateKeyRequest'
   *     responses:
   *       200:
   *         description: Key updated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Key'
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
  router.patch(
    '/keys/:id',
    parseRequestBody(UpdateKeyRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: UpdateKeyRequest = ctx.request.body

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
    }
  )

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
