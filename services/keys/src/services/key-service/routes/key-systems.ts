import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import * as keySystemsAdapter from '../adapters/key-systems-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { paginate } from '../../../utils/pagination'
import { buildSearchQuery } from '../../../utils/search-builder'

const {
  KeySystemSchema,
  CreateKeySystemRequestSchema,
  UpdateKeySystemRequestSchema,
  PaginationMetaSchema,
  PaginationLinksSchema,
  PaginatedResponseSchema,
} = keys
type CreateKeySystemRequest = keys.CreateKeySystemRequest
type UpdateKeySystemRequest = keys.UpdateKeySystemRequest
type KeySystem = keys.KeySystem

/**
 * @swagger
 * tags:
 *   - name: Key Systems
 *     description: Endpoints for managing key systems
 */
export const routes = (router: KoaRouter) => {
  // Register schemas from @onecore/types
  registerSchema('CreateKeySystemRequest', CreateKeySystemRequestSchema)
  registerSchema('UpdateKeySystemRequest', UpdateKeySystemRequestSchema)
  registerSchema('KeySystem', KeySystemSchema)
  registerSchema('PaginationMeta', PaginationMetaSchema)
  registerSchema('PaginationLinks', PaginationLinksSchema)
  registerSchema('PaginatedResponse', PaginatedResponseSchema)
  /**
   * @swagger
   * /key-systems:
   *   get:
   *     summary: List all key systems with pagination
   *     description: Retrieve a paginated list of all key systems
   *     tags: [Key Systems]
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
   *         description: Successfully retrieved key systems
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/PaginatedResponse'
   *                 - type: object
   *                   properties:
   *                     content:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/KeySystem'
   *       500:
   *         description: Internal server error
   */
  router.get('/key-systems', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const query = keySystemsAdapter.getAllKeySystemsQuery(db)
      const paginatedResult = await paginate<KeySystem>(query, ctx)

      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult }
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
   *       Search key systems with flexible filtering.
   *       - **OR search**: Use `q` with `fields` for multiple field search
   *       - **AND search**: Use any KeySystem field parameter for filtering
   *       - **Comparison operators**: Prefix values with `>`, `<`, `>=`, `<=` for date/number comparisons
   *       - Only one OR group is supported, but you can combine it with multiple AND filters
   *
   *       Examples:
   *       - `?createdAt=>2024-01-01` - Created after Jan 1, 2024
   *       - `?manufacturer=assa&createdAt=<2024-12-31` - Manufacturer contains "assa" AND created before Dec 31, 2024
   *     tags: [Key Systems]
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
   *         description: Comma-separated list of fields for OR search (e.g., "systemCode,manufacturer"). Defaults to systemCode.
   *       - in: query
   *         name: id
   *         schema:
   *           type: string
   *       - in: query
   *         name: systemCode
   *         schema:
   *           type: string
   *       - in: query
   *         name: name
   *         schema:
   *           type: string
   *       - in: query
   *         name: manufacturer
   *         schema:
   *           type: string
   *       - in: query
   *         name: managingSupplier
   *         schema:
   *           type: string
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *       - in: query
   *         name: propertyIds
   *         schema:
   *           type: string
   *       - in: query
   *         name: installationDate
   *         schema:
   *           type: string
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: string
   *       - in: query
   *         name: notes
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
   *       - in: query
   *         name: createdBy
   *         schema:
   *           type: string
   *       - in: query
   *         name: updatedBy
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Successfully retrieved paginated search results
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/PaginatedResponse'
   *                 - type: object
   *                   properties:
   *                     content:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/KeySystem'
   *       400:
   *         description: Bad request. Invalid parameters or field names
   *       500:
   *         description: Internal server error
   */
  router.get('/key-systems/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    try {
      const query = keySystemsAdapter.getKeySystemsSearchQuery(db)

      const searchResult = buildSearchQuery(query, ctx, {
        defaultSearchFields: ['systemCode'],
      })

      if (!searchResult.hasSearchParams) {
        ctx.status = 400
        ctx.body = {
          reason: searchResult.error,
          ...metadata,
        }
        return
      }

      const paginatedResult = await paginate(
        query.orderBy('systemCode', 'asc'),
        ctx
      )

      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult }
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
   *                   $ref: '#/components/schemas/KeySystem'
   *       404:
   *         description: Key system not found
   *       500:
   *         description: Internal server error
   */
  router.get('/key-systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row = await keySystemsAdapter.getKeySystemById(ctx.params.id, db)
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
   *                   $ref: '#/components/schemas/KeySystem'
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
          const existing = await keySystemsAdapter.getKeySystemBySystemCode(
            payload.systemCode,
            db
          )
          if (existing) {
            ctx.status = 409
            ctx.body = {
              error: 'Key system with this system code already exists',
              ...metadata,
            }
            return
          }
        }

        const row = await keySystemsAdapter.createKeySystem(payload, db)
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
   *   put:
   *     summary: Update a key system
   *     description: Update a key system
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
   *                   $ref: '#/components/schemas/KeySystem'
   *       400:
   *         description: Invalid type
   *       404:
   *         description: Key system not found
   *       409:
   *         description: Key system with this system code already exists
   *       500:
   *         description: Internal server error
   */
  router.put(
    '/key-systems/:id',
    parseRequestBody(UpdateKeySystemRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: UpdateKeySystemRequest = ctx.request.body

        // Check for duplicate systemCode if being updated
        if (payload.systemCode) {
          const existing = await keySystemsAdapter.getKeySystemBySystemCode(
            payload.systemCode,
            db
          )
          if (existing && existing.id !== ctx.params.id) {
            ctx.status = 409
            ctx.body = {
              error: 'Key system with this system code already exists',
              ...metadata,
            }
            return
          }
        }

        const row = await keySystemsAdapter.updateKeySystem(
          ctx.params.id,
          payload,
          db
        )

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
      const keySystem = await keySystemsAdapter.getKeySystemById(
        ctx.params.id,
        db
      )
      if (!keySystem) {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }

      await keySystemsAdapter.deleteKeySystem(ctx.params.id, db)
      ctx.status = 200
      ctx.body = { ...metadata }
    } catch (err) {
      logger.error(err, 'Error deleting key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
