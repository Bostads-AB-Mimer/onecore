//TODO: disallow POSTs where fields are not validated to be real resources (e.g. keys must exist in keys table to create a key loan at that Id)

import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import * as keyLoansAdapter from '../adapters/key-loans-adapter'
import * as keyLoanService from '../key-loan-service'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { buildSearchQuery } from '../../../utils/search-builder'
import { paginate } from '../../../utils/pagination'

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
   *       - **Advanced filters**: Search by key name/object code, filter by key count, null checks
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
   *         name: keyNameOrObjectCode
   *         required: false
   *         schema:
   *           type: string
   *         description: Search by key name or rental object code (requires JOIN with keys table)
   *       - in: query
   *         name: minKeys
   *         required: false
   *         schema:
   *           type: number
   *         description: Minimum number of keys in loan
   *       - in: query
   *         name: maxKeys
   *         required: false
   *         schema:
   *           type: number
   *         description: Maximum number of keys in loan
   *       - in: query
   *         name: hasPickedUp
   *         required: false
   *         schema:
   *           type: boolean
   *         description: Filter by pickedUpAt null status (true = NOT NULL, false = NULL)
   *       - in: query
   *         name: hasReturned
   *         required: false
   *         schema:
   *           type: boolean
   *         description: Filter by returnedAt null status (true = NOT NULL, false = NULL)
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
   *         name: loanType
   *         schema:
   *           type: string
   *           enum: [TENANT, MAINTENANCE]
   *       - in: query
   *         name: returnedAt
   *         schema:
   *           type: string
   *         description: Supports comparison operators (e.g., >=2024-01-01, <2024-12-31)
   *       - in: query
   *         name: availableToNextTenantFrom
   *         schema:
   *           type: string
   *       - in: query
   *         name: pickedUpAt
   *         schema:
   *           type: string
   *         description: Supports comparison operators (e.g., >=2024-01-01, <2024-12-31)
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
    const metadata = generateRouteMetadata(ctx, [
      'q',
      'fields',
      'keyNameOrObjectCode',
      'minKeys',
      'maxKeys',
      'hasPickedUp',
      'hasReturned',
      'loanType',
      'pickedUpAt',
      'returnedAt',
      'pickedUpAfter',
      'pickedUpBefore',
      'returnedAfter',
      'returnedBefore',
    ])

    try {
      // Parse advanced search options
      const keyNameOrObjectCode =
        typeof ctx.query.keyNameOrObjectCode === 'string'
          ? ctx.query.keyNameOrObjectCode.trim()
          : undefined

      const minKeys =
        typeof ctx.query.minKeys === 'string'
          ? parseInt(ctx.query.minKeys, 10)
          : undefined

      const maxKeys =
        typeof ctx.query.maxKeys === 'string'
          ? parseInt(ctx.query.maxKeys, 10)
          : undefined

      // Parse boolean filters
      let hasPickedUp: boolean | undefined = undefined
      if (ctx.query.hasPickedUp === 'true') {
        hasPickedUp = true
      } else if (ctx.query.hasPickedUp === 'false') {
        hasPickedUp = false
      }

      let hasReturned: boolean | undefined = undefined
      if (ctx.query.hasReturned === 'true') {
        hasReturned = true
      } else if (ctx.query.hasReturned === 'false') {
        hasReturned = false
      }

      // Build query with advanced options
      const query = keyLoansAdapter.getKeyLoansSearchQuery(
        {
          keyNameOrObjectCode,
          minKeys,
          maxKeys,
          hasPickedUp,
          hasReturned,
        },
        db
      )

      // Apply additional search filters using buildSearchQuery
      buildSearchQuery(query, ctx, {
        defaultSearchFields: ['contact', 'contact2'],
        reservedParams: [
          'q',
          'fields',
          'page',
          'limit',
          'keyNameOrObjectCode',
          'minKeys',
          'maxKeys',
          'hasPickedUp',
          'hasReturned',
          'pickedUpAfter',
          'pickedUpBefore',
          'returnedAfter',
          'returnedBefore',
        ],
      })

      // Apply ordering
      const orderedQuery = query.orderBy('createdAt', 'desc')

      // Allow empty params - will return all results with pagination
      const paginatedResult = await paginate(orderedQuery, ctx)

      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult }
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
   * /key-loans/by-rental-object/{rentalObjectCode}:
   *   get:
   *     summary: Get key loans with enriched keys and receipts
   *     description: |
   *       Returns all key loans for a rental object with their keys and receipts
   *       pre-fetched in a single optimized query. This eliminates N+1 query problems.
   *       Optionally filter by contact code and return status.
   *     tags: [Key Loans]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code to filter key loans by.
   *       - in: query
   *         name: contact
   *         required: false
   *         schema:
   *           type: string
   *         description: Optional contact code to filter by (checks contact or contact2).
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
   *         description: List of key loans with enriched keys and receipts data.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyLoanWithDetails'
   *       500:
   *         description: An error occurred while fetching key loans.
   */
  router.get('/key-loans/by-rental-object/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['returned'])
    try {
      const { rentalObjectCode } = ctx.params
      const contact = ctx.query.contact as string | undefined
      const contact2 = ctx.query.contact2 as string | undefined
      const includeReceipts = ctx.query.includeReceipts === 'true'
      const returnedParam = ctx.query.returned

      // Parse returned query param: 'true' => true, 'false' => false, undefined => undefined
      let returned: boolean | undefined = undefined
      if (returnedParam === 'true') {
        returned = true
      } else if (returnedParam === 'false') {
        returned = false
      }

      const rows = await keyLoansAdapter.getKeyLoansByRentalObject(
        rentalObjectCode,
        contact,
        contact2,
        includeReceipts,
        returned,
        db
      )

      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key loans by rental object')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loans/by-contact/{contact}/with-keys:
   *   get:
   *     summary: Get key loans for a contact with full key details
   *     description: |
   *       Returns all key loan records for the specified contact with joined key data.
   *       Supports filtering by loanType and returned status via query parameters.
   *     tags: [Key Loans]
   *     parameters:
   *       - in: path
   *         name: contact
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code to filter by (company name or contact code)
   *       - in: query
   *         name: loanType
   *         required: false
   *         schema:
   *           type: string
   *           enum: [TENANT, MAINTENANCE]
   *         description: Filter by loan type
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
   *                     $ref: '#/components/schemas/KeyLoanWithDetails'
   *       500:
   *         description: Internal server error
   */
  router.get('/key-loans/by-contact/:contact/with-keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['loanType', 'returned'])
    try {
      const { contact } = ctx.params
      const loanTypeParam = ctx.query.loanType as string | undefined
      const returnedParam = ctx.query.returned

      // Parse loanType query param
      let loanType: 'TENANT' | 'MAINTENANCE' | undefined = undefined
      if (loanTypeParam === 'TENANT' || loanTypeParam === 'MAINTENANCE') {
        loanType = loanTypeParam
      }

      // Parse returned query param: 'true' => true, 'false' => false, undefined => undefined
      let returned: boolean | undefined = undefined
      if (returnedParam === 'true') {
        returned = true
      } else if (returnedParam === 'false') {
        returned = false
      }

      const loans = await keyLoansAdapter.getKeyLoansWithKeysByContact(
        contact,
        loanType,
        returned,
        db
      )

      ctx.status = 200
      ctx.body = { content: loans, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key loans with keys by contact')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /key-loans/by-bundle/{bundleId}/with-keys:
   *   get:
   *     summary: Get key loans for a key bundle with full key details
   *     description: |
   *       Returns all key loan records containing keys from the specified bundle.
   *       Supports filtering by loanType and returned status via query parameters.
   *     tags: [Key Loans]
   *     parameters:
   *       - in: path
   *         name: bundleId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key bundle ID to filter by
   *       - in: query
   *         name: loanType
   *         required: false
   *         schema:
   *           type: string
   *           enum: [TENANT, MAINTENANCE]
   *         description: Filter by loan type
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
   *                     $ref: '#/components/schemas/KeyLoanWithDetails'
   *       500:
   *         description: Internal server error
   */
  router.get('/key-loans/by-bundle/:bundleId/with-keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['loanType', 'returned'])
    try {
      const { bundleId } = ctx.params
      const loanTypeParam = ctx.query.loanType as string | undefined
      const returnedParam = ctx.query.returned

      // Parse loanType query param
      let loanType: 'TENANT' | 'MAINTENANCE' | undefined = undefined
      if (loanTypeParam === 'TENANT' || loanTypeParam === 'MAINTENANCE') {
        loanType = loanTypeParam
      }

      // Parse returned query param: 'true' => true, 'false' => false, undefined => undefined
      let returned: boolean | undefined = undefined
      if (returnedParam === 'true') {
        returned = true
      } else if (returnedParam === 'false') {
        returned = false
      }

      const loans = await keyLoansAdapter.getKeyLoansWithKeysByBundle(
        bundleId,
        loanType,
        returned,
        db
      )

      ctx.status = 200
      ctx.body = { content: loans, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key loans with keys by bundle')
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

        // Validate that at least keys or keyCards is provided
        if (!payload.keys && !payload.keyCards) {
          ctx.status = 400
          ctx.body = {
            reason: 'At least one of keys or keyCards must be provided',
            ...metadata,
          }
          return
        }

        // Validate keys if provided
        if (payload.keys) {
          const validationResult = await keyLoanService.validateKeyLoanCreation(
            payload.keys,
            db
          )

          if (!validationResult.ok) {
            // Map service errors to HTTP responses
            if (validationResult.err === 'active-loan-conflict') {
              ctx.status = 409
              ctx.body = {
                reason:
                  'Cannot create loan. One or more keys already have active loans.',
                conflictingKeys: validationResult.details?.conflictingKeys,
                ...metadata,
              }
              return
            }

            // All other errors are 400 Bad Request
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

        // Validate returnedAt updates (prevent marking unpicked loans as returned)
        if (payload.returnedAt !== undefined) {
          const existingLoan = await keyLoansAdapter.getKeyLoanById(
            ctx.params.id,
            db
          )

          if (!existingLoan) {
            ctx.status = 404
            ctx.body = {
              reason: `Key loan with id ${ctx.params.id} not found`,
              ...metadata,
            }
            return
          }

          // Log reactivation (clearing returnedAt)
          if (!payload.returnedAt && existingLoan.returnedAt) {
            logger.info(
              {
                loanId: ctx.params.id,
                userId: ctx.state.user?.id,
              },
              'Loan reactivated by clearing returnedAt'
            )
          }
        }

        // If updating keys, validate using service layer
        if (payload.keys) {
          const validationResult = await keyLoanService.validateKeyLoanUpdate(
            ctx.params.id,
            payload.keys,
            db
          )

          if (!validationResult.ok) {
            // Map service errors to HTTP responses
            if (validationResult.err === 'active-loan-conflict') {
              ctx.status = 409
              ctx.body = {
                reason:
                  'Cannot update loan. One or more keys already have active loans.',
                conflictingKeys: validationResult.details?.conflictingKeys,
                ...metadata,
              }
              return
            }

            // All other errors are 400 Bad Request
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
      // Fetch loan to validate deletion is safe
      const loan = await keyLoansAdapter.getKeyLoanById(ctx.params.id, db)

      if (!loan) {
        ctx.status = 404
        ctx.body = {
          reason: `Key loan with id ${ctx.params.id} not found`,
          ...metadata,
        }
        return
      }

      const isActive = loan.pickedUpAt && !loan.returnedAt
      if (isActive) {
        ctx.status = 400
        ctx.body = {
          reason:
            'Cannot delete active loan. Keys must be returned before deletion.',
          code: 'ACTIVE_LOAN_CANNOT_DELETE',
          ...metadata,
        }
        return
      }

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
