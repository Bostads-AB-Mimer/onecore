import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import * as keysAdapter from '../adapters/keys-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { paginate } from '../../../utils/pagination'
import { buildSearchQuery } from '../../../utils/search-builder'

const {
  KeySchema,
  KeyWithLoanStatusSchema,
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
  registerSchema('KeyWithLoanStatus', KeyWithLoanStatusSchema)
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
      const query = keysAdapter.getAllKeysQuery(db)
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
      const query = keysAdapter.getKeysSearchQuery(db)

      const searchResult = buildSearchQuery(query, ctx, {
        defaultSearchFields: ['keyName'],
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
      const rows = await keysAdapter.getKeysByRentalObject(
        ctx.params.rentalObjectCode,
        db
      )

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
   * /keys/with-loan-status/{rentalObjectCode}:
   *   get:
   *     summary: Get keys with active loan status enriched
   *     description: |
   *       Returns all relevant keys for a rental object with their active loan information
   *       pre-fetched in a single optimized query. This eliminates N+1 query problems.
   *
   *       **Performance**: ~95% faster than fetching keys then looping for loan status.
   *
   *       Optionally include the latest key event for each key by setting includeLatestEvent=true.
   *     tags: [Keys]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code to filter keys by.
   *       - in: query
   *         name: includeLatestEvent
   *         required: false
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include the latest key event for each key in the response.
   *     responses:
   *       200:
   *         description: List of keys with enriched active loan data.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyWithLoanStatus'
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
  router.get('/keys/with-loan-status/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const includeLatestEvent = ctx.query.includeLatestEvent === 'true'
      const rows = await keysAdapter.getKeysWithLoanStatus(
        ctx.params.rentalObjectCode,
        db,
        includeLatestEvent
      )

      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching keys with loan status')
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
      const row = await keysAdapter.getKeyById(ctx.params.id, db)
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

        const row = await keysAdapter.createKey(payload, db)
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

        const row = await keysAdapter.updateKey(ctx.params.id, payload, db)

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
      const n = await keysAdapter.deleteKey(ctx.params.id, db)
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

        const updatedCount = await keysAdapter.bulkUpdateFlexNumber(
          payload.rentalObjectCode,
          payload.flexNumber,
          db
        )

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
