import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'

const TABLE = 'key_systems'

const {
  KeySystemSchema,
  CreateKeySystemRequestSchema,
  UpdateKeySystemRequestSchema,
} = keys.v1
type CreateKeySystemRequest = keys.v1.CreateKeySystemRequest
type UpdateKeySystemRequest = keys.v1.UpdateKeySystemRequest
type KeySystem = keys.v1.KeySystem

/**
 * @swagger
 * tags:
 *   - name: Key Systems
 *     description: Endpoints for managing key systems
 * components:
 *   schemas:
 *     CreateKeySystemRequest:
 *       $ref: '#/components/schemas/CreateKeySystemRequest'
 *     UpdateKeySystemRequest:
 *       $ref: '#/components/schemas/UpdateKeySystemRequest'
 *     KeySystem:
 *       $ref: '#/components/schemas/KeySystem'
 */
export const routes = (router: KoaRouter) => {
  // Register schemas from @onecore/types
  registerSchema('CreateKeySystemRequest', CreateKeySystemRequestSchema)
  registerSchema('UpdateKeySystemRequest', UpdateKeySystemRequestSchema)
  registerSchema('KeySystem', KeySystemSchema)
  /**
   * @swagger
   * /key-systems:
   *   get:
   *     summary: List all key systems
   *     description: Retrieve a list of all key systems
   *     tags: [Key Systems]
   *     responses:
   *       200:
   *         description: Successfully retrieved key systems
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                     description: Key system details
   *       500:
   *         description: Internal server error
   */
  router.get('/key-systems', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await db(TABLE).select('*').orderBy('createdAt', 'desc')
      ctx.status = 200
      ctx.body = { content: rows satisfies KeySystem[], ...metadata }
    } catch (err) {
      logger.error(err, 'Error listing key systems')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-systems/search:
   *   get:
   *     summary: Search key systems
   *     description: |
   *       Search key systems with flexible filtering:
   *       - OR search: Use `q` with `fields` to search across multiple fields
   *       - AND search: Use individual field parameters (systemCode, manufacturer, etc.)
   *       - Combined: Use both OR and AND conditions together
   *     tags: [Key Systems]
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
   *         description: Comma-separated list of fields for OR search (e.g., "systemCode,manufacturer"). Defaults to systemCode if not specified.
   *       - in: query
   *         name: systemCode
   *         required: false
   *         schema:
   *           type: string
   *         description: Filter by systemCode (AND condition)
   *       - in: query
   *         name: manufacturer
   *         required: false
   *         schema:
   *           type: string
   *         description: Filter by manufacturer (AND condition)
   *       - in: query
   *         name: managingSupplier
   *         required: false
   *         schema:
   *           type: string
   *         description: Filter by managingSupplier (AND condition)
   *       - in: query
   *         name: description
   *         required: false
   *         schema:
   *           type: string
   *         description: Filter by description (AND condition)
   *       - in: query
   *         name: propertyIds
   *         required: false
   *         schema:
   *           type: string
   *         description: Filter by propertyIds (AND condition)
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
   *                     $ref: '#/components/schemas/KeySystem'
   *       400:
   *         description: Bad request. Invalid parameters or field names
   *       500:
   *         description: Internal server error
   */
  router.get('/key-systems/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields', 'systemCode', 'manufacturer', 'managingSupplier', 'description', 'propertyIds'])
    const allowedFields = ['systemCode', 'manufacturer', 'managingSupplier', 'description', 'propertyIds']

    try {
      let query = db(TABLE).select('*').where('isActive', true)

      // Handle OR search (q with fields)
      if (typeof ctx.query.q === 'string' && ctx.query.q.trim().length >= 3) {
        const searchTerm = ctx.query.q.trim()

        // Get fields to search across (OR condition)
        let fieldsToSearch: string[] = []

        if (typeof ctx.query.fields === 'string') {
          // Multiple fields (comma-separated)
          fieldsToSearch = ctx.query.fields.split(',').map(f => f.trim())
        } else {
          // Default to systemCode
          fieldsToSearch = ['systemCode']
        }

        // Validate all fields
        for (const field of fieldsToSearch) {
          if (!allowedFields.includes(field)) {
            ctx.status = 400
            ctx.body = { reason: `Invalid field: ${field}. Allowed: ${allowedFields.join(', ')}`, ...metadata }
            return
          }
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

      // Handle AND search (individual field parameters)
      for (const field of allowedFields) {
        const value = ctx.query[field]
        if (typeof value === 'string' && value.trim().length > 0) {
          query = query.where(field, 'like', `%${value.trim()}%`)
        }
      }

      // Check if at least one search criteria was provided
      const hasQParam = typeof ctx.query.q === 'string' && ctx.query.q.trim().length >= 3
      const hasFieldParams = allowedFields.some(field =>
        typeof ctx.query[field] === 'string' && ctx.query[field].trim().length > 0
      )

      if (!hasQParam && !hasFieldParams) {
        ctx.status = 400
        ctx.body = { reason: 'At least one search parameter is required', ...metadata }
        return
      }

      const rows = await query
        .orderBy('systemCode', 'asc')
        .limit(10)

      ctx.status = 200
      ctx.body = { content: rows satisfies KeySystem[], ...metadata }
    } catch (err) {
      logger.error(err, 'Error searching key systems')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-systems/{id}:
   *   get:
   *     summary: Get key system by ID
   *     description: Retrieve a specific key system by its ID
   *     tags: [Key Systems]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the key system
   *     responses:
   *       200:
   *         description: Successfully retrieved key system
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   description: Key system details
   *       404:
   *         description: Key system not found
   *       500:
   *         description: Internal server error
   */
  router.get('/key-systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row = await db(TABLE).where({ id: ctx.params.id }).first()
      if (!row) {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { content: row satisfies KeySystem, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-systems:
   *   post:
   *     summary: Create a new key system
   *     description: Create a new key system
   *     tags: [Key Systems]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateKeySystemRequest'
   *     responses:
   *       201:
   *         description: Key system created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   description: Created key system details
   *       400:
   *         description: Invalid type
   *       409:
   *         description: Key system with this system code already exists
   *       500:
   *         description: Internal server error
   */
  router.post(
    '/key-systems',
    parseRequestBody(CreateKeySystemRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: CreateKeySystemRequest = ctx.request.body

        // Check for duplicate systemCode
        if (payload.systemCode) {
          const existing = await db(TABLE)
            .where({ systemCode: payload.systemCode })
            .first()
          if (existing) {
            ctx.status = 409
            ctx.body = {
              error: 'Key system with this system code already exists',
              ...metadata,
            }
            return
          }
        }

        const [row] = await db(TABLE).insert(payload).returning('*')
        ctx.status = 201
        ctx.body = { content: row satisfies KeySystem, ...metadata }
      } catch (err) {
        logger.error(err, 'Error creating key system')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /key-systems/{id}:
   *   patch:
   *     summary: Update a key system
   *     description: Partially update a key system
   *     tags: [Key Systems]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the key system to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateKeySystemRequest'
   *     responses:
   *       200:
   *         description: Key system updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   description: Updated key system details
   *       400:
   *         description: Invalid type
   *       404:
   *         description: Key system not found
   *       409:
   *         description: Key system with this system code already exists
   *       500:
   *         description: Internal server error
   */
  router.patch(
    '/key-systems/:id',
    parseRequestBody(UpdateKeySystemRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: UpdateKeySystemRequest = ctx.request.body

        // Check for duplicate systemCode if being updated
        if (payload.systemCode) {
          const existing = await db(TABLE)
            .where({ systemCode: payload.systemCode })
            .whereNot({ id: ctx.params.id })
            .first()
          if (existing) {
            ctx.status = 409
            ctx.body = {
              error: 'Key system with this system code already exists',
              ...metadata,
            }
            return
          }
        }

        const [row] = await db(TABLE)
          .where({ id: ctx.params.id })
          .update({ ...payload, updatedAt: db.fn.now() })
          .returning('*')

        if (!row) {
          ctx.status = 404
          ctx.body = { reason: 'Key system not found', ...metadata }
          return
        }

        ctx.status = 200
        ctx.body = { content: row satisfies KeySystem, ...metadata }
      } catch (err) {
        logger.error(err, 'Error updating key system')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /key-systems/{id}:
   *   delete:
   *     summary: Delete a key system
   *     description: Delete a key system by ID
   *     tags: [Key Systems]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the key system to delete
   *     responses:
   *       200:
   *         description: Key system deleted successfully
   *       404:
   *         description: Key system not found
   *       500:
   *         description: Internal server error
   */
  router.delete('/key-systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const n = await db(TABLE).where({ id: ctx.params.id }).del()
      if (!n) {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { ...metadata }
    } catch (err) {
      logger.error(err, 'Error deleting key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
