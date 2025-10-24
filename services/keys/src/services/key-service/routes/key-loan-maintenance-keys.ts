import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import * as keyLoanMaintenanceKeysAdapter from '../adapters/key-loan-maintenance-keys-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { buildSearchQuery } from '../../../utils/search-builder'

const {
  KeyLoanMaintenanceKeysSchema,
  CreateKeyLoanMaintenanceKeysRequestSchema,
  UpdateKeyLoanMaintenanceKeysRequestSchema,
} = keys.v1
type CreateKeyLoanMaintenanceKeysRequest =
  keys.v1.CreateKeyLoanMaintenanceKeysRequest
type UpdateKeyLoanMaintenanceKeysRequest =
  keys.v1.UpdateKeyLoanMaintenanceKeysRequest
type KeyLoanMaintenanceKeysResponse = keys.v1.KeyLoanMaintenanceKeys

/**
 * @swagger
 * tags:
 *   - name: Key Loan Maintenance Keys
 *     description: Endpoints related to maintenance key loan operations
 * components:
 *   schemas:
 *     CreateKeyLoanMaintenanceKeysRequest:
 *       $ref: '#/components/schemas/CreateKeyLoanMaintenanceKeysRequest'
 *     UpdateKeyLoanMaintenanceKeysRequest:
 *       $ref: '#/components/schemas/UpdateKeyLoanMaintenanceKeysRequest'
 *     KeyLoanMaintenanceKeys:
 *       $ref: '#/components/schemas/KeyLoanMaintenanceKeys'
 */
