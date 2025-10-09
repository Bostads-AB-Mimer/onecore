//TODO: disallow POSTs where fields are not validated to be real resources (e.g. keys must exist in keys table to create a key loan at that Id)

import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'

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
 * Check if any of the provided keys have active loans (not returned yet)
 * @param keyIds - Array of key IDs to check
 * @param excludeLoanId - Optional loan ID to exclude from the check (for updates)
 * @returns Object with hasConflict flag and array of conflicting key IDs
 */
async function checkActiveKeyLoans(
  keyIds: string[],
  excludeLoanId?: string
): Promise<{ hasConflict: boolean; conflictingKeys: string[] }> {
  if (keyIds.length === 0) {
    return { hasConflict: false, conflictingKeys: [] }
  }

  const conflictingKeys: string[] = []

  // Check each key ID for active loans
  for (const keyId of keyIds) {
    let query = db(TABLE)
      .select('id')
      .whereNotNull('pickedUpAt') // Only consider activated loans (not pending)
      .where((builder) => {
        // Active if: not returned yet OR not yet available to next tenant
        builder
          .whereNull('returnedAt')
          .orWhere('availableToNextTenantFrom', '>', db.fn.now())
      })
      .whereRaw('keys LIKE ?', [`%"${keyId}"%`])

    // Exclude specific loan ID if provided (for update scenarios)
    if (excludeLoanId) {
      query = query.whereNot('id', excludeLoanId)
    }

    const activeLoan = await query.first()

    if (activeLoan) {
      conflictingKeys.push(keyId)
    }
  }

  return {
    hasConflict: conflictingKeys.length > 0,
    conflictingKeys,
  }
}

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
   *                       lease:
   *                         type: string
   *                         description: Lease identifier.
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
      const rows = await db(TABLE).select('*').orderBy('createdAt', 'desc')
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
   *         description: Comma-separated list of fields for OR search. Defaults to lease.
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
   *         name: lease
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
      let query = db(TABLE).select('*')

      // Handle OR search
      if (typeof ctx.query.q === 'string' && ctx.query.q.trim().length >= 3) {
        const searchTerm = ctx.query.q.trim()
        let fieldsToSearch: string[] = []

        if (typeof ctx.query.fields === 'string') {
          fieldsToSearch = ctx.query.fields.split(',').map((f) => f.trim())
        } else {
          fieldsToSearch = ['lease']
        }

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

      // Handle AND search
      const reservedParams = ['q', 'fields']
      for (const [field, value] of Object.entries(ctx.query)) {
        if (
          !reservedParams.includes(field) &&
          typeof value === 'string' &&
          value.trim().length > 0
        ) {
          const trimmedValue = value.trim()
          const operatorMatch = trimmedValue.match(/^(>=|<=|>|<)(.+)$/)

          if (operatorMatch) {
            const operator = operatorMatch[1]
            const compareValue = operatorMatch[2].trim()
            query = query.where(field, operator, compareValue)
          } else {
            query = query.where(field, 'like', `%${trimmedValue}%`)
          }
        }
      }

      const hasQParam =
        typeof ctx.query.q === 'string' && ctx.query.q.trim().length >= 3
      const hasFieldParams = Object.entries(ctx.query).some(
        ([key, value]) =>
          !reservedParams.includes(key) &&
          typeof value === 'string' &&
          value.trim().length > 0
      )

      if (!hasQParam && !hasFieldParams) {
        ctx.status = 400
        ctx.body = {
          reason: 'At least one search parameter is required',
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

      const loans = await db(TABLE)
        .whereRaw('keys LIKE ?', [`%"${keyId}"%`])
        .orderBy('createdAt', 'desc')

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
   *                     lease:
   *                       type: string
   *                       description: Lease identifier.
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
      const row = await db(TABLE).where({ id: ctx.params.id }).first()
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
          await checkActiveKeyLoans(keyIds)

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

        const [row] = await db(TABLE).insert(payload).returning('*')
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
          const { hasConflict, conflictingKeys } = await checkActiveKeyLoans(
            keyIds,
            ctx.params.id
          )

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

        const [row] = await db(TABLE)
          .where({ id: ctx.params.id })
          .update({ ...payload, updatedAt: db.fn.now() })
          .returning('*')

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
      const n = await db(TABLE).where({ id: ctx.params.id }).del()
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
