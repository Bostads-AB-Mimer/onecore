import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import * as keyBundlesAdapter from '../adapters/key-bundles-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { buildSearchQuery } from '../../../utils/search-builder'
import { paginate } from '../../../utils/pagination'

const {
  KeyBundleSchema,
  BundleWithLoanedKeysInfoSchema,
  CreateKeyBundleRequestSchema,
  UpdateKeyBundleRequestSchema,
  PaginationMetaSchema,
  PaginationLinksSchema,
  PaginatedResponseSchema,
} = keys.v1
type CreateKeyBundleRequest = keys.v1.CreateKeyBundleRequest
type UpdateKeyBundleRequest = keys.v1.UpdateKeyBundleRequest
type KeyBundleResponse = keys.v1.KeyBundle

/**
 * @swagger
 * tags:
 *   - name: Key Bundles
 *     description: Endpoints related to key bundle operations
 * components:
 *   schemas:
 *     CreateKeyBundleRequest:
 *       $ref: '#/components/schemas/CreateKeyBundleRequest'
 *     UpdateKeyBundleRequest:
 *       $ref: '#/components/schemas/UpdateKeyBundleRequest'
 *     KeyBundle:
 *       $ref: '#/components/schemas/KeyBundle'
 */
export const routes = (router: KoaRouter) => {
  // Register schemas from @onecore/types
  registerSchema('CreateKeyBundleRequest', CreateKeyBundleRequestSchema)
  registerSchema('UpdateKeyBundleRequest', UpdateKeyBundleRequestSchema)
  registerSchema('KeyBundle', KeyBundleSchema)
  registerSchema('BundleWithLoanedKeysInfo', BundleWithLoanedKeysInfoSchema)
  registerSchema('PaginationMeta', PaginationMetaSchema)
  registerSchema('PaginationLinks', PaginationLinksSchema)
  registerSchema('PaginatedResponse', PaginatedResponseSchema)

  /**
   * @swagger
   * /key-bundles:
   *   get:
   *     summary: List key bundles with pagination
   *     description: Fetches a paginated list of all key bundles ordered by name.
   *     tags: [Key Bundles]
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
   *         description: A paginated list of key bundles.
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
   *                         $ref: '#/components/schemas/KeyBundle'
   *       500:
   *         description: An error occurred while listing key bundles.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.get('/key-bundles', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const query = keyBundlesAdapter.getAllKeyBundlesQuery(db)
      const paginatedResult = await paginate(query, ctx)
      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult }
    } catch (err) {
      logger.error(err, 'Error listing key bundles')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-bundles/search:
   *   get:
   *     summary: Search key bundles with pagination
   *     description: |
   *       Search key bundles with flexible filtering and pagination.
   *       - **OR search**: Use `q` with `fields` for multiple field search
   *       - **AND search**: Use any KeyBundle field parameter for filtering
   *       - Only one OR group is supported, but you can combine it with multiple AND filters
   *     tags: [Key Bundles]
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
   *       - in: query
   *         name: fields
   *         required: false
   *         schema:
   *           type: string
   *         description: Comma-separated list of fields for OR search. Defaults to name and description.
   *     responses:
   *       200:
   *         description: Paginated search results
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
   *                         $ref: '#/components/schemas/KeyBundle'
   *       400:
   *         description: Invalid search parameters
   *       500:
   *         description: Internal server error
   */
  router.get('/key-bundles/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'q',
      'fields',
      'page',
      'limit',
    ])

    try {
      const query = keyBundlesAdapter.getKeyBundlesSearchQuery(db)

      const searchResult = buildSearchQuery(query, ctx, {
        defaultSearchFields: ['name', 'description'],
        reservedParams: ['q', 'fields', 'page', 'limit'],
      })

      if (!searchResult.hasSearchParams) {
        ctx.status = 400
        ctx.body = {
          reason: searchResult.error,
          ...metadata,
        }
        return
      }

      const paginatedResult = await paginate(query.orderBy('name', 'asc'), ctx)

      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult }
    } catch (err) {
      logger.error(err, 'Error searching key bundles')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-bundles/by-key/{keyId}:
   *   get:
   *     summary: Get all bundles containing a specific key
   *     description: Returns all bundle records containing the specified key ID, ordered by name
   *     tags: [Key Bundles]
   *     parameters:
   *       - in: path
   *         name: keyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key ID to search for
   *     responses:
   *       200:
   *         description: Array of bundles containing this key
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyBundle'
   *       500:
   *         description: Internal server error
   */
  router.get('/key-bundles/by-key/:keyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const { keyId } = ctx.params

      const bundles = await keyBundlesAdapter.getKeyBundlesByKeyId(keyId, db)

      ctx.status = 200
      ctx.body = { content: bundles satisfies KeyBundleResponse[], ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching bundles by key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-bundles/{id}:
   *   get:
   *     summary: Get key bundle by ID
   *     description: Fetch a specific key bundle by its ID.
   *     tags: [Key Bundles]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key bundle to retrieve.
   *     responses:
   *       200:
   *         description: A key bundle object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyBundle'
   *       404:
   *         description: Key bundle not found.
   *       500:
   *         description: An error occurred while fetching the key bundle.
   */
  router.get('/key-bundles/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row = await keyBundlesAdapter.getKeyBundleById(ctx.params.id, db)
      if (!row) {
        ctx.status = 404
        ctx.body = {
          reason: `Key bundle with id ${ctx.params.id} not found`,
          ...metadata,
        }
        return
      }
      ctx.status = 200
      ctx.body = { content: row satisfies KeyBundleResponse, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key bundle by id')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-bundles:
   *   post:
   *     summary: Create a new key bundle
   *     description: Create a new key bundle record.
   *     tags: [Key Bundles]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateKeyBundleRequest'
   *     responses:
   *       201:
   *         description: Key bundle created successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyBundle'
   *       400:
   *         description: Invalid request body
   *       500:
   *         description: An error occurred while creating the key bundle.
   */
  router.post(
    '/key-bundles',
    parseRequestBody(CreateKeyBundleRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: CreateKeyBundleRequest = ctx.request.body

        // Validate the keys array format
        try {
          const keyIds = JSON.parse(payload.keys)
          if (!Array.isArray(keyIds)) {
            ctx.status = 400
            ctx.body = {
              reason: 'Keys must be a JSON array',
              ...metadata,
            }
            return
          }
        } catch (_err) {
          ctx.status = 400
          ctx.body = {
            reason: 'Invalid keys format. Must be a valid JSON array.',
            ...metadata,
          }
          return
        }

        const row = await keyBundlesAdapter.createKeyBundle(payload, db)
        ctx.status = 201
        ctx.body = { content: row satisfies KeyBundleResponse, ...metadata }
      } catch (err) {
        logger.error(err, 'Error creating key bundle')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /key-bundles/{id}:
   *   patch:
   *     summary: Update a key bundle
   *     description: Partially update an existing key bundle.
   *     tags: [Key Bundles]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key bundle to update.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateKeyBundleRequest'
   *     responses:
   *       200:
   *         description: Key bundle updated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyBundle'
   *       400:
   *         description: Invalid request body
   *       404:
   *         description: Key bundle not found.
   *       500:
   *         description: An error occurred while updating the key bundle.
   */
  router.patch(
    '/key-bundles/:id',
    parseRequestBody(UpdateKeyBundleRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: UpdateKeyBundleRequest = ctx.request.body

        // Validate the keys array format if provided
        if (payload.keys) {
          try {
            const keyIds = JSON.parse(payload.keys)
            if (!Array.isArray(keyIds)) {
              ctx.status = 400
              ctx.body = {
                reason: 'Keys must be a JSON array',
                ...metadata,
              }
              return
            }
          } catch (_err) {
            ctx.status = 400
            ctx.body = {
              reason: 'Invalid keys format. Must be a valid JSON array.',
              ...metadata,
            }
            return
          }
        }

        const row = await keyBundlesAdapter.updateKeyBundle(
          ctx.params.id,
          payload,
          db
        )

        if (!row) {
          ctx.status = 404
          ctx.body = {
            reason: `Key bundle with id ${ctx.params.id} not found`,
            ...metadata,
          }
          return
        }

        ctx.status = 200
        ctx.body = { content: row satisfies KeyBundleResponse, ...metadata }
      } catch (err) {
        logger.error(err, 'Error updating key bundle')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /key-bundles/{id}/keys-with-loan-status:
   *   get:
   *     summary: Get all keys in a bundle with optional related data
   *     description: |
   *       Returns all keys that belong to this bundle with optional loans, events, and key system information.
   *       Use query parameters to include related data as needed.
   *     tags: [Key Bundles]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key bundle
   *       - in: query
   *         name: includeLoans
   *         required: false
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include loans array (active + previous loans) for each key
   *       - in: query
   *         name: includeEvents
   *         required: false
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include events array (latest event) for each key
   *       - in: query
   *         name: includeKeySystem
   *         required: false
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include key system information for each key
   *     responses:
   *       200:
   *         description: Bundle information and keys with optional related data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/KeyBundleDetailsResponse'
   *       404:
   *         description: Key bundle not found
   *       500:
   *         description: Internal server error
   */
  router.get('/key-bundles/:id/keys-with-loan-status', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'includeLoans',
      'includeEvents',
      'includeKeySystem',
    ])
    try {
      const includeLoans = ctx.query.includeLoans === 'true'
      const includeEvents = ctx.query.includeEvents === 'true'
      const includeKeySystem = ctx.query.includeKeySystem === 'true'

      const result = await keyBundlesAdapter.getKeyBundleDetails(
        ctx.params.id,
        { includeLoans, includeEvents, includeKeySystem },
        db
      )
      ctx.status = 200
      ctx.body = { content: result, ...metadata }
    } catch (err: any) {
      if (err.message === 'Bundle not found') {
        ctx.status = 404
        ctx.body = {
          reason: `Key bundle with id ${ctx.params.id} not found`,
          ...metadata,
        }
        return
      }
      logger.error(err, 'Error fetching key bundle with loan status')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-bundles/by-contact/{contactCode}/with-loaned-keys:
   *   get:
   *     summary: Get key bundles with keys loaned to a contact
   *     description: Fetches all key bundles that have keys currently loaned to a specific contact.
   *     tags: [Key Bundles]
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code (F-number) to find bundles for
   *     responses:
   *       200:
   *         description: A list of bundles with loaned keys info
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/BundleWithLoanedKeysInfo'
   *       500:
   *         description: Internal server error
   */
  router.get(
    '/key-bundles/by-contact/:contactCode/with-loaned-keys',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const result =
          await keyBundlesAdapter.getKeyBundlesByContactWithLoanedKeys(
            ctx.params.contactCode,
            db
          )
        ctx.status = 200
        ctx.body = { content: result, ...metadata }
      } catch (err: any) {
        logger.error(err, 'Error fetching bundles by contact with loaned keys')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /key-bundles/{id}:
   *   delete:
   *     summary: Delete a key bundle
   *     description: Delete a key bundle by ID.
   *     tags: [Key Bundles]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key bundle to delete.
   *     responses:
   *       204:
   *         description: Key bundle deleted successfully.
   *       500:
   *         description: An error occurred while deleting the key bundle.
   */
  router.delete('/key-bundles/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      await keyBundlesAdapter.deleteKeyBundle(ctx.params.id, db)
      ctx.status = 204
    } catch (err) {
      logger.error(err, 'Error deleting key bundle')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
