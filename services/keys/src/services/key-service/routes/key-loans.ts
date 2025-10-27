//TODO: disallow POSTs where fields are not validated to be real resources (e.g. keys must exist in keys table to create a key loan at that Id)

import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import * as keyLoansAdapter from '../adapters/key-loans-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { buildSearchQuery } from '../../../utils/search-builder'

const TABLE = 'key_loans'

const {
  KeyLoanSchema,
  CreateKeyLoanRequestSchema,
  UpdateKeyLoanRequestSchema,
} = keys.v1
type CreateKeyLoanRequest = keys.v1.CreateKeyLoanRequest
type UpdateKeyLoanRequest = keys.v1.UpdateKeyLoanRequest
type KeyLoanResponse = keys.v1.KeyLoan

/**
 * @swagger
 * tags:
 *   - name: Key Loans
 *     description: Endpoints related to key loan operations
 * components:
 *   schemas:
 *     CreateKeyLoanRequest:
 *       $ref: '#/components/schemas/CreateKeyLoanRequest'
 *     UpdateKeyLoanRequest:
 *       $ref: '#/components/schemas/UpdateKeyLoanRequest'
 *     KeyLoan:
 *       $ref: '#/components/schemas/KeyLoan'
 */
export const routes = (router: KoaRouter) => {
  // Register schemas from @onecore/types
  registerSchema('CreateKeyLoanRequest', CreateKeyLoanRequestSchema)
  registerSchema('UpdateKeyLoanRequest', UpdateKeyLoanRequestSchema)
  registerSchema('KeyLoan', KeyLoanSchema)
  /**
   * @swagger
   * /key-loans:
   *   get:
   *     summary: List all key loans
   *     description: Fetches a list of all key loans ordered by creation date.
   *     tags: [Key Loans]
   *     responses:
   *       200:
   *         description: A list of key loans.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: The unique ID of the key loan.
   *                       keys:
   *                         type: string
   *                         description: JSON string array of key IDs.
   *                       contact:
   *                         type: string
   *                         description: Contact information.
   *                       contact2:
   *                         type: string
   *                         description: Second contact information.
   *                       returnedAt:
   *                         type: string
   *                         format: date-time
   *                         description: When keys were returned.
   *                       availableToNextTenantFrom:
   *                         type: string
   *                         format: date-time
   *                         description: When keys become available for next tenant if early return.
   *                       pickedUpAt:
   *                         type: string
   *                         format: date-time
   *                         description: When keys were picked up.
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                         description: When the record was created.
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *                         description: When the record was last updated.
   *                       createdBy:
   *                         type: string
   *                         description: Who created this record.
   *                       updatedBy:
   *                         type: string
   *                         description: Who last updated this record.
   *       500:
   *         description: An error occurred while listing key loans.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.get('/key-loans', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await keyLoansAdapter.getAllKeyLoans(db)
      ctx.status = 200
      ctx.body = { content: rows satisfies KeyLoanResponse[], ...metadata }
    } catch (err) {
      logger.error(err, 'Error listing key loans')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loans/search:
   *   get:
   *     summary: Search key loans
   *     description: |
   *       Search key loans with flexible filtering.
   *       - **OR search**: Use `q` with `fields` for multiple field search
   *       - **AND search**: Use any KeyLoan field parameter for filtering
   *       - **Comparison operators**: Prefix values with `>`, `<`, `>=`, `<=` for date/number comparisons
   *       - Only one OR group is supported, but you can combine it with multiple AND filters
   *     tags: [Key Loans]
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
   *         description: Comma-separated list of fields for OR search. Defaults to contact and contact2.
   *       - in: query
   *         name: id
   *         schema:
   *           type: string
   *       - in: query
   *         name: keys
   *         schema:
   *           type: string
   *       - in: query
   *         name: contact
   *         schema:
   *           type: string
   *       - in: query
   *         name: contact2
   *         schema:
   *           type: string
   *       - in: query
   *         name: returnedAt
   *         schema:
   *           type: string
   *       - in: query
   *         name: availableToNextTenantFrom
   *         schema:
   *           type: string
   *       - in: query
   *         name: pickedUpAt
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
   *                     $ref: '#/components/schemas/KeyLoan'
   *       400:
   *         description: Bad request
   *       500:
   *         description: Internal server error
   */
  router.get('/key-loans/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    try {
      const query = db(TABLE).select('*')

      const searchResult = buildSearchQuery(query, ctx, {
        defaultSearchFields: ['contact', 'contact2'],
      })

      if (!searchResult.hasSearchParams) {
        ctx.status = 400
        ctx.body = {
          reason: searchResult.error,
          ...metadata,
        }
        return
      }

      const rows = await query.orderBy('createdAt', 'desc').limit(10)

      ctx.status = 200
      ctx.body = { content: rows satisfies KeyLoanResponse[], ...metadata }
    } catch (err) {
      logger.error(err, 'Error searching key loans')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loans/by-key/{keyId}:
   *   get:
   *     summary: Get all loans for a specific key
   *     description: Returns all loan records for the specified key ID, ordered by creation date DESC
   *     tags: [Key Loans]
   *     parameters:
   *       - in: path
   *         name: keyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key ID to fetch loans for
   *     responses:
   *       200:
   *         description: Array of loans for this key
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyLoan'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.get('/key-loans/by-key/:keyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const { keyId } = ctx.params

      const loans = await keyLoansAdapter.getKeyLoansByKeyId(keyId, db)

      ctx.status = 200
      ctx.body = { content: loans satisfies KeyLoanResponse[], ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching loans by key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loans/{id}:
   *   get:
   *     summary: Get key loan by ID
   *     description: Fetch a specific key loan by its ID.
   *     tags: [Key Loans]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key loan to retrieve.
   *     responses:
   *       200:
   *         description: A key loan object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: The unique ID of the key loan.
   *                     keys:
   *                       type: string
   *                       description: JSON string array of key IDs.
   *                     contact:
   *                       type: string
   *                       description: Contact information.
   *                     contact2:
   *                       type: string
   *                       description: Second contact information.
   *                     returnedAt:
   *                       type: string
   *                       format: date-time
   *                       description: When keys were returned.
   *                     availableToNextTenantFrom:
   *                       type: string
   *                       format: date-time
   *                       description: When keys become available for next tenant.
   *                     pickedUpAt:
   *                       type: string
   *                       format: date-time
   *                       description: When keys were picked up.
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: When the record was created.
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: When the record was last updated.
   *                     createdBy:
   *                       type: string
   *                       description: Who created this record.
   *                     updatedBy:
   *                       type: string
   *                       description: Who last updated this record.
   *       404:
   *         description: Key loan not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Key loan with provided id not found
   *       500:
   *         description: An error occurred while fetching the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.get('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row = await keyLoansAdapter.getKeyLoanById(ctx.params.id, db)
      if (!row) {
        ctx.status = 404
        ctx.body = {
          reason: `Key loan with id ${ctx.params.id} not found`,
          ...metadata,
        }
        return
      }
      ctx.status = 200
      ctx.body = { content: row satisfies KeyLoanResponse, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key loan by id')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loans:
   *   post:
   *     summary: Create a new key loan
   *     description: Create a new key loan record.
   *     tags: [Key Loans]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateKeyLoanRequest'
   *     responses:
   *       201:
   *         description: Key loan created successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   description: The created key loan object.
   *       500:
   *         description: An error occurred while creating the key loan.
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
    '/key-loans',
    parseRequestBody(CreateKeyLoanRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: CreateKeyLoanRequest = ctx.request.body

        // Parse and validate the keys array
        let keyIds: string[] = []
        try {
          keyIds = JSON.parse(payload.keys)
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

        // Check for conflicting active loans
        const { hasConflict, conflictingKeys } =
          await keyLoansAdapter.checkActiveKeyLoans(keyIds, undefined, db)

        if (hasConflict) {
          ctx.status = 409
          ctx.body = {
            reason:
              'Cannot create loan. One or more keys already have active loans.',
            conflictingKeys,
            ...metadata,
          }
          return
        }

        const row = await keyLoansAdapter.createKeyLoan(payload, db)
        ctx.status = 201
        ctx.body = { content: row satisfies KeyLoanResponse, ...metadata }
      } catch (err) {
        logger.error(err, 'Error creating key loan')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /key-loans/{id}:
   *   patch:
   *     summary: Update a key loan
   *     description: Partially update an existing key loan.
   *     tags: [Key Loans]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key loan to update.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateKeyLoanRequest'
   *     responses:
   *       200:
   *         description: Key loan updated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   description: The updated key loan object.
   *       404:
   *         description: Key loan not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Key loan with id 12345678-1234-1234-1234-123456789abc not found
   *       500:
   *         description: An error occurred while updating the key loan.
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
    '/key-loans/:id',
    parseRequestBody(UpdateKeyLoanRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: UpdateKeyLoanRequest = ctx.request.body

        // If updating keys, check for conflicts
        if (payload.keys) {
          let keyIds: string[] = []
          try {
            keyIds = JSON.parse(payload.keys)
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

          // Check for conflicting active loans, excluding the current loan
          const { hasConflict, conflictingKeys } =
            await keyLoansAdapter.checkActiveKeyLoans(keyIds, ctx.params.id, db)

          if (hasConflict) {
            ctx.status = 409
            ctx.body = {
              reason:
                'Cannot update loan. One or more keys already have active loans.',
              conflictingKeys,
              ...metadata,
            }
            return
          }
        }

        const row = await keyLoansAdapter.updateKeyLoan(
          ctx.params.id,
          payload,
          db
        )

        if (!row) {
          ctx.status = 404
          ctx.body = {
            reason: 'Key loan with id ' + ctx.params.id + ' not found',
            ...metadata,
          }
          return
        }

        ctx.status = 200
        ctx.body = { content: row satisfies KeyLoanResponse, ...metadata }
      } catch (err) {
        logger.error(err, 'Error updating key loan with id ' + ctx.params.id)
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /key-loans/{id}:
   *   delete:
   *     summary: Delete a key loan
   *     description: Delete an existing key loan by ID.
   *     tags: [Key Loans]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key loan to delete.
   *     responses:
   *       200:
   *         description: Key loan deleted successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       404:
   *         description: Key loan not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Key loan with id 12345678-1234-1234-1234-123456789abc not found
   *       500:
   *         description: An error occurred while deleting the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   */
  router.delete('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const n = await keyLoansAdapter.deleteKeyLoan(ctx.params.id, db)
      if (!n) {
        ctx.status = 404
        ctx.body = {
          reason: `Key loan with id ${ctx.params.id} not found`,
          ...metadata,
        }
        return
      }
      ctx.status = 200
      ctx.body = { ...metadata }
    } catch (err) {
      logger.error(err, `Error deleting key loan with id ${ctx.params.id}`)
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
