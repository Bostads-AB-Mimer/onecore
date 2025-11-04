import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import * as keyLoanMaintenanceKeysAdapter from '../adapters/key-loan-maintenance-keys-adapter'
import * as maintenanceKeyLoanService from '../key-loan-maintenance-keys-service'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { buildSearchQuery } from '../../../utils/search-builder'

const {
  KeyLoanMaintenanceKeysSchema,
  KeyLoanMaintenanceKeysWithDetailsSchema,
  CreateKeyLoanMaintenanceKeysRequestSchema,
  UpdateKeyLoanMaintenanceKeysRequestSchema,
} = keys.v1
type CreateKeyLoanMaintenanceKeysRequest =
  keys.v1.CreateKeyLoanMaintenanceKeysRequest
type UpdateKeyLoanMaintenanceKeysRequest =
  keys.v1.UpdateKeyLoanMaintenanceKeysRequest
type KeyLoanMaintenanceKeysResponse = keys.v1.KeyLoanMaintenanceKeys
type KeyLoanMaintenanceKeysWithDetailsResponse =
  keys.v1.KeyLoanMaintenanceKeysWithDetails

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
  registerSchema(
    'KeyLoanMaintenanceKeysWithDetails',
    KeyLoanMaintenanceKeysWithDetailsSchema
  )

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
   * /key-loan-maintenance-keys/by-company/{company}/with-keys:
   *   get:
   *     summary: Get maintenance key loans for a company with full key details
   *     description: |
   *       Returns all maintenance key loan records for the specified company with joined key data.
   *       Supports filtering by returned status via query parameter.
   *     tags: [Key Loan Maintenance Keys]
   *     parameters:
   *       - in: path
   *         name: company
   *         required: true
   *         schema:
   *           type: string
   *         description: The company name to filter by
   *       - in: query
   *         name: returned
   *         required: false
   *         schema:
   *           type: boolean
   *         description: |
   *           Filter by return status:
   *           - true: Only returned loans (returnedAt IS NOT NULL)
   *           - false: Only active loans (returnedAt IS NULL)
   *           - omitted: All loans (no filter)
   *     responses:
   *       200:
   *         description: Array of loans with full key details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyLoanMaintenanceKeysWithDetails'
   *       500:
   *         description: Internal server error
   */
  router.get(
    '/key-loan-maintenance-keys/by-company/:company/with-keys',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx, ['returned'])
      try {
        const { company } = ctx.params
        const returnedParam = ctx.query.returned

        // Parse returned query param: 'true' => true, 'false' => false, undefined => undefined
        let returned: boolean | undefined = undefined
        if (returnedParam === 'true') {
          returned = true
        } else if (returnedParam === 'false') {
          returned = false
        }

        const loans =
          await keyLoanMaintenanceKeysAdapter.getKeyLoanMaintenanceKeysWithKeysByCompany(
            company,
            returned,
            db
          )

        ctx.status = 200
        ctx.body = {
          content: loans satisfies KeyLoanMaintenanceKeysWithDetailsResponse[],
          ...metadata,
        }
      } catch (err) {
        logger.error(
          err,
          'Error fetching maintenance key loans with keys by company'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /key-loan-maintenance-keys/by-bundle/{bundleId}/with-keys:
   *   get:
   *     summary: Get maintenance key loans for a key bundle with full key details
   *     description: |
   *       Returns all maintenance key loan records containing keys from the specified bundle.
   *       Supports filtering by returned status via query parameter.
   *     tags: [Key Loan Maintenance Keys]
   *     parameters:
   *       - in: path
   *         name: bundleId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key bundle ID to filter by
   *       - in: query
   *         name: returned
   *         required: false
   *         schema:
   *           type: boolean
   *         description: |
   *           Filter by return status:
   *           - true: Only returned loans (returnedAt IS NOT NULL)
   *           - false: Only active loans (returnedAt IS NULL)
   *           - omitted: All loans (no filter)
   *     responses:
   *       200:
   *         description: Array of loans with full key details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyLoanMaintenanceKeysWithDetails'
   *       500:
   *         description: Internal server error
   */
  router.get(
    '/key-loan-maintenance-keys/by-bundle/:bundleId/with-keys',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx, ['returned'])
      try {
        const { bundleId } = ctx.params
        const returnedParam = ctx.query.returned

        // Parse returned query param: 'true' => true, 'false' => false, undefined => undefined
        let returned: boolean | undefined = undefined
        if (returnedParam === 'true') {
          returned = true
        } else if (returnedParam === 'false') {
          returned = false
        }

        const loans =
          await keyLoanMaintenanceKeysAdapter.getKeyLoanMaintenanceKeysWithKeysByBundle(
            bundleId,
            returned,
            db
          )

        ctx.status = 200
        ctx.body = {
          content: loans satisfies KeyLoanMaintenanceKeysWithDetailsResponse[],
          ...metadata,
        }
      } catch (err) {
        logger.error(
          err,
          'Error fetching maintenance key loans with keys by bundle'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

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

        // Validate keys using service layer
        const validationResult =
          await maintenanceKeyLoanService.validateMaintenanceKeyLoanCreation(
            payload.keys,
            db
          )

        if (!validationResult.ok) {
          if (validationResult.err === 'active-loan-conflict') {
            ctx.status = 409
            ctx.body = {
              reason:
                'Cannot create maintenance loan. One or more keys already have active loans.',
              conflictingKeys: validationResult.details?.conflictingKeys,
              conflictDetails: validationResult.details?.conflictDetails,
              ...metadata,
            }
            return
          }

          // Handle other validation errors (format issues)
          const errorMessages = {
            'invalid-keys-format':
              'Invalid keys format. Must be a valid JSON array.',
            'keys-not-array': 'Keys must be a JSON array',
            'empty-keys-array': 'Keys array cannot be empty',
          }

          ctx.status = 400
          ctx.body = {
            reason:
              errorMessages[validationResult.err] || 'Invalid keys format',
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

        // Validate the keys array if provided
        if (payload.keys) {
          const validationResult =
            await maintenanceKeyLoanService.validateMaintenanceKeyLoanUpdate(
              ctx.params.id,
              payload.keys,
              db
            )

          if (!validationResult.ok) {
            if (validationResult.err === 'active-loan-conflict') {
              ctx.status = 409
              ctx.body = {
                reason:
                  'Cannot update maintenance loan. One or more keys already have active loans.',
                conflictingKeys: validationResult.details?.conflictingKeys,
                conflictDetails: validationResult.details?.conflictDetails,
                ...metadata,
              }
              return
            }

            // Handle other validation errors (format issues)
            const errorMessages = {
              'invalid-keys-format':
                'Invalid keys format. Must be a valid JSON array.',
              'keys-not-array': 'Keys must be a JSON array',
              'empty-keys-array': 'Keys array cannot be empty',
            }

            ctx.status = 400
            ctx.body = {
              reason:
                errorMessages[validationResult.err] || 'Invalid keys format',
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
