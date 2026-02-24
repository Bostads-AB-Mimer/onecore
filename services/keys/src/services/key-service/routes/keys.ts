import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import * as keysAdapter from '../adapters/keys-adapter'
import { checkActiveKeyLoans } from '../adapters/key-loans-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { paginate } from '../../../utils/pagination'
import { buildSearchQuery } from '../../../utils/search-builder'

const {
  KeySchema,
  KeyDetailsSchema,
  KeySystemSchema,
  KeyLoanSchema,
  CreateKeyRequestSchema,
  UpdateKeyRequestSchema,
  BulkUpdateFlexRequestSchema,
  BulkDeleteKeysRequestSchema,
  BulkUpdateKeysRequestSchema,
  PaginationMetaSchema,
  PaginationLinksSchema,
  PaginatedResponseSchema,
} = keys
type CreateKeyRequest = keys.CreateKeyRequest
type UpdateKeyRequest = keys.UpdateKeyRequest
type BulkUpdateFlexRequest = keys.BulkUpdateFlexRequest
type BulkDeleteKeysRequest = keys.BulkDeleteKeysRequest
type BulkUpdateKeysRequest = keys.BulkUpdateKeysRequest
type Key = keys.Key

/**
 * @swagger
 * tags:
 *   - name: Keys
 *     description: CRUD operations for keys
 */
