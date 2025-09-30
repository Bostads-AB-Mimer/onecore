//TODO update     const payload = ctx.request.body ?

import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import {
  KeyLoansApi,
  KeysApi,
  KeySystemsApi,
  LogsApi,
} from '../../adapters/keys-adapter'
import { keys } from '@onecore/types'
import { registerSchema } from '../../utils/openapi'

const {
  KeySchema,
  KeyLoanSchema,
  KeySystemSchema,
  LogSchema,
  CreateKeyRequestSchema,
  UpdateKeyRequestSchema,
  CreateKeyLoanRequestSchema,
  UpdateKeyLoanRequestSchema,
  CreateKeySystemRequestSchema,
  UpdateKeySystemRequestSchema,
  CreateLogRequestSchema,
  UpdateLogRequestSchema,
} = keys.v1

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Keys Service
 *     description: Operations related to key management
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: "Internal server error"
 *     NotFoundResponse:
 *       type: object
 *       properties:
 *         reason:
 *           type: string
 *           example: "Resource not found"
 * security:
 *   - bearerAuth: []
 */
export const routes = (router: KoaRouter) => {
  // Register schemas from @onecore/types
  registerSchema('Key', KeySchema)
  registerSchema('KeyLoan', KeyLoanSchema)
  registerSchema('KeySystem', KeySystemSchema)
  registerSchema('Log', LogSchema)
  registerSchema('CreateKeyRequest', CreateKeyRequestSchema)
  registerSchema('UpdateKeyRequest', UpdateKeyRequestSchema)
  registerSchema('CreateKeyLoanRequest', CreateKeyLoanRequestSchema)
  registerSchema('UpdateKeyLoanRequest', UpdateKeyLoanRequestSchema)
  registerSchema('CreateKeySystemRequest', CreateKeySystemRequestSchema)
  registerSchema('UpdateKeySystemRequest', UpdateKeySystemRequestSchema)
  registerSchema('CreateLogRequest', CreateLogRequestSchema)
  registerSchema('UpdateLogRequest', UpdateLogRequestSchema)

  // ==================== KEY LOANS ROUTES ====================

  /**
   * @swagger
   * /key-loans:
   *   get:
   *     summary: List all key loans
   *     description: Fetches a list of all key loans ordered by creation date.
   *     tags: [Keys Service]
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
   *                     $ref: '#/components/schemas/KeyLoan'
   *       500:
   *         description: An error occurred while listing key loans.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-loans', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoansApi.list()

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching key loans')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
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
   *     tags: [Keys Service]
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
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-loans/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    const result = await KeyLoansApi.search(ctx.query)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { reason: 'Invalid search parameters', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error searching key loans')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-loans/{id}:
   *   get:
   *     summary: Get key loan by ID
   *     description: Fetch a specific key loan by its ID.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
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
   *                   $ref: '#/components/schemas/KeyLoan'
   *       404:
   *         description: Key loan not found.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: An error occurred while fetching the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoansApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key loan not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-loans:
   *   post:
   *     summary: Create a new key loan
   *     description: Create a new key loan record.
   *     tags: [Keys Service]
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
   *                   $ref: '#/components/schemas/KeyLoan'
   *       400:
   *         description: Invalid request data.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: An error occurred while creating the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.post('/key-loans', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeyLoansApi.create(payload)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-loans/{id}:
   *   patch:
   *     summary: Update a key loan
   *     description: Partially update an existing key loan.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
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
   *                   $ref: '#/components/schemas/KeyLoan'
   *       400:
   *         description: Invalid request data.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Key loan not found.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: An error occurred while updating the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeyLoansApi.update(ctx.params.id, payload)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key loan not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-loans/{id}:
   *   delete:
   *     summary: Delete a key loan
   *     description: Delete an existing key loan by ID.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The unique ID of the key loan to delete.
   *     responses:
   *       200:
   *         description: Key loan deleted successfully.
   *       404:
   *         description: Key loan not found.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: An error occurred while deleting the key loan.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoansApi.remove(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key loan not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error deleting key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
  })

  // ==================== KEYS ROUTES ====================

  /**
   * @swagger
   * /keys:
   *   get:
   *     summary: List keys
   *     description: Returns keys ordered by createAt (desc).
   *     tags: [Keys Service]
   *     responses:
   *       200:
   *         description: List of keys
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
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeysApi.list()

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching keys')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys/search:
   *   get:
   *     summary: Search keys
   *     description: |
   *       Search keys with flexible filtering.
   *       - **OR search**: Use `q` with `fields` for multiple field search
   *       - **AND search**: Use any Key field parameter for filtering
   *       - **Comparison operators**: Prefix values with `>`, `<`, `>=`, `<=` for date/number comparisons
   *       - Only one OR group is supported, but you can combine it with multiple AND filters
   *     tags: [Keys Service]
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
   *         description: Comma-separated list of fields for OR search. Defaults to keyName.
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
   *         description: Bad request
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/keys/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    const result = await KeysApi.search(ctx.query)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { reason: 'Invalid search parameters', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error searching keys')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys/{id}:
   *   get:
   *     summary: Get key by ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Key found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Key'
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeysApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys:
   *   post:
   *     summary: Create a key
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateKeyRequest'
   *     responses:
   *       201:
   *         description: Created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Key'
   *       400:
   *         description: Invalid key_type
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.post('/keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeysApi.create(payload)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys/{id}:
   *   patch:
   *     summary: Update a key (partial)
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateKeyRequest'
   *     responses:
   *       200:
   *         description: Updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Key'
   *       400:
   *         description: Invalid key_type
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeysApi.update(ctx.params.id, payload)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /keys/{id}:
   *   delete:
   *     summary: Delete a key
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Deleted
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeysApi.remove(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error deleting key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
  })

  // ==================== KEY SYSTEMS ROUTES ====================

  /**
   * @swagger
   * /key-systems:
   *   get:
   *     summary: List all key systems
   *     description: Retrieve a list of all key systems
   *     tags: [Keys Service]
   *     responses:
   *       200:
   *         description: Successfully retrieved key systems
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeySystem'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-systems', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeySystemsApi.list()

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching key systems')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
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
   *     tags: [Keys Service]
   *     parameters:
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
   *         name: description
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
   *         description: Successfully retrieved search results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeySystem'
   *       400:
   *         description: Bad request. Invalid parameters or field names
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-systems/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    const result = await KeySystemsApi.search(ctx.query)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { reason: 'Invalid search parameters', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error searching key systems')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-systems/{id}:
   *   get:
   *     summary: Get key system by ID
   *     description: Retrieve a specific key system by its ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
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
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeySystemsApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-systems:
   *   post:
   *     summary: Create a new key system
   *     description: Create a new key system
   *     tags: [Keys Service]
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
   *         description: Invalid type or duplicate system code
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.post('/key-systems', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeySystemsApi.create(payload)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-systems/{id}:
   *   patch:
   *     summary: Update a key system
   *     description: Partially update a key system
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
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
   *         description: Invalid type or duplicate system code
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Key system not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/key-systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeySystemsApi.update(ctx.params.id, payload)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-systems/{id}:
   *   delete:
   *     summary: Delete a key system
   *     description: Delete a key system by ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the key system to delete
   *     responses:
   *       200:
   *         description: Key system deleted successfully
   *       404:
   *         description: Key system not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/key-systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeySystemsApi.remove(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error deleting key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
  })

  // ==================== LOGS ROUTES ====================

  /**
   * @swagger
   * /logs:
   *   get:
   *     summary: List logs
   *     description: Returns logs ordered by eventTime (desc).
   *     tags: [Keys Service]
   *     responses:
   *       200:
   *         description: List of logs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Log'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/logs', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await LogsApi.list()

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching logs')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /logs/search:
   *   get:
   *     summary: Search logs
   *     description: |
   *       Search logs with flexible filtering.
   *       - **OR search**: Use `q` with `fields` for multiple field search
   *       - **AND search**: Use any Log field parameter for filtering
   *       - **Comparison operators**: Prefix values with `>`, `<`, `>=`, `<=` for date/number comparisons
   *       - Only one OR group is supported, but you can combine it with multiple AND filters
   *     tags: [Keys Service]
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
   *         description: Comma-separated list of fields for OR search. Defaults to resourceId.
   *       - in: query
   *         name: id
   *         schema:
   *           type: string
   *       - in: query
   *         name: eventType
   *         schema:
   *           type: string
   *       - in: query
   *         name: eventTime
   *         schema:
   *           type: string
   *       - in: query
   *         name: actor
   *         schema:
   *           type: string
   *       - in: query
   *         name: resourceType
   *         schema:
   *           type: string
   *       - in: query
   *         name: resourceId
   *         schema:
   *           type: string
   *       - in: query
   *         name: details
   *         schema:
   *           type: string
   *       - in: query
   *         name: createdAt
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
   *                     $ref: '#/components/schemas/Log'
   *       400:
   *         description: Bad request
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/logs/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    const result = await LogsApi.search(ctx.query)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { reason: 'Invalid search parameters', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error searching logs')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /logs/{id}:
   *   get:
   *     summary: Get log by ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Log found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Log'
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await LogsApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Log not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /logs:
   *   post:
   *     summary: Create a log
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateLogRequest'
   *     responses:
   *       201:
   *         description: Created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Log'
   *       400:
   *         description: Invalid or missing fields
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.post('/logs', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await LogsApi.create(payload)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /logs/{id}:
   *   patch:
   *     summary: Update a log (partial)
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateLogRequest'
   *     responses:
   *       200:
   *         description: Updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Log'
   *       400:
   *         description: Invalid event_type or object_type
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await LogsApi.update(ctx.params.id, payload)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Log not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /logs/{id}:
   *   delete:
   *     summary: Delete a log
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Deleted
   *       404:
   *         description: Not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await LogsApi.remove(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Log not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error deleting log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
  })
}
