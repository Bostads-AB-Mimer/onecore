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
  KeyEventsApi,
  KeyBundlesApi,
  KeyLoanMaintenanceKeysApi,
  SignaturesApi,
} from '../../adapters/keys-adapter'
import { keys } from '@onecore/types'
import { registerSchema } from '../../utils/openapi'

const {
  KeySchema,
  KeyWithLoanStatusSchema,
  KeyLoanSchema,
  KeyLoanWithDetailsSchema,
  KeySystemSchema,
  LogSchema,
  KeyNoteSchema,
  KeyBundleSchema,
  KeyLoanMaintenanceKeysSchema,
  KeyLoanMaintenanceKeysWithDetailsSchema,
  KeyWithMaintenanceLoanStatusSchema,
  KeyBundleWithLoanStatusResponseSchema,
  ReceiptSchema,
  KeyEventSchema,
  SignatureSchema,
  CreateKeyRequestSchema,
  UpdateKeyRequestSchema,
  BulkUpdateFlexRequestSchema,
  CreateKeyLoanRequestSchema,
  UpdateKeyLoanRequestSchema,
  CreateKeySystemRequestSchema,
  UpdateKeySystemRequestSchema,
  CreateLogRequestSchema,
  CreateKeyNoteRequestSchema,
  UpdateKeyNoteRequestSchema,
  CreateKeyBundleRequestSchema,
  UpdateKeyBundleRequestSchema,
  CreateKeyLoanMaintenanceKeysRequestSchema,
  UpdateKeyLoanMaintenanceKeysRequestSchema,
  CreateKeyEventRequestSchema,
  UpdateKeyEventRequestSchema,
  CreateSignatureRequestSchema,
  UpdateSignatureRequestSchema,
  SendSignatureRequestSchema,
  SimpleSignWebhookPayloadSchema,
  PaginationMetaSchema,
  PaginationLinksSchema,
  createPaginatedResponseSchema,
  CreateReceiptRequestSchema,
  UpdateReceiptRequestSchema,
  ReceiptTypeSchema,
  ReceiptFormatSchema,
  ErrorResponseSchema,
  NotFoundResponseSchema,
  BadRequestResponseSchema,
  SchemaDownloadUrlResponseSchema,
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
  registerSchema('KeyWithLoanStatus', KeyWithLoanStatusSchema)
  registerSchema('KeyLoan', KeyLoanSchema)
  registerSchema('KeyLoanWithDetails', KeyLoanWithDetailsSchema)
  registerSchema('KeySystem', KeySystemSchema)
  registerSchema('Log', LogSchema)
  registerSchema('KeyNote', KeyNoteSchema)
  registerSchema('Receipt', ReceiptSchema)
  registerSchema('KeyEvent', KeyEventSchema)
  registerSchema('Signature', SignatureSchema)
  registerSchema('CreateKeyRequest', CreateKeyRequestSchema)
  registerSchema('UpdateKeyRequest', UpdateKeyRequestSchema)
  registerSchema('BulkUpdateFlexRequest', BulkUpdateFlexRequestSchema)
  registerSchema('CreateKeyLoanRequest', CreateKeyLoanRequestSchema)
  registerSchema('UpdateKeyLoanRequest', UpdateKeyLoanRequestSchema)
  registerSchema('CreateKeySystemRequest', CreateKeySystemRequestSchema)
  registerSchema('UpdateKeySystemRequest', UpdateKeySystemRequestSchema)
  registerSchema('CreateLogRequest', CreateLogRequestSchema)
  registerSchema('CreateKeyNoteRequest', CreateKeyNoteRequestSchema)
  registerSchema('UpdateKeyNoteRequest', UpdateKeyNoteRequestSchema)
  registerSchema('KeyBundle', KeyBundleSchema)
  registerSchema('CreateKeyBundleRequest', CreateKeyBundleRequestSchema)
  registerSchema('UpdateKeyBundleRequest', UpdateKeyBundleRequestSchema)
  registerSchema('KeyLoanMaintenanceKeys', KeyLoanMaintenanceKeysSchema)
  registerSchema(
    'KeyLoanMaintenanceKeysWithDetails',
    KeyLoanMaintenanceKeysWithDetailsSchema
  )
  registerSchema(
    'KeyWithMaintenanceLoanStatus',
    KeyWithMaintenanceLoanStatusSchema
  )
  registerSchema(
    'KeyBundleWithLoanStatusResponse',
    KeyBundleWithLoanStatusResponseSchema
  )
  registerSchema(
    'CreateKeyLoanMaintenanceKeysRequest',
    CreateKeyLoanMaintenanceKeysRequestSchema
  )
  registerSchema(
    'UpdateKeyLoanMaintenanceKeysRequest',
    UpdateKeyLoanMaintenanceKeysRequestSchema
  )
  registerSchema('CreateKeyEventRequest', CreateKeyEventRequestSchema)
  registerSchema('UpdateKeyEventRequest', UpdateKeyEventRequestSchema)
  registerSchema('CreateSignatureRequest', CreateSignatureRequestSchema)
  registerSchema('UpdateSignatureRequest', UpdateSignatureRequestSchema)
  registerSchema('SendSignatureRequest', SendSignatureRequestSchema)
  registerSchema('SimpleSignWebhookPayload', SimpleSignWebhookPayloadSchema)
  registerSchema('CreateReceiptRequest', CreateReceiptRequestSchema)
  registerSchema('UpdateReceiptRequest', UpdateReceiptRequestSchema)
  registerSchema('ReceiptType', ReceiptTypeSchema)
  registerSchema('ReceiptFormat', ReceiptFormatSchema)
  registerSchema('ErrorResponse', ErrorResponseSchema)
  registerSchema('NotFoundResponse', NotFoundResponseSchema)
  registerSchema('BadRequestResponse', BadRequestResponseSchema)
  registerSchema('SchemaDownloadUrlResponse', SchemaDownloadUrlResponseSchema)

  // Helper function to create log entries
  // Context (rentalObjectCode, contactId) is no longer stored - it's fetched via JOINs when filtering logs
  const createLogEntry = async (
    user: any,
    eventType: 'creation' | 'update' | 'delete',
    objectType:
      | 'key'
      | 'keySystem'
      | 'keyLoan'
      | 'keyBundle'
      | 'keyLoanMaintenanceKeys'
      | 'receipt'
      | 'keyEvent'
      | 'signature'
      | 'keyNote',
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

    // Add contact code to description (simplified - no longer fetching contact name)
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
   * /key-loans/by-key/{keyId}:
   *   get:
   *     summary: Get all loans for a specific key
   *     description: Returns all loan records for the specified key ID, ordered by creation date DESC
   *     tags: [Keys Service]
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
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-loans/by-key/:keyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoansApi.getByKey(ctx.params.keyId)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching loans by key ID'
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
   * /key-loans/by-rental-object/{rentalObjectCode}:
   *   get:
   *     summary: Get key loans by rental object code
   *     description: Returns all key loans for a specific rental object with keys and optional receipts
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code
   *       - in: query
   *         name: contact
   *         schema:
   *           type: string
   *         description: Filter by contact code
   *       - in: query
   *         name: contact2
   *         schema:
   *           type: string
   *         description: Filter by second contact code
   *       - in: query
   *         name: includeReceipts
   *         schema:
   *           type: boolean
   *         description: Include receipts in the response
   *     responses:
   *       200:
   *         description: A list of key loans with details
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
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-loans/by-rental-object/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'contact',
      'contact2',
      'includeReceipts',
    ])

    const contact = ctx.query.contact as string | undefined
    const contact2 = ctx.query.contact2 as string | undefined
    const includeReceipts = ctx.query.includeReceipts === 'true'

    const result = await KeyLoansApi.getByRentalObject(
      ctx.params.rentalObjectCode,
      contact,
      contact2,
      includeReceipts
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching key loans by rental object'
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
   * /keys/with-loan-status/{rentalObjectCode}:
   *   get:
   *     summary: Get keys with active loan status enriched
   *     description: |
   *       Returns all relevant keys for a rental object with their active loan information
   *       pre-fetched in a single optimized query. This eliminates N+1 query problems.
   *
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
   *         description: List of keys with enriched active loan data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyWithLoanStatus'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/keys/with-loan-status/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const includeLatestEvent = ctx.query.includeLatestEvent === 'true'

    const result = await KeysApi.getWithLoanStatus(
      ctx.params.rentalObjectCode,
      includeLatestEvent
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching keys with loan status'
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

    // Detect if this is a disposal operation
    const isDisposal = payload.disposed === true && result.data.disposed
    // Note: We use 'update' not 'delete' because disposal only sets disposed=true, doesn't delete from DB
    const eventType = 'update'
    const description = isDisposal
      ? `Kasserad nyckel ${keyDescription}`
      : `Uppdaterad nyckel ${keyDescription}`

    await createLogEntry(
      ctx.state.user,
      eventType,
      'key',
      result.data.id,
      description
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

  /**
   * @swagger
   * /keys/bulk-update-flex:
   *   post:
   *     summary: Bulk update flex number for all keys on a rental object
   *     description: Update the flex number for all keys associated with a specific rental object code. Flex numbers range from 1-3.
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BulkUpdateFlexRequest'
   *     responses:
   *       200:
   *         description: Flex numbers updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     updatedCount:
   *                       type: integer
   *                       description: Number of keys updated
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
  router.post('/keys/bulk-update-flex', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await KeysApi.bulkUpdateFlex(
      payload.rentalObjectCode,
      payload.flexNumber
    )

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error bulk updating flex')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
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

  /**
   * @swagger
   * /logs/rental-object/{rentalObjectCode}:
   *   get:
   *     summary: Get all logs for a specific rental object
   *     description: |
   *       Returns all log entries for a given rental object code by JOINing across multiple tables.
   *
   *       Included objectTypes: keys, keyLoans, receipts, keyEvents, keyNotes, keyBundles, keyLoanMaintenanceKeys, signatures
   *
   *       Excluded: keySystem logs (infrastructure-level, not property-specific)
   *
   *       Note: Uses current state via JOINs - if a key moved between properties, historical logs reflect current property assignment
   *
   *       Results ordered by most recent first
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code (e.g., "705-011-03-0102")
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
   *         description: Paginated list of logs for the rental object
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
  router.get('/logs/rental-object/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const page = ctx.query.page ? parseInt(ctx.query.page as string) : undefined
    const limit = ctx.query.limit
      ? parseInt(ctx.query.limit as string)
      : undefined

    const result = await LogsApi.getByRentalObjectCode(
      ctx.params.rentalObjectCode,
      page,
      limit
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching logs for rental object'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })

  /**
   * @swagger
   * /logs/contact/{contactId}:
   *   get:
   *     summary: Get all logs for a specific contact
   *     description: |
   *       Returns all log entries for a given contact code by JOINing across keyLoans and receipts.
   *
   *       Included objectTypes: keyLoans, receipts, signatures, keys (if in active loan)
   *
   *       Excluded: keyEvents, keyBundles, keyNotes, keySystem, keyLoanMaintenanceKeys (no contact relationship)
   *
   *       Note: Matches both contact and contact2 fields (co-tenants supported)
   *
   *       Results ordered by most recent first
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: contactId
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code (e.g., "P079586", "F123456")
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
   *         description: Paginated list of logs for the contact
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
  router.get('/logs/contact/:contactId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const page = ctx.query.page ? parseInt(ctx.query.page as string) : undefined
    const limit = ctx.query.limit
      ? parseInt(ctx.query.limit as string)
      : undefined

    const result = await LogsApi.getByContactId(
      ctx.params.contactId,
      page,
      limit
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching logs for contact'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
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

    // Log key note creation
    const keyNote = result.data
    const descriptionPreview =
      keyNote.description.length > 50
        ? keyNote.description.substring(0, 50) + '...'
        : keyNote.description

    await createLogEntry(
      ctx.state.user,
      'creation',
      'keyNote',
      keyNote.id,
      `Skapad anteckning för ${keyNote.rentalObjectCode}: "${descriptionPreview}"`
    )

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

    // Log key note update
    const keyNote = result.data
    const descriptionPreview =
      keyNote.description.length > 50
        ? keyNote.description.substring(0, 50) + '...'
        : keyNote.description

    await createLogEntry(
      ctx.state.user,
      'update',
      'keyNote',
      ctx.params.id,
      `Uppdaterat anteckning för ${keyNote.rentalObjectCode}: "${descriptionPreview}"`
    )

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
   *             $ref: '#/components/schemas/CreateReceiptRequest'
   *     responses:
   *       201:
   *         description: Key note created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Receipt'
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

    // Log receipt creation
    const receipt = result.data

    await createLogEntry(
      ctx.state.user,
      'creation',
      'receipt',
      receipt.id,
      `Skapad kvitto (${receipt.receiptType}) för nyckelutlåning`
    )

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /receipts/{id}:
   *   get:
   *     summary: Get a receipt by ID
   *     description: Retrieve a specific receipt by its ID
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The receipt ID
   *     responses:
   *       200:
   *         description: Successfully retrieved receipt
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Receipt'
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
  router.get('/receipts/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await ReceiptsApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Receipt not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching receipt')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
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
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Receipt'
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
   *   patch:
   *     summary: Update a receipt
   *     description: Update a receipt (e.g., set fileId after upload)
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the receipt to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateReceiptRequest'
   *     responses:
   *       200:
   *         description: Receipt updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Receipt'
   *       400:
   *         description: Invalid request data
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

    // Log receipt update
    const receipt = result.data

    await createLogEntry(
      ctx.state.user,
      'update',
      'receipt',
      ctx.params.id,
      `Uppdaterat ${receipt.receiptType}-kvitto`
    )

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /receipts/{id}:
   *   delete:
   *     summary: Delete a receipt
   *     description: Delete a receipt by ID (and associated file from MinIO)
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
   *       204:
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
  router.delete('/receipts/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    // Get receipt details before deleting for logging
    const receiptResult = await ReceiptsApi.get(ctx.params.id)
    let receiptType = 'UNKNOWN'

    if (receiptResult.ok) {
      const receipt = receiptResult.data
      receiptType = receipt.receiptType
    }

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

    // Log receipt deletion
    await createLogEntry(
      ctx.state.user,
      'delete',
      'receipt',
      ctx.params.id,
      `Raderat ${receiptType}-kvitto`
    )

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

  // ==================== KEY SYSTEMS SCHEMA ROUTES ====================

  /**
   * @swagger
   * /key-systems/{id}/upload-schema:
   *   post:
   *     summary: Upload PDF schema file for a key system
   *     description: Upload a PDF schema file to attach to a key system
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the key system
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
   *       400:
   *         description: Invalid file or key system not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BadRequestResponse'
   *       404:
   *         description: Key system not found
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
  router.post(
    '/key-systems/:id/upload-schema',
    upload.single('file'),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      try {
        // Check if file was provided
        if (!ctx.file || !ctx.file.buffer) {
          ctx.status = 400
          ctx.body = { reason: 'No file provided', ...metadata }
          return
        }

        // Forward the file buffer to microservice
        const result = await KeySystemsApi.uploadSchemaFile(
          ctx.params.id,
          ctx.file.buffer,
          ctx.file.originalname,
          ctx.file.mimetype
        )

        if (!result.ok) {
          if (result.err === 'not-found') {
            ctx.status = 404
            ctx.body = { reason: 'Key system not found', ...metadata }
            return
          }
          if (result.err === 'bad-request') {
            ctx.status = 400
            ctx.body = { reason: 'Invalid file or key system', ...metadata }
            return
          }

          logger.error(
            { err: result.err, metadata },
            'Error uploading schema file'
          )
          ctx.status = 500
          ctx.body = { error: 'Internal server error', ...metadata }
          return
        }

        ctx.status = 200
        ctx.body = { content: result.data, ...metadata }
      } catch (err) {
        logger.error({ err }, 'Error uploading schema file')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /key-systems/{id}/download-schema:
   *   get:
   *     summary: Get presigned download URL for key system schema PDF
   *     description: Returns a presigned URL to download the schema PDF file
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
   *         description: Download URL generated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/SchemaDownloadUrlResponse'
   *       404:
   *         description: Key system or file not found
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
  router.get('/key-systems/:id/download-schema', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeySystemsApi.getSchemaDownloadUrl(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = {
          reason: 'Key system or schema file not found',
          ...metadata,
        }
        return
      }

      logger.error(
        { err: result.err, metadata },
        'Error generating schema download URL'
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
   * /key-systems/{id}/schema:
   *   delete:
   *     summary: Delete schema file for a key system
   *     description: Deletes the schema PDF file associated with a key system
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
   *       204:
   *         description: Schema file deleted successfully
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
  router.delete('/key-systems/:id/schema', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeySystemsApi.deleteSchemaFile(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error deleting schema file')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 204
  })

  // ==================== RECEIPTS ROUTES ====================

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

      // Log file upload
      const receiptResult = await ReceiptsApi.get(ctx.params.id)
      if (receiptResult.ok) {
        const receipt = receiptResult.data

        await createLogEntry(
          ctx.state.user,
          'update',
          'receipt',
          ctx.params.id,
          `Laddade upp signerad PDF för ${receipt.receiptType}-kvitto`
        )
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
   * /receipts/{id}/upload-base64:
   *   post:
   *     summary: Upload PDF file for a receipt (base64 encoded - for Power Automate)
   *     description: Upload a PDF file as base64 encoded JSON to attach to an existing receipt
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the receipt
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - fileContent
   *             properties:
   *               fileContent:
   *                 type: string
   *                 description: Base64 encoded PDF file content
   *               fileName:
   *                 type: string
   *                 description: Optional file name (defaults to receipt-id-timestamp.pdf)
   *               metadata:
   *                 type: object
   *                 additionalProperties:
   *                   type: string
   *                 description: Optional metadata for Power Automate workflow tracking
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
   *                     source:
   *                       type: string
   *       400:
   *         description: Invalid base64 content or receipt not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BadRequestResponse'
   *       404:
   *         description: Receipt not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       413:
   *         description: File too large (max 10MB)
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
  router.post('/receipts/:id/upload-base64', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const {
        fileContent,
        fileName,
        metadata: uploadMetadata,
      } = ctx.request.body as {
        fileContent: string
        fileName?: string
        metadata?: Record<string, string>
      }

      // Validate that fileContent is provided
      if (!fileContent) {
        ctx.status = 400
        ctx.body = { reason: 'File content is required', ...metadata }
        return
      }

      // Forward the base64 content to microservice
      const result = await ReceiptsApi.uploadFileBase64(
        ctx.params.id,
        fileContent,
        fileName,
        uploadMetadata
      )

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { reason: 'Receipt not found', ...metadata }
          return
        }
        if (result.err === 'bad-request') {
          ctx.status = 400
          ctx.body = {
            reason: 'Invalid base64 content or PDF file',
            ...metadata,
          }
          return
        }

        logger.error(
          { err: result.err, metadata },
          'Error uploading base64 file'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      // Log file upload
      const receiptResult = await ReceiptsApi.get(ctx.params.id)
      if (receiptResult.ok) {
        const receipt = receiptResult.data

        await createLogEntry(
          ctx.state.user,
          'update',
          'receipt',
          ctx.params.id,
          `Laddade upp signerad PDF (base64) för ${receipt.receiptType}-kvitto`
        )
      }

      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    } catch (err) {
      logger.error({ err }, 'Error uploading base64 file')
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

  /**
   * @swagger
   * /signatures/send:
   *   post:
   *     summary: Send a document for digital signature via SimpleSign
   *     description: Send a PDF document to SimpleSign for digital signature
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - resourceType
   *               - resourceId
   *               - recipientEmail
   *               - pdfBase64
   *             properties:
   *               resourceType:
   *                 type: string
   *                 enum: [receipt]
   *               resourceId:
   *                 type: string
   *                 format: uuid
   *               recipientEmail:
   *                 type: string
   *                 format: email
   *               recipientName:
   *                 type: string
   *               pdfBase64:
   *                 type: string
   *     responses:
   *       201:
   *         description: Signature request sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Signature'
   *       400:
   *         description: Invalid request data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Resource not found
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
  router.post('/signatures/send', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await SignaturesApi.send(payload)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { error: 'Resource not found', ...metadata }
        return
      }

      logger.error(
        { err: result.err, metadata },
        'Error sending signature request'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    // Log signature send
    const signature = result.data

    await createLogEntry(
      ctx.state.user,
      'creation',
      'signature',
      signature.id,
      `Skickad signaturförfrågan till ${signature.recipientEmail}`
    )

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /signatures/{id}:
   *   get:
   *     summary: Get a signature by ID
   *     description: Retrieve a specific signature by its ID
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
   *         description: Signature details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Signature'
   *       404:
   *         description: Signature not found
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
  router.get('/signatures/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await SignaturesApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Signature not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching signature')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /signatures/resource/{resourceType}/{resourceId}:
   *   get:
   *     summary: Get all signatures for a resource
   *     description: Retrieve all signatures associated with a specific resource
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: resourceType
   *         required: true
   *         schema:
   *           type: string
   *           enum: [receipt]
   *       - in: path
   *         name: resourceId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: List of signatures
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Signature'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/signatures/resource/:resourceType/:resourceId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { resourceType, resourceId } = ctx.params

    const result = await SignaturesApi.getByResource(resourceType, resourceId)

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching signatures')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /webhooks/simplesign:
   *   post:
   *     summary: Webhook endpoint for SimpleSign status updates
   *     description: Receives webhook notifications from SimpleSign when document status changes (e.g., signed, declined)
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/SimpleSignWebhookPayload'
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       404:
   *         description: Signature not found
   *       500:
   *         description: Internal server error
   */
  router.post('/webhooks/simplesign', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    // Forward webhook to keys service (it handles all the logic)
    // This is just a proxy endpoint
    try {
      const webhookPayload = ctx.request.body

      logger.info(
        { documentId: webhookPayload.id, status: webhookPayload.status },
        'SimpleSign webhook received in core, forwarding to keys service'
      )

      // The keys service has the actual webhook handler
      // We just acknowledge receipt here
      ctx.status = 200
      ctx.body = { message: 'Webhook received', ...metadata }
    } catch (err: any) {
      logger.error(err, 'Error processing SimpleSign webhook')
      ctx.status = 500
      ctx.body = {
        error: 'Internal server error',
        reason: err.message,
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /key-events:
   *   get:
   *     summary: Get all key events
   *     description: Returns all key events ordered by creation date.
   *     tags: [Keys Service]
   *     responses:
   *       200:
   *         description: List of key events.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyEvent'
   *       500:
   *         description: An error occurred while fetching key events.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/key-events', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyEventsApi.list()

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching key events')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-events/by-key/{keyId}:
   *   get:
   *     summary: Get all key events for a specific key
   *     description: Returns all key events associated with a specific key ID. Optionally limit results to get only the latest event(s).
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: keyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The key ID to filter events by.
   *       - in: query
   *         name: limit
   *         required: false
   *         schema:
   *           type: integer
   *         description: Optional limit on number of results (e.g., 1 for latest event only).
   *     responses:
   *       200:
   *         description: List of key events for the key.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/KeyEvent'
   *       500:
   *         description: An error occurred while fetching key events.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/key-events/by-key/:keyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const limit = ctx.query.limit
      ? parseInt(ctx.query.limit as string)
      : undefined

    const result = await KeyEventsApi.getByKey(ctx.params.keyId, limit)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching key events by key'
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
   * /key-events/{id}:
   *   get:
   *     summary: Get key event by ID
   *     description: Fetch a specific key event by its ID.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key event to retrieve.
   *     responses:
   *       200:
   *         description: A key event object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyEvent'
   *       404:
   *         description: Key event not found.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       500:
   *         description: An error occurred while fetching the key event.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/key-events/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyEventsApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key event not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching key event')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-events:
   *   post:
   *     summary: Create a key event
   *     description: Create a new key event record. Will fail with 409 if any of the keys have an incomplete event (status not COMPLETED).
   *     tags: [Keys Service]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateKeyEventRequest'
   *     responses:
   *       201:
   *         description: Key event created successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyEvent'
   *       400:
   *         description: Invalid request body.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: Conflict - one or more keys have incomplete events.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                 conflictingKeys:
   *                   type: array
   *                   items:
   *                     type: string
   *       500:
   *         description: An error occurred while creating the key event.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post('/key-events', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyEventsApi.create(ctx.request.body)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request body', ...metadata }
        return
      }

      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = {
          reason: 'One or more keys have incomplete events',
          ...metadata,
        }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key event')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    // Log key event creation
    const keyEvent = result.data
    let keyCount = 0

    if (keyEvent.keys) {
      try {
        const keyIds = JSON.parse(keyEvent.keys)
        keyCount = keyIds.length
      } catch {
        // Ignore parse errors
      }
    }

    const eventTypeLabel =
      keyEvent.type === 'FLEX'
        ? 'Flex'
        : keyEvent.type === 'ORDER'
          ? 'Extranyckel'
          : 'Bortappad'
    const description = `Skapad ${eventTypeLabel}-händelse för ${keyCount} ${keyCount === 1 ? 'nyckel' : 'nycklar'}, status: ${keyEvent.status}`

    await createLogEntry(
      ctx.state.user,
      'creation',
      'keyEvent',
      keyEvent.id,
      description
    )

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-events/{id}:
   *   patch:
   *     summary: Update a key event
   *     description: Update an existing key event.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The unique ID of the key event to update.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateKeyEventRequest'
   *     responses:
   *       200:
   *         description: Key event updated successfully.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyEvent'
   *       404:
   *         description: Key event not found.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotFoundResponse'
   *       400:
   *         description: Invalid request body.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: An error occurred while updating the key event.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.patch('/key-events/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyEventsApi.update(ctx.params.id, ctx.request.body)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key event not found', ...metadata }
        return
      }

      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request body', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key event')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    // Log key event update
    const keyEvent = result.data
    let keyCount = 0

    if (keyEvent.keys) {
      try {
        const keyIds = JSON.parse(keyEvent.keys)
        keyCount = keyIds.length
      } catch {
        // Ignore parse errors
      }
    }

    const eventTypeLabel =
      keyEvent.type === 'FLEX'
        ? 'Flex'
        : keyEvent.type === 'ORDER'
          ? 'Extranyckel'
          : 'Bortappad'
    const statusLabel =
      keyEvent.status === 'ORDERED'
        ? 'Beställd'
        : keyEvent.status === 'RECEIVED'
          ? 'Inkommen'
          : 'Klar'
    const description = `Uppdaterat ${eventTypeLabel}-händelse (status: ${statusLabel}) för ${keyCount} ${keyCount === 1 ? 'nyckel' : 'nycklar'}`

    await createLogEntry(
      ctx.state.user,
      'update',
      'keyEvent',
      ctx.params.id,
      description
    )

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-bundles:
   *   get:
   *     summary: List all key bundles
   *     description: Fetches a list of all key bundles ordered by name.
   *     tags: [Keys Service]
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
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-bundles', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyBundlesApi.list()

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching key bundles')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-bundles/search:
   *   get:
   *     summary: Search key bundles
   *     description: Search key bundles with flexible filtering.
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
   *         description: Comma-separated list of fields for OR search.
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-bundles/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    const result = await KeyBundlesApi.search(ctx.query)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { reason: 'Invalid search parameters', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error searching key bundles')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-bundles/by-key/{keyId}:
   *   get:
   *     summary: Get all bundles containing a specific key
   *     description: Returns all bundle records containing the specified key ID
   *     tags: [Keys Service]
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-bundles/by-key/:keyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyBundlesApi.getByKey(ctx.params.keyId)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching key bundles by key'
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
   * /key-bundles/{id}:
   *   get:
   *     summary: Get key bundle by ID
   *     description: Fetch a specific key bundle by its ID.
   *     tags: [Keys Service]
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-bundles/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyBundlesApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key bundle not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching key bundle')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-bundles:
   *   post:
   *     summary: Create a new key bundle
   *     description: Create a new key bundle record.
   *     tags: [Keys Service]
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
   *     security:
   *       - bearerAuth: []
   */
  router.post('/key-bundles', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyBundlesApi.create(ctx.request.body)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request body', ...metadata }
        return
      }

      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = { error: 'Conflict creating key bundle', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key bundle')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(
      ctx.state.user,
      'creation',
      'keyBundle',
      result.data.id
    )

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-bundles/{id}:
   *   patch:
   *     summary: Update a key bundle
   *     description: Partially update an existing key bundle.
   *     tags: [Keys Service]
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
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/key-bundles/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyBundlesApi.update(ctx.params.id, ctx.request.body)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key bundle not found', ...metadata }
        return
      }

      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request body', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key bundle')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx.state.user, 'update', 'keyBundle', ctx.params.id)

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-bundles/{id}:
   *   delete:
   *     summary: Delete a key bundle
   *     description: Delete a key bundle by ID.
   *     tags: [Keys Service]
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
   *       404:
   *         description: Key bundle not found.
   *       500:
   *         description: An error occurred while deleting the key bundle.
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/key-bundles/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyBundlesApi.remove(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key bundle not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error deleting key bundle')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(ctx.state.user, 'delete', 'keyBundle', ctx.params.id)

    ctx.status = 204
  })

  /**
   * @swagger
   * /key-bundles/{id}/keys-with-loan-status:
   *   get:
   *     summary: Get keys in bundle with maintenance loan status
   *     description: Fetches all keys in a key bundle along with their active maintenance loan information
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The key bundle ID
   *     responses:
   *       200:
   *         description: Bundle information and keys with loan status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/KeyBundleWithLoanStatusResponse'
   *       404:
   *         description: Key bundle not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-bundles/:id/keys-with-loan-status', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyBundlesApi.getWithLoanStatus(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key bundle not found', ...metadata }
        return
      }

      logger.error(
        { err: result.err, metadata },
        'Error fetching key bundle with loan status'
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
   * /key-loan-maintenance-keys:
   *   get:
   *     summary: List all maintenance key loans
   *     description: Fetches a list of all maintenance key loans.
   *     tags: [Keys Service]
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
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-loan-maintenance-keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoanMaintenanceKeysApi.list()

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching maintenance key loans'
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
   * /key-loan-maintenance-keys/search:
   *   get:
   *     summary: Search maintenance key loans
   *     description: Search maintenance key loans with flexible filtering.
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
   *         description: Comma-separated list of fields for OR search.
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-loan-maintenance-keys/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['q', 'fields'])

    const result = await KeyLoanMaintenanceKeysApi.search(ctx.query)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { reason: 'Invalid search parameters', ...metadata }
        return
      }

      logger.error(
        { err: result.err, metadata },
        'Error searching maintenance key loans'
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
   * /key-loan-maintenance-keys/by-key/{keyId}:
   *   get:
   *     summary: Get all maintenance key loans for a specific key
   *     description: Returns all maintenance key loan records for the specified key ID
   *     tags: [Keys Service]
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-loan-maintenance-keys/by-key/:keyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoanMaintenanceKeysApi.getByKey(ctx.params.keyId)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching maintenance key loans by key'
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
   * /key-loan-maintenance-keys/by-company/{company}:
   *   get:
   *     summary: Get all maintenance key loans for a specific company
   *     description: Returns all maintenance key loan records for the specified company
   *     tags: [Keys Service]
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-loan-maintenance-keys/by-company/:company', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoanMaintenanceKeysApi.getByCompany(
      ctx.params.company
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching maintenance key loans by company'
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
   * /key-loan-maintenance-keys/by-company/{company}/with-keys:
   *   get:
   *     summary: Get maintenance key loans for a company with full key details
   *     description: |
   *       Returns all maintenance key loan records for the specified company with joined key data.
   *       Supports filtering by returned status via query parameter.
   *     tags: [Keys Service]
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
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '/key-loan-maintenance-keys/by-company/:company/with-keys',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx, ['returned'])

      const returnedParam = ctx.query.returned
      let returned: boolean | undefined = undefined
      if (returnedParam === 'true') {
        returned = true
      } else if (returnedParam === 'false') {
        returned = false
      }

      const result = await KeyLoanMaintenanceKeysApi.getByCompanyWithKeys(
        ctx.params.company,
        returned
      )

      if (!result.ok) {
        logger.error(
          { err: result.err, metadata },
          'Error fetching maintenance key loans with keys by company'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    }
  )

  /**
   * @swagger
   * /key-loan-maintenance-keys/{id}:
   *   get:
   *     summary: Get maintenance key loan by ID
   *     description: Fetch a specific maintenance key loan by its ID.
   *     tags: [Keys Service]
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-loan-maintenance-keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoanMaintenanceKeysApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Maintenance key loan not found', ...metadata }
        return
      }

      logger.error(
        { err: result.err, metadata },
        'Error fetching maintenance key loan'
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
   * /key-loan-maintenance-keys:
   *   post:
   *     summary: Create a new maintenance key loan
   *     description: Create a new maintenance key loan record.
   *     tags: [Keys Service]
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
   *     security:
   *       - bearerAuth: []
   */
  router.post('/key-loan-maintenance-keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoanMaintenanceKeysApi.create(ctx.request.body)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request body', ...metadata }
        return
      }

      if (result.err === 'conflict') {
        ctx.status = 409
        ctx.body = {
          error: 'Conflict creating maintenance key loan',
          ...metadata,
        }
        return
      }

      logger.error(
        { err: result.err, metadata },
        'Error creating maintenance key loan'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(
      ctx.state.user,
      'creation',
      'keyLoanMaintenanceKeys',
      result.data.id
    )

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-loan-maintenance-keys/{id}:
   *   patch:
   *     summary: Update a maintenance key loan
   *     description: Partially update an existing maintenance key loan.
   *     tags: [Keys Service]
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
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/key-loan-maintenance-keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoanMaintenanceKeysApi.update(
      ctx.params.id,
      ctx.request.body
    )

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Maintenance key loan not found', ...metadata }
        return
      }

      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request body', ...metadata }
        return
      }

      logger.error(
        { err: result.err, metadata },
        'Error updating maintenance key loan'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(
      ctx.state.user,
      'update',
      'keyLoanMaintenanceKeys',
      ctx.params.id
    )

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /key-loan-maintenance-keys/{id}:
   *   delete:
   *     summary: Delete a maintenance key loan
   *     description: Delete a maintenance key loan by ID.
   *     tags: [Keys Service]
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
   *       404:
   *         description: Maintenance key loan not found.
   *       500:
   *         description: An error occurred while deleting the maintenance key loan.
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/key-loan-maintenance-keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoanMaintenanceKeysApi.remove(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Maintenance key loan not found', ...metadata }
        return
      }

      logger.error(
        { err: result.err, metadata },
        'Error deleting maintenance key loan'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    await createLogEntry(
      ctx.state.user,
      'delete',
      'keyLoanMaintenanceKeys',
      ctx.params.id
    )

    ctx.status = 204
  })
}
