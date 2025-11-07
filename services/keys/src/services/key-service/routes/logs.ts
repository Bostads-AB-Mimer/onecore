import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { paginate } from '../../../utils/pagination'
import { buildSearchQuery } from '../../../utils/search-builder'
import * as logsAdapter from '../adapters/logs-adapter'

const { LogSchema, CreateLogRequestSchema, createPaginatedResponseSchema } =
  keys.v1
type CreateLogRequest = keys.v1.CreateLogRequest
type Log = keys.v1.Log

/**
 * @swagger
 * tags:
 *   - name: Logs
 *     description: Read-only audit logs
 * components:
 *   schemas:
 *     CreateLogRequest:
 *       $ref: '#/components/schemas/CreateLogRequest'
 *     Log:
 *       $ref: '#/components/schemas/Log'
 *     PaginatedLogsResponse:
 *       $ref: '#/components/schemas/PaginatedLogsResponse'
 */
export const routes = (router: KoaRouter) => {
  // Register schemas from @onecore/types
  registerSchema('CreateLogRequest', CreateLogRequestSchema)
  registerSchema('Log', LogSchema)
  registerSchema(
    'PaginatedLogsResponse',
    createPaginatedResponseSchema(LogSchema)
  )
  /**
   * @swagger
   * /logs:
   *   get:
   *     summary: List logs with pagination
   *     description: Returns paginated logs (most recent per objectId) ordered by eventTime (desc).
   *     tags: [Logs]
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
   *         description: A paginated list of logs
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
   */
  router.get('/logs', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const query = logsAdapter.getAllLogsWithKeyEventsQuery(db)
      const paginatedResult = await paginate(query, ctx)

      // Enrich logs with Swedish labels
      const enrichedContent = paginatedResult.content.map(
        logsAdapter.enrichLogWithLabels
      )

      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult, content: enrichedContent }
    } catch (err) {
      logger.error(err, 'Error listing logs')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
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
   *     tags: [Logs]
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
   *         description: Comma-separated list of fields for OR search. Defaults to objectId and userName.
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
   *       500:
   *         description: Internal server error
   */
  router.get('/logs/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'q',
      'fields',
      'page',
      'limit',
    ])

    try {
      const baseQuery = logsAdapter.getLogsSearchQuery(db)
      const searchResult = buildSearchQuery(baseQuery, ctx, {
        defaultSearchFields: ['objectId', 'userName'],
      })

      if (!searchResult.hasSearchParams) {
        ctx.status = 400
        ctx.body = {
          reason: searchResult.error,
          ...metadata,
        }
        return
      }

      const paginatedResult = await paginate(baseQuery, ctx)

      // Enrich logs with Swedish labels
      const enrichedContent = paginatedResult.content.map(
        logsAdapter.enrichLogWithLabels
      )

      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult, content: enrichedContent }
    } catch (err) {
      logger.error(err, 'Error searching logs')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /logs/object/{objectId}:
   *   get:
   *     summary: Get all logs for a specific objectId
   *     description: Returns all log entries for a given objectId, ordered by most recent first
   *     tags: [Logs]
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
   */
  router.get('/logs/object/:objectId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await logsAdapter.getLogsByObjectId(ctx.params.objectId, db)

      // Enrich logs with Swedish labels
      const enrichedRows = rows.map(logsAdapter.enrichLogWithLabels)

      ctx.status = 200
      ctx.body = { content: enrichedRows satisfies Log[], ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching logs for objectId')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /logs:
   *   post:
   *     summary: Create a log
   *     tags: [Logs]
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
   */
  router.post(
    '/logs',
    parseRequestBody(CreateLogRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: CreateLogRequest = ctx.request.body

        // If description is provided, use it directly
        let finalDescription = payload.description

        // Auto-generate description if requested and entity data is provided
        if (ctx.request.body.autoGenerateDescription && ctx.request.body.entityData) {
          const { objectType, entityData, action } = ctx.request.body

          try {
            switch (objectType) {
              case 'key':
                finalDescription = await logsAdapter.buildKeyDescription(
                  entityData,
                  action || 'Skapad',
                  db
                )
                break
              case 'keySystem':
                finalDescription = logsAdapter.buildKeySystemDescription(
                  entityData,
                  action || 'Skapad'
                )
                break
              case 'receipt':
                finalDescription = await logsAdapter.buildReceiptDescription(
                  entityData,
                  action || 'Skapad',
                  db
                )
                break
              case 'signature':
                finalDescription = logsAdapter.buildSignatureDescription(
                  entityData,
                  action || 'Skapad'
                )
                break
              case 'keyBundle':
                finalDescription = await logsAdapter.buildKeyBundleDescription(
                  entityData,
                  action || 'Skapad',
                  db
                )
                break
              case 'keyLoan':
                finalDescription = await logsAdapter.buildKeyLoanDescription(
                  entityData,
                  action || 'Skapad',
                  db
                )
                break
              case 'keyNote':
                finalDescription = logsAdapter.buildKeyNoteDescription(
                  entityData,
                  action || 'Skapad'
                )
                break
              default:
                // Use provided description or fallback
                finalDescription = payload.description
            }
          } catch (error) {
            logger.warn(
              { error, objectType, action },
              'Failed to auto-generate log description'
            )
            // Fallback to provided description
            finalDescription = payload.description
          }
        }

        // Extract only database fields (exclude auto-generation helper fields)
        const {
          action: _action,
          autoGenerateDescription: _autoGenerateDescription,
          entityData: _entityData,
          ...dbPayload
        } = payload
        const row = await logsAdapter.createLog(
          {
            ...dbPayload,
            description: finalDescription,
          },
          db
        )

        // Enrich log with Swedish labels
        const enrichedRow = logsAdapter.enrichLogWithLabels(row)

        ctx.status = 201
        ctx.body = { content: enrichedRow satisfies Log, ...metadata }
      } catch (err) {
        logger.error(err, 'Error creating log')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /logs/rental-object/{rentalObjectCode}:
   *   get:
   *     summary: Get all logs for a specific rental object
   *     description: |
   *       Returns all log entries for a given rental object code by JOINing across multiple tables.
   *
   *       Included objectTypes: keys, keyLoans, receipts, keyEvents, keyNotes, keyBundles, signatures
   *
   *       Excluded: keySystem logs (infrastructure-level, not property-specific)
   *
   *       Note: Uses current state via JOINs - if a key moved between properties, historical logs reflect current property assignment
   *
   *       Results ordered by most recent first
   *     tags: [Logs]
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
   */
  router.get('/logs/rental-object/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const query = logsAdapter.getLogsByRentalObjectCodeQuery(
        ctx.params.rentalObjectCode,
        db
      )
      const paginatedResult = await paginate(query, ctx)

      // Enrich logs with Swedish labels
      const enrichedContent = paginatedResult.content.map(
        logsAdapter.enrichLogWithLabels
      )

      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult, content: enrichedContent }
    } catch (err) {
      logger.error(err, 'Error fetching logs for rental object')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
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
   *       Excluded: keyEvents, keyBundles, keyNotes, keySystem (no contact relationship)
   *
   *       Note: Matches both contact and contact2 fields (co-tenants supported)
   *
   *       Results ordered by most recent first
   *     tags: [Logs]
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
   */
  router.get('/logs/contact/:contactId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const query = logsAdapter.getLogsByContactIdQuery(
        ctx.params.contactId,
        db
      )
      const paginatedResult = await paginate(query, ctx)

      // Enrich logs with Swedish labels
      const enrichedContent = paginatedResult.content.map(
        logsAdapter.enrichLogWithLabels
      )

      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult, content: enrichedContent }
    } catch (err) {
      logger.error(err, 'Error fetching logs for contact')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /logs/users:
   *   get:
   *     summary: Get list of unique users who have created logs
   *     description: Returns a sorted list of distinct usernames from the logs table for populating filter dropdowns
   *     tags: [Logs]
   *     responses:
   *       200:
   *         description: List of unique usernames
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: string
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/logs/users', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const users = await logsAdapter.getUniqueUsers(db)

      ctx.status = 200
      ctx.body = { content: users, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching unique users')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /logs/metadata:
   *   get:
   *     summary: Get metadata for logs (translations, allowed values)
   *     description: Returns Swedish translations and allowed values for eventTypes, objectTypes, and other enums used in logging
   *     tags: [Logs]
   *     responses:
   *       200:
   *         description: Log metadata with translations
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     eventTypes:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           value:
   *                             type: string
   *                           label:
   *                             type: string
   *                     objectTypes:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           value:
   *                             type: string
   *                           label:
   *                             type: string
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/logs/metadata', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const logMetadata = {
        eventTypes: [
          { value: 'creation', label: 'Skapad' },
          { value: 'update', label: 'Uppdaterad' },
          { value: 'delete', label: 'Raderad' },
        ],
        objectTypes: [
          { value: 'key', label: 'Nyckel' },
          { value: 'keySystem', label: 'Nyckelsystem' },
          { value: 'keyLoan', label: 'Nyckellån' },
          { value: 'keyBundle', label: 'Nyckelknippe' },
          { value: 'receipt', label: 'Kvitto' },
          { value: 'keyEvent', label: 'Nyckelhändelse' },
          { value: 'signature', label: 'Signatur' },
          { value: 'keyNote', label: 'Nyckelanteckning' },
        ],
      }

      ctx.status = 200
      ctx.body = { content: logMetadata, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching log metadata')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /logs/{id}:
   *   get:
   *     summary: Get log by ID
   *     tags: [Logs]
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
   */
  router.get('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row = await logsAdapter.getLogById(ctx.params.id, db)
      if (!row) {
        ctx.status = 404
        ctx.body = { reason: 'Log not found', ...metadata }
        return
      }

      // Enrich log with Swedish labels
      const enrichedRow = logsAdapter.enrichLogWithLabels(row)

      ctx.status = 200
      ctx.body = { content: enrichedRow satisfies Log, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
