import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import * as keyBundlesAdapter from '../adapters/key-bundles-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { buildSearchQuery } from '../../../utils/search-builder'

const {
  KeyBundleSchema,
  CreateKeyBundleRequestSchema,
  UpdateKeyBundleRequestSchema,
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

  /**
   * @swagger
   * /key-bundles:
   *   get:
   *     summary: List all key bundles
   *     description: Fetches a list of all key bundles ordered by name.
   *     tags: [Key Bundles]
   *     responses:
   *       200:
   *         description: A list of key bundles.
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
      const rows = await keyBundlesAdapter.getAllKeyBundles(db)
      ctx.status = 200
      ctx.body = { content: rows satisfies KeyBundleResponse[], ...metadata }
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
   *     summary: Search key bundles
   *     description: |
   *       Search key bundles with flexible filtering.
   *       - **OR search**: Use `q` with `fields` for multiple field search
   *       - **AND search**: Use any KeyBundle field parameter for filtering
   *       - Only one OR group is supported, but you can combine it with multiple AND filters
   *     tags: [Key Bundles]
   *     parameters:
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
   *         description: Search results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyBundle'
   *       400:
   *         description: Invalid search parameters
   *       500:
   *         description: Internal server error
   */
  router.get('/key-bundles/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    try {
      const query = keyBundlesAdapter.getKeyBundlesSearchQuery(db)

      const searchResult = buildSearchQuery(query, ctx, {
        defaultSearchFields: ['name', 'description'],
      })

      if (!searchResult.hasSearchParams) {
        ctx.status = 400
        ctx.body = {
          reason: searchResult.error,
          ...metadata,
        }
        return
      }

      const rows = await query.orderBy('name', 'asc').limit(10)

      ctx.status = 200
      ctx.body = { content: rows satisfies KeyBundleResponse[], ...metadata }
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
   *     summary: Get all keys in a bundle with their maintenance loan status
   *     description: |
   *       Returns all keys that belong to this bundle along with information about
   *       any active maintenance loans they are currently part of.
   *       This endpoint is optimized for displaying keys in a table with loan status.
   *     tags: [Key Bundles]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key bundle
   *     responses:
   *       200:
   *         description: Bundle information and keys with loan status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     bundle:
   *                       $ref: '#/components/schemas/KeyBundle'
   *                     keys:
   *                       type: array
   *                       items:
   *                         allOf:
   *                           - $ref: '#/components/schemas/Key'
   *                           - type: object
   *                             properties:
   *                               maintenanceLoanId:
   *                                 type: string
   *                                 nullable: true
   *                                 description: ID of active maintenance loan, null if not loaned
   *                               maintenanceLoanCompany:
   *                                 type: string
   *                                 nullable: true
   *                               maintenanceLoanContactPerson:
   *                                 type: string
   *                                 nullable: true
   *                               maintenanceLoanPickedUpAt:
   *                                 type: string
   *                                 format: date-time
   *                                 nullable: true
   *                               maintenanceLoanCreatedAt:
   *                                 type: string
   *                                 format: date-time
   *                                 nullable: true
   *       404:
   *         description: Key bundle not found
   *       500:
   *         description: Internal server error
   */
  router.get('/key-bundles/:id/keys-with-loan-status', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const result = await keyBundlesAdapter.getKeyBundleWithLoanStatus(
        ctx.params.id,
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
