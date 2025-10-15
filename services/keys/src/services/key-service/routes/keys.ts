import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { paginate } from '../../../utils/pagination'

const TABLE = 'keys'

const {
  KeySchema,
  CreateKeyRequestSchema,
  UpdateKeyRequestSchema,
  BulkUpdateFlexRequestSchema,
  PaginationMetaSchema,
  PaginationLinksSchema,
  createPaginatedResponseSchema,
} = keys.v1
type CreateKeyRequest = keys.v1.CreateKeyRequest
type UpdateKeyRequest = keys.v1.UpdateKeyRequest
type BulkUpdateFlexRequest = keys.v1.BulkUpdateFlexRequest

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
  registerSchema('BulkUpdateFlexRequest', BulkUpdateFlexRequestSchema)
  registerSchema('Key', KeySchema)
  registerSchema('PaginationMeta', PaginationMetaSchema)
  registerSchema('PaginationLinks', PaginationLinksSchema)
  registerSchema(
    'PaginatedKeysResponse',
    createPaginatedResponseSchema(KeySchema)
  )
  /**
   * @swagger
   * /keys:
   *   get:
   *     summary: List keys with pagination
   *     description: Returns paginated keys ordered by createdAt (desc).
   *     tags: [Keys]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number (starts from 1)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 20
   *         description: Number of records per page
   *     responses:
   *       200:
   *         description: A paginated list of keys.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedKeysResponse'
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
      const query = db(TABLE).select('*').orderBy('createdAt', 'desc')
      const paginatedResult = await paginate(query, ctx)

      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult }
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
   *     summary: Search keys with pagination
   *     description: |
   *       Search keys with flexible filtering and pagination support.
   *       - **OR search**: Use `q` with `fields` for fuzzy LIKE search across multiple fields
   *       - **AND search**: Use any Key field parameter for exact match filtering (uses strict equality)
   *       - **Comparison operators**: Prefix values with `>`, `<`, `>=`, `<=` for date/number comparisons
   *       - Only one OR group is supported, but you can combine it with multiple AND filters
   *
   *       Examples:
   *       - `?q=master&fields=keyName` - Fuzzy search for "master" in keyName
   *       - `?keyType=LGH` - Exact match for keyType = 'LGH'
   *       - `?disposed=true` - Show only disposed keys
   *       - `?createdAt=>2024-01-01` - Created after Jan 1, 2024
   *       - `?keyType=LGH&createdAt=<2024-12-31` - Exact keyType AND created before Dec 31, 2024
   *     tags: [Keys]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number (starts from 1)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 20
   *         description: Number of records per page
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
          fieldsToSearch = ctx.query.fields.split(',').map((f) => f.trim())
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
      const reservedParams = ['q', 'fields', 'page', 'limit']
      for (const [field, value] of Object.entries(ctx.query)) {
        if (!reservedParams.includes(field)) {
          const values = Array.isArray(value) ? value : [value]

          for (const val of values) {
            if (typeof val === 'string' && val.trim().length > 0) {
              const trimmedValue = val.trim()

              // Check if value starts with a comparison operator (>=, <=, >, <)
              const operatorMatch = trimmedValue.match(/^(>=|<=|>|<)(.+)$/)

              if (operatorMatch) {
                const operator = operatorMatch[1]
                const compareValue = operatorMatch[2].trim()
                query = query.where(field, operator, compareValue)
              } else {
                // Use strict equality for all AND filters (better performance and matches UI behavior)
                query = query.where(field, '=', trimmedValue)
              }
            }
          }
        }
      }

      // Check if at least one search criteria was provided
      const hasQParam =
        typeof ctx.query.q === 'string' && ctx.query.q.trim().length >= 3
      const hasFieldParams = Object.entries(ctx.query).some(([key, value]) => {
        if (reservedParams.includes(key)) return false
        if (typeof value === 'string' && value.trim().length > 0) {
          return true
        }
        if (
          Array.isArray(value) &&
          value.some((v) => typeof v === 'string' && v.trim().length > 0)
        ) {
          return true
        }
        return false
      })

      if (!hasQParam && !hasFieldParams) {
        ctx.status = 400
        ctx.body = {
          reason: 'At least one search parameter is required',
          ...metadata,
        }
        return
      }

      const paginatedResult = await paginate(
        query.orderBy('keyName', 'asc'),
        ctx
      )

      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult }
    } catch (err) {
      logger.error(err, 'Error searching keys')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /keys/by-rental-object/{rentalObjectCode}:
   *   get:
   *     summary: Get all keys by rental object code
   *     description: Returns all keys associated with a specific rental object code without pagination.
   *     tags: [Keys]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code to filter keys by.
   *     responses:
   *       200:
   *         description: List of keys for the rental object code.
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
   *         description: An error occurred while fetching keys.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.get('/keys/by-rental-object/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await db(TABLE)
        .where({ rentalObjectCode: ctx.params.rentalObjectCode })
        .orderBy('keyName', 'asc')

      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching keys by rental object code')
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

  /**
   * @swagger
   * /keys/bulk-update-flex:
   *   post:
   *     summary: Bulk update flex number for all keys on a rental object
   *     description: Update the flex number for all keys associated with a specific rental object code. Flex numbers range from 1-3.
   *     tags: [Keys]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BulkUpdateFlexRequest'
   *     responses:
   *       200:
   *         description: Flex numbers updated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     updatedCount:
   *                       type: integer
   *                       description: Number of keys updated
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
   *         description: An error occurred while updating keys.
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
    '/keys/bulk-update-flex',
    parseRequestBody(BulkUpdateFlexRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: BulkUpdateFlexRequest = ctx.request.body

        const updatedCount = await db(TABLE)
          .where({ rentalObjectCode: payload.rentalObjectCode })
          .update({
            flexNumber: payload.flexNumber,
            updatedAt: db.fn.now(),
          })

        ctx.status = 200
        ctx.body = { content: { updatedCount }, ...metadata }
      } catch (err) {
        logger.error(err, 'Error bulk updating flex number')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )
}