export const routes = (router: KoaRouter) => {
  // Register schemas from @onecore/types
  registerSchema(
    'CreateKeyLoanMaintenanceKeysRequest',
    CreateKeyLoanMaintenanceKeysRequestSchema
  )
  registerSchema(
    'UpdateKeyLoanMaintenanceKeysRequest',
    UpdateKeyLoanMaintenanceKeysRequestSchema
  )
  registerSchema('KeyLoanMaintenanceKeys', KeyLoanMaintenanceKeysSchema)

  /**
   * @swagger
   * /key-loan-maintenance-keys:
   *   get:
   *     summary: List all maintenance key loans
   *     description: Fetches a list of all maintenance key loans ordered by creation date.
   *     tags: [Key Loan Maintenance Keys]
   *     responses:
   *       200:
   *         description: A list of maintenance key loans.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyLoanMaintenanceKeys'
   *       500:
   *         description: An error occurred while listing maintenance key loans.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.get('/key-loan-maintenance-keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows =
        await keyLoanMaintenanceKeysAdapter.getAllKeyLoanMaintenanceKeys(db)
      ctx.status = 200
      ctx.body = {
        content: rows satisfies KeyLoanMaintenanceKeysResponse[],
        ...metadata,
      }
    } catch (err) {
      logger.error(err, 'Error listing maintenance key loans')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loan-maintenance-keys/search:
   *   get:
   *     summary: Search maintenance key loans
   *     description: |
   *       Search maintenance key loans with flexible filtering.
   *       - **OR search**: Use `q` with `fields` for multiple field search
   *       - **AND search**: Use any field parameter for filtering
   *     tags: [Key Loan Maintenance Keys]
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
   *         description: Comma-separated list of fields for OR search. Defaults to company and contactPerson.
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
   *                     $ref: '#/components/schemas/KeyLoanMaintenanceKeys'
   *       400:
   *         description: Invalid search parameters
   *       500:
   *         description: Internal server error
   */
  router.get('/key-loan-maintenance-keys/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    try {
      const query =
        keyLoanMaintenanceKeysAdapter.getKeyLoanMaintenanceKeysSearchQuery(db)

      const searchResult = buildSearchQuery(query, ctx, {
        defaultSearchFields: ['company', 'contactPerson'],
      })

      if (!searchResult.hasSearchParams) {
        ctx.status = 400
        ctx.body = {
          reason: searchResult.error,
          ...metadata,
        }
        return
      }

      const rows = await query.orderBy('id', 'desc').limit(10)

      ctx.status = 200
      ctx.body = {
        content: rows satisfies KeyLoanMaintenanceKeysResponse[],
        ...metadata,
      }
    } catch (err) {
      logger.error(err, 'Error searching maintenance key loans')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loan-maintenance-keys/by-key/{keyId}:
   *   get:
   *     summary: Get all maintenance key loans for a specific key
   *     description: Returns all maintenance key loan records for the specified key ID
   *     tags: [Key Loan Maintenance Keys]
   *     parameters:
   *       - in: path
   *         name: keyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key ID to search for
   *     responses:
   *       200:
   *         description: Array of loans containing this key
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyLoanMaintenanceKeys'
   *       500:
   *         description: Internal server error
   */
  router.get('/key-loan-maintenance-keys/by-key/:keyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const { keyId } = ctx.params

      const loans =
        await keyLoanMaintenanceKeysAdapter.getKeyLoanMaintenanceKeysByKeyId(
          keyId,
          db
        )

      ctx.status = 200
      ctx.body = {
        content: loans satisfies KeyLoanMaintenanceKeysResponse[],
        ...metadata,
      }
    } catch (err) {
      logger.error(err, 'Error fetching maintenance key loans by key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loan-maintenance-keys/by-company/{company}:
   *   get:
   *     summary: Get all maintenance key loans for a specific company
   *     description: Returns all maintenance key loan records for the specified company
   *     tags: [Key Loan Maintenance Keys]
   *     parameters:
   *       - in: path
   *         name: company
   *         required: true
   *         schema:
   *           type: string
   *         description: The company name to filter by
   *     responses:
   *       200:
   *         description: Array of loans for this company
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyLoanMaintenanceKeys'
   *       500:
   *         description: Internal server error
   */
  router.get('/key-loan-maintenance-keys/by-company/:company', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const { company } = ctx.params

      const loans =
        await keyLoanMaintenanceKeysAdapter.getKeyLoanMaintenanceKeysByCompany(
          company,
          db
        )

      ctx.status = 200
      ctx.body = {
        content: loans satisfies KeyLoanMaintenanceKeysResponse[],
        ...metadata,
      }
    } catch (err) {
      logger.error(err, 'Error fetching maintenance key loans by company')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loan-maintenance-keys/{id}:
   *   get:
   *     summary: Get maintenance key loan by ID
   *     description: Fetch a specific maintenance key loan by its ID.
   *     tags: [Key Loan Maintenance Keys]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the maintenance key loan to retrieve.
   *     responses:
   *       200:
   *         description: A maintenance key loan object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyLoanMaintenanceKeys'
   *       404:
   *         description: Maintenance key loan not found.
   *       500:
   *         description: An error occurred while fetching the maintenance key loan.
   */
  router.get('/key-loan-maintenance-keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row =
        await keyLoanMaintenanceKeysAdapter.getKeyLoanMaintenanceKeyById(
          ctx.params.id,
          db
        )
      if (!row) {
        ctx.status = 404
        ctx.body = {
          reason: `Maintenance key loan with id ${ctx.params.id} not found`,
          ...metadata,
        }
        return
      }
      ctx.status = 200
      ctx.body = {
        content: row satisfies KeyLoanMaintenanceKeysResponse,
        ...metadata,
      }
    } catch (err) {
      logger.error(err, 'Error fetching maintenance key loan by id')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loan-maintenance-keys:
   *   post:
   *     summary: Create a new maintenance key loan
   *     description: Create a new maintenance key loan record.
   *     tags: [Key Loan Maintenance Keys]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateKeyLoanMaintenanceKeysRequest'
   *     responses:
   *       201:
   *         description: Maintenance key loan created successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyLoanMaintenanceKeys'
   *       400:
   *         description: Invalid request body
   *       500:
   *         description: An error occurred while creating the maintenance key loan.
   */
  router.post(
    '/key-loan-maintenance-keys',
    parseRequestBody(CreateKeyLoanMaintenanceKeysRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: CreateKeyLoanMaintenanceKeysRequest = ctx.request.body

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

        const row =
          await keyLoanMaintenanceKeysAdapter.createKeyLoanMaintenanceKey(
            payload,
            db
          )
        ctx.status = 201
        ctx.body = {
          content: row satisfies KeyLoanMaintenanceKeysResponse,
          ...metadata,
        }
      } catch (err) {
        logger.error(err, 'Error creating maintenance key loan')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /key-loan-maintenance-keys/{id}:
   *   patch:
   *     summary: Update a maintenance key loan
   *     description: Partially update an existing maintenance key loan.
   *     tags: [Key Loan Maintenance Keys]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the maintenance key loan to update.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateKeyLoanMaintenanceKeysRequest'
   *     responses:
   *       200:
   *         description: Maintenance key loan updated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyLoanMaintenanceKeys'
   *       400:
   *         description: Invalid request body
   *       404:
   *         description: Maintenance key loan not found.
   *       500:
   *         description: An error occurred while updating the maintenance key loan.
   */
  router.patch(
    '/key-loan-maintenance-keys/:id',
    parseRequestBody(UpdateKeyLoanMaintenanceKeysRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: UpdateKeyLoanMaintenanceKeysRequest = ctx.request.body

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

        const row =
          await keyLoanMaintenanceKeysAdapter.updateKeyLoanMaintenanceKey(
            ctx.params.id,
            payload,
            db
          )

        if (!row) {
          ctx.status = 404
          ctx.body = {
            reason: `Maintenance key loan with id ${ctx.params.id} not found`,
            ...metadata,
          }
          return
        }

        ctx.status = 200
        ctx.body = {
          content: row satisfies KeyLoanMaintenanceKeysResponse,
          ...metadata,
        }
      } catch (err) {
        logger.error(err, 'Error updating maintenance key loan')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /key-loan-maintenance-keys/{id}:
   *   delete:
   *     summary: Delete a maintenance key loan
   *     description: Delete a maintenance key loan by ID.
   *     tags: [Key Loan Maintenance Keys]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the maintenance key loan to delete.
   *     responses:
   *       204:
   *         description: Maintenance key loan deleted successfully.
   *       500:
   *         description: An error occurred while deleting the maintenance key loan.
   */
  router.delete('/key-loan-maintenance-keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      await keyLoanMaintenanceKeysAdapter.deleteKeyLoanMaintenanceKey(
        ctx.params.id,
        db
      )
      ctx.status = 204
    } catch (err) {
      logger.error(err, 'Error deleting maintenance key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
