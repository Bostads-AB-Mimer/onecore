import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { KeyLoansApi } from '../../adapters/keys-adapter'
import { getUserName, createLogEntry } from './helpers'

export const routes = (router: KoaRouter) => {
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
   *       - **Advanced filters**: Search by key name/object code, filter by key count, null checks
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
    const metadata = generateRouteMetadata(ctx, [
      'q',
      'fields',
      'keyNameOrObjectCode',
      'minKeys',
      'maxKeys',
      'hasPickedUp',
      'hasReturned',
    ])

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
    ctx.body = { ...metadata, ...result.data }
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
   * /key-loans/by-card/{cardId}:
   *   get:
   *     summary: Get all loans for a specific card
   *     description: Returns all loan records for the specified card ID, ordered by creation date DESC
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: cardId
   *         required: true
   *         schema:
   *           type: string
   *         description: The card ID to fetch loans for
   *     responses:
   *       200:
   *         description: Array of loans for this card
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
   *         $ref: '#/components/responses/InternalServerError'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/key-loans/by-card/:cardId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyLoansApi.getByCard(ctx.params.cardId)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching loans by card ID'
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
   *       - in: query
   *         name: returned
   *         schema:
   *           type: boolean
   *         description: |
   *           Filter by return status:
   *           - true: Only returned loans (returnedAt IS NOT NULL)
   *           - false: Only active loans (returnedAt IS NULL)
   *           - omitted: All loans (no filter)
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
      'returned',
    ])

    const contact = ctx.query.contact as string | undefined
    const contact2 = ctx.query.contact2 as string | undefined
    const includeReceipts = ctx.query.includeReceipts === 'true'
    const returnedParam = ctx.query.returned

    let returned: boolean | undefined = undefined
    if (returnedParam === 'true') {
      returned = true
    } else if (returnedParam === 'false') {
      returned = false
    }

    const result = await KeyLoansApi.getByRentalObject(
      ctx.params.rentalObjectCode,
      contact,
      contact2,
      includeReceipts,
      returned
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
   * /key-loans/by-contact/{contact}/with-keys:
   *   get:
   *     summary: Get key loans by contact with keys
   *     description: Returns all key loans for a specific contact with full key details, optionally filtered by loan type and return status
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: contact
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact identifier to search for
   *       - in: query
   *         name: loanType
   *         required: false
   *         schema:
   *           type: string
   *           enum: [TENANT, MAINTENANCE]
   *         description: Filter by loan type (TENANT or MAINTENANCE)
   *       - in: query
   *         name: returned
   *         required: false
   *         schema:
   *           type: boolean
   *         description: Filter by return status (true = returned, false = not returned)
   *     responses:
   *       200:
   *         description: Array of key loans with full key details
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
  router.get('/key-loans/by-contact/:contact/with-keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['loanType', 'returned'])

    const loanTypeParam = ctx.query.loanType as string | undefined
    const returnedParam = ctx.query.returned

    let loanType: 'TENANT' | 'MAINTENANCE' | undefined = undefined
    if (loanTypeParam === 'TENANT' || loanTypeParam === 'MAINTENANCE') {
      loanType = loanTypeParam
    }

    let returned: boolean | undefined = undefined
    if (returnedParam === 'true') {
      returned = true
    } else if (returnedParam === 'false') {
      returned = false
    }

    const result = await KeyLoansApi.getByContactWithKeys(
      ctx.params.contact,
      loanType,
      returned
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching key loans with keys by contact'
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
   * /key-loans/by-bundle/{bundleId}/with-keys:
   *   get:
   *     summary: Get key loans by bundle with keys
   *     description: Returns all key loans for a specific bundle with full key details, optionally filtered by loan type and return status
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: bundleId
   *         required: true
   *         schema:
   *           type: string
   *         description: The bundle ID to search for
   *       - in: query
   *         name: loanType
   *         required: false
   *         schema:
   *           type: string
   *           enum: [TENANT, MAINTENANCE]
   *         description: Filter by loan type (TENANT or MAINTENANCE)
   *       - in: query
   *         name: returned
   *         required: false
   *         schema:
   *           type: boolean
   *         description: Filter by return status (true = returned, false = not returned)
   *     responses:
   *       200:
   *         description: Array of key loans with full key details
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
  router.get('/key-loans/by-bundle/:bundleId/with-keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['loanType', 'returned'])

    const loanTypeParam = ctx.query.loanType as string | undefined
    const returnedParam = ctx.query.returned

    let loanType: 'TENANT' | 'MAINTENANCE' | undefined = undefined
    if (loanTypeParam === 'TENANT' || loanTypeParam === 'MAINTENANCE') {
      loanType = loanTypeParam
    }

    let returned: boolean | undefined = undefined
    if (returnedParam === 'true') {
      returned = true
    } else if (returnedParam === 'false') {
      returned = false
    }

    const result = await KeyLoansApi.getByBundleWithKeys(
      ctx.params.bundleId,
      loanType,
      returned
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching key loans with keys by bundle'
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
   *     description: |
   *       Fetch a specific key loan by its ID.
   *       Use includeKeySystem=true to get keys with their keySystem data attached.
   *       Use includeCards=true to get cards from DAX attached (auto-implies key fetching).
   *       Use includeLoans=true to get loan history attached to each key.
   *       Use includeEvents=true to get event history attached to each key.
   *     tags: [Keys Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The unique ID of the key loan to retrieve.
   *       - in: query
   *         name: includeKeySystem
   *         required: false
   *         schema:
   *           type: boolean
   *         description: When true, includes keysArray with keySystem data attached to each key.
   *       - in: query
   *         name: includeCards
   *         required: false
   *         schema:
   *           type: boolean
   *         description: When true, includes keyCardsArray with card data from DAX. Auto-implies key fetching.
   *       - in: query
   *         name: includeLoans
   *         required: false
   *         schema:
   *           type: boolean
   *         description: When true, includes loan history attached to each key in keysArray.
   *       - in: query
   *         name: includeEvents
   *         required: false
   *         schema:
   *           type: boolean
   *         description: When true, includes event history attached to each key in keysArray.
   *     responses:
   *       200:
   *         description: A key loan object. Returns KeyLoanWithDetails if includeKeySystem or includeCards is true.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   oneOf:
   *                     - $ref: '#/components/schemas/KeyLoan'
   *                     - $ref: '#/components/schemas/KeyLoanWithDetails'
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
    const metadata = generateRouteMetadata(ctx, [
      'includeKeySystem',
      'includeCards',
      'includeLoans',
      'includeEvents',
    ])
    const includeKeySystem = ctx.query.includeKeySystem === 'true'
    const includeCards = ctx.query.includeCards === 'true'
    const includeLoans = ctx.query.includeLoans === 'true'
    const includeEvents = ctx.query.includeEvents === 'true'

    const result = await KeyLoansApi.get(ctx.params.id, {
      includeKeySystem,
      includeCards,
      includeLoans,
      includeEvents,
    })

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

    const enrichedPayload = {
      ...payload,
      createdBy: getUserName(ctx) || null,
    }

    const result = await KeyLoansApi.create(enrichedPayload)

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

    await createLogEntry(ctx, {
      eventType: 'creation',
      objectType: 'keyLoan',
      objectId: result.data.id,
      autoGenerateDescription: true,
      entityData: result.data,
      action: 'Skapad',
    })

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
  router.put('/key-loans/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const enrichedPayload = {
      ...payload,
      updatedBy: getUserName(ctx) || null,
    }

    const result = await KeyLoansApi.update(ctx.params.id, enrichedPayload)

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

    await createLogEntry(ctx, {
      eventType: 'update',
      objectType: 'keyLoan',
      objectId: result.data.id,
      autoGenerateDescription: true,
      entityData: result.data,
      action: 'Uppdaterad',
    })

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

    await createLogEntry(ctx, {
      eventType: 'delete',
      objectType: 'keyLoan',
      objectId: ctx.params.id,
      autoGenerateDescription: true,
      entityData: getResult.data,
      action: 'Raderad',
    })

    ctx.status = 200
    ctx.body = { ...metadata }
  })
}
