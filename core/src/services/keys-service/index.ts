import KoaRouter from '@koa/router'
import multer from '@koa/multer'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import {
  KeyLoansApi,
  KeysApi,
  KeySystemsApi,
  LogsApi,
  KeyNotesApi,
  ReceiptsApi,
} from '../../adapters/keys-adapter'
import { keys } from '@onecore/types'
import { registerSchema } from '../../utils/openapi'

const {
  KeySchema,
  KeyLoanSchema,
  KeySystemSchema,
  LogSchema,
  KeyNoteSchema,
  ReceiptSchema,
  CreateKeyRequestSchema,
  UpdateKeyRequestSchema,
  CreateKeyLoanRequestSchema,
  UpdateKeyLoanRequestSchema,
  CreateKeySystemRequestSchema,
  UpdateKeySystemRequestSchema,
  CreateLogRequestSchema,
  CreateKeyNoteRequestSchema,
  UpdateKeyNoteRequestSchema,
  PaginationMetaSchema,
  PaginationLinksSchema,
  createPaginatedResponseSchema,
  CreateReceiptRequestSchema,
  ReceiptTypeSchema,
  ReceiptFormatSchema,
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
  registerSchema('KeyNote', KeyNoteSchema)
  registerSchema('Receipt', ReceiptSchema)
  registerSchema('CreateKeyRequest', CreateKeyRequestSchema)
  registerSchema('UpdateKeyRequest', UpdateKeyRequestSchema)
  registerSchema('CreateKeyLoanRequest', CreateKeyLoanRequestSchema)
  registerSchema('UpdateKeyLoanRequest', UpdateKeyLoanRequestSchema)
  registerSchema('CreateKeySystemRequest', CreateKeySystemRequestSchema)
  registerSchema('UpdateKeySystemRequest', UpdateKeySystemRequestSchema)
  registerSchema('CreateLogRequest', CreateLogRequestSchema)
  registerSchema('CreateKeyNoteRequest', CreateKeyNoteRequestSchema)
  registerSchema('UpdateKeyNoteRequest', UpdateKeyNoteRequestSchema)
  registerSchema('CreateReceiptRequest', CreateReceiptRequestSchema)
  registerSchema('ReceiptType', ReceiptTypeSchema)
  registerSchema('ReceiptFormat', ReceiptFormatSchema)

  // Helper function to create log entries
  const createLogEntry = async (
    user: any,
    eventType: 'creation' | 'update' | 'delete',
    objectType: 'key' | 'keySystem' | 'keyLoan',
    objectId: string,
    description?: string
  ) => {
    try {
      await LogsApi.create({
        userName: user?.name || user?.preferred_username || 'system',
        eventType,
        objectType,
        objectId,
        description,
      })
    } catch (error) {
      // Log the error but don't fail the main operation
      logger.error(
        { error, eventType, objectType, objectId },
        'Failed to create log entry'
      )
    }
  }

  // Helper function to build key loan description
  const buildKeyLoanDescription = async (
    keyLoan: {
      contact?: string
      keys: string
      lease?: string
    },
    action: 'Skapad' | 'Uppdaterad' | 'Raderad'
  ): Promise<string> => {
    const parts: string[] = [`${action} nyckellån`]

    if (keyLoan.contact) {
      parts.push(`för kontakt ${keyLoan.contact}`)
    }

    // Fetch key names from key IDs
    let keyNames: string[] = []
    try {
      const keyIds = JSON.parse(keyLoan.keys) as string[]
      if (Array.isArray(keyIds) && keyIds.length > 0) {
        const keyPromises = keyIds.map((id) => KeysApi.get(id))
        const keyResults = await Promise.all(keyPromises)
        keyNames = keyResults
          .filter((r) => r.ok)
          .map((r) => {
            if (!r.ok) return ''
            const key = r.data
            return key.keySequenceNumber
              ? `${key.keyName} ${key.keySequenceNumber}`
              : key.keyName
          })
          .filter((name) => name !== '')
      }
    } catch (error) {
      // If parsing fails or keys not found, fall back to the raw keys string
      logger.warn({ error, keys: keyLoan.keys }, 'Failed to parse key IDs')
      keyNames = [keyLoan.keys]
    }

    if (keyNames.length > 0) {
      parts.push(`nycklar: ${keyNames.join(', ')}`)
    }

    if (keyLoan.lease) {
      parts.push(`avtal: ${keyLoan.lease}`)
    }

    return parts.join(', ')
  }

  // Register pagination schemas
  registerSchema('PaginationMeta', PaginationMetaSchema)
  registerSchema('PaginationLinks', PaginationLinksSchema)
  registerSchema(
    'PaginatedKeysResponse',
    createPaginatedResponseSchema(KeySchema)
  )
  registerSchema(
    'PaginatedKeySystemsResponse',
    createPaginatedResponseSchema(KeySystemSchema)
  )
  registerSchema(
    'PaginatedLogsResponse',
    createPaginatedResponseSchema(LogSchema)
  )

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
      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = {
          error: 'One or more keys already have active loans',
          ...metadata,
        }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    // Create log entry after successful creation
    const description = await buildKeyLoanDescription(result.data, 'Skapad')
    await createLogEntry(
      ctx.state.user,
      'creation',
      'keyLoan',
      result.data.id,
      description
    )

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
      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = {
          error: 'One or more keys already have active loans',
          ...metadata,
        }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key loan')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    // Create log entry after successful update
    const description = await buildKeyLoanDescription(result.data, 'Uppdaterad')
    await createLogEntry(
      ctx.state.user,
      'update',
      'keyLoan',
      result.data.id,
      description
    )

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

    // Fetch the key loan first to get details for the log
    const getResult = await KeyLoansApi.get(ctx.params.id)
    if (!getResult.ok) {
      if (getResult.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key loan not found', ...metadata }
        return
      }
      logger.error(
        { err: getResult.err, metadata },
        'Error fetching key loan before deletion'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const description = await buildKeyLoanDescription(getResult.data, 'Raderad')

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

    // Create log entry after successful deletion
    await createLogEntry(
      ctx.state.user,
      'delete',
      'keyLoan',
      ctx.params.id,
      description
    )

    ctx.status = 200
    ctx.body = { ...metadata }
  })

  // ==================== KEYS ROUTES ====================

  /**
   * @swagger
   * /keys:
   *   get:
   *     summary: List keys with pagination
   *     description: Returns paginated keys ordered by createdAt (desc).
   *     tags: [Keys Service]
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
   *         description: Paginated list of keys
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedKeysResponse'
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

    const page = ctx.query.page ? parseInt(ctx.query.page as string) : undefined
    const limit = ctx.query.limit
      ? parseInt(ctx.query.limit as string)
      : undefined

    const result = await KeysApi.list(page, limit)

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching keys')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
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
   *         description: Successfully retrieved paginated search results
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedKeysResponse'
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
    ctx.body = { ...metadata, ...result.data }
  })

  /**
   * @swagger
   * /keys/by-rental-object/{rentalObjectCode}:
   *   get:
   *     summary: Get all keys by rental object code
   *     description: Returns all keys associated with a specific rental object code without pagination
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code to filter keys by
   *     responses:
   *       200:
   *         description: Successfully retrieved keys
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
  router.get('/keys/by-rental-object/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeysApi.getByRentalObjectCode(
      ctx.params.rentalObjectCode
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching keys by rental object code'
      )
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

    // Create log entry after successful creation
    const keyDescription = result.data.keySequenceNumber
      ? `${result.data.keyName} ${result.data.keySequenceNumber}`
      : result.data.keyName
    await createLogEntry(
      ctx.state.user,
      'creation',
      'key',
      result.data.id,
      `Skapad nyckel ${keyDescription}`
    )

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

    // Create log entry after successful update
    const keyDescription = result.data.keySequenceNumber
      ? `${result.data.keyName} ${result.data.keySequenceNumber}`
      : result.data.keyName
    await createLogEntry(
      ctx.state.user,
      'update',
      'key',
      result.data.id,
      `Uppdaterad nyckel ${keyDescription}`
    )

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

    // Fetch the key first to get keyName and keySequenceNumber for the log
    const getResult = await KeysApi.get(ctx.params.id)
    if (!getResult.ok) {
      if (getResult.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key not found', ...metadata }
        return
      }
      logger.error(
        { err: getResult.err, metadata },
        'Error fetching key before deletion'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const keyDescription = getResult.data.keySequenceNumber
      ? `${getResult.data.keyName} ${getResult.data.keySequenceNumber}`
      : getResult.data.keyName

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

    // Create log entry after successful deletion
    await createLogEntry(
      ctx.state.user,
      'delete',
      'key',
      ctx.params.id,
      `Raderad nyckel ${keyDescription}`
    )

    ctx.status = 200
    ctx.body = { ...metadata }
  })

  // ==================== KEY SYSTEMS ROUTES ====================

  /**
   * @swagger
   * /key-systems:
   *   get:
   *     summary: List all key systems with pagination
   *     description: Retrieve a paginated list of all key systems
   *     tags: [Keys Service]
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
   *         description: Successfully retrieved paginated key systems
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedKeySystemsResponse'
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

    const page = ctx.query.page ? parseInt(ctx.query.page as string) : undefined
    const limit = ctx.query.limit
      ? parseInt(ctx.query.limit as string)
      : undefined

    const result = await KeySystemsApi.list(page, limit)

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching key systems')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
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
   *         description: Successfully retrieved paginated search results
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedKeySystemsResponse'
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
    ctx.body = { ...metadata, ...result.data }
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
      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = {
          error: 'A key system with this code already exists',
          ...metadata,
        }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    // Create log entry after successful creation
    await createLogEntry(
      ctx.state.user,
      'creation',
      'keySystem',
      result.data.id,
      `Skapat nyckelsystem ${result.data.systemCode}`
    )

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
      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = {
          error: 'A key system with this code already exists',
          ...metadata,
        }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    // Create log entry after successful update
    await createLogEntry(
      ctx.state.user,
      'update',
      'keySystem',
      result.data.id,
      `Uppdaterat nyckelsystem ${result.data.systemCode}`
    )

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

    // Fetch the key system first to get systemCode for the log
    const getResult = await KeySystemsApi.get(ctx.params.id)
    if (!getResult.ok) {
      if (getResult.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }
      logger.error(
        { err: getResult.err, metadata },
        'Error fetching key system before deletion'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const systemCode = getResult.data.systemCode

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

    // Create log entry after successful deletion
    await createLogEntry(
      ctx.state.user,
      'delete',
      'keySystem',
      ctx.params.id,
      `Raderat nyckelsystem ${systemCode}`
    )

    ctx.status = 200
    ctx.body = { ...metadata }
  })

  // ==================== LOGS ROUTES ====================

  /**
   * @swagger
   * /logs:
   *   get:
   *     summary: List logs with pagination
   *     description: Returns paginated logs (most recent per objectId) ordered by eventTime (desc).
   *     tags: [Keys Service]
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
   *         description: Paginated list of logs
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedLogsResponse'
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

    const page = ctx.query.page ? parseInt(ctx.query.page as string) : undefined
    const limit = ctx.query.limit
      ? parseInt(ctx.query.limit as string)
      : undefined

    const result = await LogsApi.list(page, limit)

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching logs')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })

  /**
   * @swagger
   * /logs/search:
   *   get:
   *     summary: Search logs with pagination
   *     description: |
   *       Search logs with flexible filtering and pagination.
   *       - **OR search**: Use `q` with `fields` for multiple field search
   *       - **AND search**: Use any Log field parameter for filtering
   *       - **Comparison operators**: Prefix values with `>`, `<`, `>=`, `<=` for date/number comparisons
   *       - Only one OR group is supported, but you can combine it with multiple AND filters
   *     tags: [Keys Service]
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
   *         description: Comma-separated list of fields for OR search. Defaults to objectId.
   *       - in: query
   *         name: id
   *         schema:
   *           type: string
   *       - in: query
   *         name: userName
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
   *         name: objectType
   *         schema:
   *           type: string
   *       - in: query
   *         name: objectId
   *         schema:
   *           type: string
   *       - in: query
   *         name: description
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Successfully retrieved paginated search results
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedLogsResponse'
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
    const metadata = generateRouteMetadata(ctx, [
      'q',
      'fields',
      'page',
      'limit',
    ])

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
    ctx.body = { ...metadata, ...result.data }
  })

  /**
   * @swagger
   * /logs/object/{objectId}:
   *   get:
   *     summary: Get all logs for a specific objectId
   *     description: Returns all log entries for a given objectId, ordered by most recent first
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: objectId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of logs for the objectId
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
  router.get('/logs/object/:objectId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await LogsApi.getByObjectId(ctx.params.objectId)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching logs for objectId'
      )
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

  // ==================== KEY NOTES ROUTES ====================

  /**
   * @swagger
   * /key-notes/{id}:
   *   get:
   *     summary: Get key note by ID
   *     description: Retrieve a specific key note by its ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the key note
   *     responses:
   *       200:
   *         description: Successfully retrieved key note
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyNote'
   *       404:
   *         description: Key note not found
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
  router.get('/key-notes/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyNotesApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key note not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching key note')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-notes/by-rental-object/{rentalObjectCode}:
   *   get:
   *     summary: Get key note by rental object code
   *     description: Retrieve the key note for a specific rental object
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code
   *     responses:
   *       200:
   *         description: Successfully retrieved key note
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyNote'
   *       404:
   *         description: Key note not found
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
  router.get('/key-notes/by-rental-object/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyNotesApi.getByRentalObjectCode(
      ctx.params.rentalObjectCode
    )

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key note not found', ...metadata }
        return
      }

      logger.error(
        { err: result.err, metadata },
        'Error fetching key note by rental object'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-notes:
   *   post:
   *     summary: Create a new key note
   *     description: Create a new key note for a rental object
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateKeyNoteRequest'
   *     responses:
   *       201:
   *         description: Key note created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyNote'
   *       400:
   *         description: Invalid request data
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
  router.post('/key-notes', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeyNotesApi.create(payload)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key note')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-notes/{id}:
   *   patch:
   *     summary: Update a key note
   *     description: Update the description of an existing key note
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the key note to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateKeyNoteRequest'
   *     responses:
   *       200:
   *         description: Key note updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyNote'
   *       400:
   *         description: Invalid request data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Key note not found
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
  router.patch('/key-notes/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeyNotesApi.update(ctx.params.id, payload)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key note not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key note')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  // ==================== RECEIPTS ROUTES ====================

  /**
   * @swagger
   * /receipts:
   *   post:
   *     summary: Create a receipt
   *     description: Create a new receipt record for a key loan
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - keyLoanId
   *               - receiptType
   *               - type
   *             properties:
   *               keyLoanId:
   *                 type: string
   *                 format: uuid
   *               receiptType:
   *                 type: string
   *                 enum: [LOAN, RETURN]
   *               type:
   *                 type: string
   *                 enum: [DIGITAL, PHYSICAL]
   *               signed:
   *                 type: boolean
   *                 default: false
   *               fileId:
   *                 type: string
   *                 nullable: true
   *     responses:
   *       201:
   *         description: Receipt created successfully
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
   *                       format: uuid
   *                     keyLoanId:
   *                       type: string
   *                       format: uuid
   *                     receiptType:
   *                       type: string
   *                       enum: [LOAN, RETURN]
   *                     type:
   *                       type: string
   *                       enum: [DIGITAL, PHYSICAL]
   *                     signed:
   *                       type: boolean
   *                     fileId:
   *                       type: string
   *                       nullable: true
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *       400:
   *         description: Invalid request data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: Receipt already exists for this keyLoanId
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
  router.post('/receipts', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await ReceiptsApi.create(payload)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = {
          error: 'Receipt already exists for this keyLoanId',
          ...metadata,
        }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating receipt')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /receipts/by-key-loan/{keyLoanId}:
   *   get:
   *     summary: Get receipt by key loan ID
   *     description: Retrieve a receipt associated with a specific key loan
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: keyLoanId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The key loan ID to filter receipts by
   *     responses:
   *       200:
   *         description: Successfully retrieved receipt
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
   *                       format: uuid
   *                     keyLoanId:
   *                       type: string
   *                       format: uuid
   *                     receiptType:
   *                       type: string
   *                       enum: [LOAN, RETURN]
   *                     type:
   *                       type: string
   *                       enum: [DIGITAL, PHYSICAL]
   *                     signed:
   *                       type: boolean
   *                     fileId:
   *                       type: string
   *                       nullable: true
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *       404:
   *         description: Receipt not found
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
  router.get('/receipts/by-key-loan/:keyLoanId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await ReceiptsApi.getByKeyLoan(ctx.params.keyLoanId)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching receipts by key loan'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /receipts/{id}:
   *   delete:
   *     summary: Delete a receipt
   *     description: Delete a receipt by ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the receipt to delete
   *     responses:
   *       200:
   *         description: Receipt deleted successfully
   *       404:
   *         description: Receipt not found
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
  router.patch('/receipts/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await ReceiptsApi.update(ctx.params.id, payload)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Receipt not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating receipt')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.delete('/receipts/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await ReceiptsApi.remove(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Receipt not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error deleting receipt')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
  })

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: (_req, file, cb) => {
      // Only accept PDF files
      if (file.mimetype === 'application/pdf') {
        cb(null, true)
      } else {
        cb(new Error('Only PDF files are allowed'), false)
      }
    },
  })

  /**
   * @swagger
   * /receipts/{id}/upload:
   *   post:
   *     summary: Upload PDF file for a receipt
   *     description: Upload a PDF file to attach to an existing receipt
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the receipt to attach the file to
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *     responses:
   *       200:
   *         description: File uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     fileId:
   *                       type: string
   *                     fileName:
   *                       type: string
   *                     size:
   *                       type: number
   *       400:
   *         description: Invalid file or receipt not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Receipt not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       413:
   *         description: File too large
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
  router.post('/receipts/:id/upload', upload.single('file'), async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      // Check if file was provided
      if (!ctx.file || !ctx.file.buffer) {
        ctx.status = 400
        ctx.body = { reason: 'No file provided', ...metadata }
        return
      }

      // Forward the file buffer to microservice
      const result = await ReceiptsApi.uploadFile(
        ctx.params.id,
        ctx.file.buffer,
        ctx.file.originalname,
        ctx.file.mimetype
      )

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { reason: 'Receipt not found', ...metadata }
          return
        }
        if (result.err === 'bad-request') {
          ctx.status = 400
          ctx.body = { reason: 'Invalid file or receipt', ...metadata }
          return
        }

        logger.error({ err: result.err, metadata }, 'Error uploading file')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } catch (err) {
      logger.error({ err }, 'Error uploading file')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /receipts/{id}/download:
   *   get:
   *     summary: Get presigned download URL for receipt PDF
   *     description: Generate a presigned URL to download the PDF file attached to a receipt
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the receipt
   *     responses:
   *       200:
   *         description: Download URL generated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     url:
   *                       type: string
   *                     expiresIn:
   *                       type: number
   *                     fileId:
   *                       type: string
   *       404:
   *         description: Receipt or file not found
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
  router.get('/receipts/:id/download', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await ReceiptsApi.getDownloadUrl(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Receipt or file not found', ...metadata }
        return
      }

      logger.error(
        { err: result.err, metadata },
        'Error generating download URL'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })
}