export const routes = (router: KoaRouter) => {
  // Register schemas from @onecore/types
  registerSchema('CreateKeyRequest', CreateKeyRequestSchema)
  registerSchema('UpdateKeyRequest', UpdateKeyRequestSchema)
  registerSchema('BulkUpdateFlexRequest', BulkUpdateFlexRequestSchema)
  registerSchema('BulkDeleteKeysRequest', BulkDeleteKeysRequestSchema)
  registerSchema('BulkUpdateKeysRequest', BulkUpdateKeysRequestSchema)
  registerSchema('Key', KeySchema)
  registerSchema('KeyDetails', KeyDetailsSchema, {
    KeySystem: KeySystemSchema,
    KeyLoan: KeyLoanSchema,
  })
  registerSchema('KeyLoan', KeyLoanSchema)
  registerSchema('PaginationMeta', PaginationMetaSchema)
  registerSchema('PaginationLinks', PaginationLinksSchema)

  // Generic pagination wrapper (used with allOf in swagger docs)
  registerSchema('PaginatedResponse', PaginatedResponseSchema)
  /**
   * @swagger
   * /keys:
   *   get:
   *     summary: List keys with pagination
   *     description: Returns paginated keys ordered by createdAt (desc). Use includeKeySystem to include key system details in the response.
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
   *         name: includeKeySystem
   *         required: false
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include key system information in the response.
   *     responses:
   *       200:
   *         description: A paginated list of keys. When includeKeySystem=true, each key includes keySystem details.
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
   *                         $ref: '#/components/schemas/KeyDetails'
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
      const includeKeySystem = ctx.query.includeKeySystem === 'true'
      const query = keysAdapter.getAllKeysQuery(db)
      const paginatedResult = await paginate(query, ctx)

      // Fetch and attach key systems after pagination
      if (includeKeySystem && paginatedResult.content.length > 0) {
        const keySystemsById = await keysAdapter.fetchKeySystems(
          paginatedResult.content as Key[],
          db
        )

        paginatedResult.content = paginatedResult.content.map((key: any) => ({
          ...key,
          keySystem: key.keySystemId
            ? keySystemsById.get(key.keySystemId) || null
            : null,
        }))
      }

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
   *           minLength: 2
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
   *       - in: query
   *         name: includeKeySystem
   *         required: false
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include key system information in the response.
   *     responses:
   *       200:
   *         description: Successfully retrieved search results. When includeKeySystem=true, each key includes keySystem details.
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
   *                         $ref: '#/components/schemas/KeyDetails'
   *       400:
   *         description: Bad request. Invalid parameters or field names
   *       500:
   *         description: Internal server error
   */
  router.get('/keys/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    try {
      const includeKeySystem = ctx.query.includeKeySystem === 'true'
      const query = keysAdapter.getKeysSearchQuery(db)

      const searchResult = buildSearchQuery(query, ctx, {
        defaultSearchFields: ['keyName', 'rentalObjectCode'],
        reservedParams: ['q', 'fields', 'page', 'limit', 'includeKeySystem'],
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

      // Fetch and attach key systems after pagination
      if (includeKeySystem && paginatedResult.content.length > 0) {
        const keySystemsById = await keysAdapter.fetchKeySystems(
          paginatedResult.content as Key[],
          db
        )

        paginatedResult.content = paginatedResult.content.map((key: any) => ({
          ...key,
          keySystem: key.keySystemId
            ? keySystemsById.get(key.keySystemId) || null
            : null,
        }))
      }

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
   *     summary: Get all keys by rental object code with optional related data
   *     description: |
   *       Returns all keys associated with a specific rental object code with optional related data.
   *       Use query parameters to include loans, events, and/or key system information.
   *
   *       **Performance**: Optimized single-query fetch eliminates N+1 query problems (~95% faster).
   *     tags: [Keys]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code to filter keys by.
   *       - in: query
   *         name: includeLoans
   *         required: false
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include loans array (active + previous loans) for each key.
   *       - in: query
   *         name: includeEvents
   *         required: false
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include events array (latest event) for each key.
   *       - in: query
   *         name: includeKeySystem
   *         required: false
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include key system information in the response.
   *     responses:
   *       200:
   *         description: List of keys with optional related data (loans, events, keySystem).
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyDetails'
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
      const includeLoans = ctx.query.includeLoans === 'true'
      const includeEvents = ctx.query.includeEvents === 'true'
      const includeKeySystem = ctx.query.includeKeySystem === 'true'
      const rows = await keysAdapter.getKeyDetailsByRentalObject(
        ctx.params.rentalObjectCode,
        db,
        { includeLoans, includeEvents, includeKeySystem }
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
   * /keys/bulk-update:
   *   put:
   *     summary: Update multiple keys by ID
   *     description: Update multiple keys with the same values in a single request. Maximum 100 keys per request. Only provided fields will be updated.
   *     tags: [Keys]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BulkUpdateKeysRequest'
   *     responses:
   *       200:
   *         description: Keys updated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: number
   *                   description: Number of keys updated
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
  router.put(
    '/keys/bulk-update',
    parseRequestBody(BulkUpdateKeysRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: BulkUpdateKeysRequest = ctx.request.body

        const updatedCount = await keysAdapter.bulkUpdateKeys(
          payload.keyIds,
          payload.updates,
          db
        )

        ctx.status = 200
        ctx.body = { content: updatedCount, ...metadata }
      } catch (err) {
        logger.error(err, 'Error bulk updating keys')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /keys/{id}:
   *   put:
   *     summary: Update a key
   *     description: Update an existing key.
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
  router.put(
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
      const key = await keysAdapter.getKeyById(ctx.params.id, db)
      if (!key) {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }

      const NON_DELETABLE_KEY_TYPES = ['HN', 'FS']
      if (NON_DELETABLE_KEY_TYPES.includes(key.keyType)) {
        ctx.status = 403
        ctx.body = {
          error:
            'Keys of type Huvudnyckel or Fastighetsnyckel cannot be deleted',
          ...metadata,
        }
        return
      }

      await keysAdapter.deleteKey(ctx.params.id, db)
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
   *                   type: number
   *                   description: Number of keys updated
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
        ctx.body = { content: updatedCount, ...metadata }
      } catch (err) {
        logger.error(err, 'Error bulk updating flex number')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /keys/bulk-delete:
   *   post:
   *     summary: Delete multiple keys by ID
   *     description: Delete multiple keys in a single request. Maximum 100 keys per request.
   *     tags: [Keys]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BulkDeleteKeysRequest'
   *     responses:
   *       200:
   *         description: Keys deleted successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: number
   *                   description: Number of keys deleted
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
   *       409:
   *         description: One or more keys have active loans and cannot be deleted.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Cannot delete keys with active loans
   *                 conflictingKeys:
   *                   type: array
   *                   items:
   *                     type: string
   *       500:
   *         description: An error occurred while deleting keys.
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
    '/keys/bulk-delete',
    parseRequestBody(BulkDeleteKeysRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: BulkDeleteKeysRequest = ctx.request.body

        const NON_DELETABLE_KEY_TYPES = ['HN', 'FS']
        const keysToDelete = await Promise.all(
          payload.keyIds.map((id) => keysAdapter.getKeyById(id, db))
        )
        const nonDeletableKeys = keysToDelete.filter(
          (key) => key && NON_DELETABLE_KEY_TYPES.includes(key.keyType)
        )

        if (nonDeletableKeys.length > 0) {
          ctx.status = 403
          ctx.body = {
            error:
              'Keys of type Huvudnyckel or Fastighetsnyckel cannot be deleted',
            conflictingKeys: nonDeletableKeys.map((key) => key!.id),
            ...metadata,
          }
          return
        }

        const { hasConflict, conflictingKeys } = await checkActiveKeyLoans(
          payload.keyIds,
          undefined,
          db
        )

        if (hasConflict) {
          ctx.status = 409
          ctx.body = {
            error: 'Cannot delete keys with active loans',
            conflictingKeys,
            ...metadata,
          }
          return
        }

        const deletedCount = await keysAdapter.bulkDeleteKeys(
          payload.keyIds,
          db
        )

        ctx.status = 200
        ctx.body = { content: deletedCount, ...metadata }
      } catch (err) {
        logger.error(err, 'Error bulk deleting keys')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )
}
