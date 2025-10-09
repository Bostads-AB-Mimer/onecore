import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { keys } from '@onecore/types'
import { db } from '../adapters/db'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { paginate } from '../../../utils/pagination'

const TABLE = 'logs'

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
      const subquery = db(TABLE)
        .select('*')
        .select(
          db.raw(
            'ROW_NUMBER() OVER (PARTITION BY objectId ORDER BY eventTime DESC) as rn'
          )
        )

      const query = db
        .from(subquery.as('ranked_logs'))
        .select('*')
        .where('rn', 1)
        .whereNotNull('objectId')
        .orderBy('eventTime', 'desc')

      const paginatedResult = await paginate(query, ctx)

      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult }
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
      let subquery = db(TABLE)
        .select('*')
        .select(
          db.raw(
            'ROW_NUMBER() OVER (PARTITION BY objectId ORDER BY eventTime DESC) as rn'
          )
        )

      // Handle OR search
      if (typeof ctx.query.q === 'string' && ctx.query.q.trim().length >= 3) {
        const searchTerm = ctx.query.q.trim()
        let fieldsToSearch: string[] = []

        if (typeof ctx.query.fields === 'string') {
          fieldsToSearch = ctx.query.fields.split(',').map((f) => f.trim())
        } else {
          fieldsToSearch = ['resourceId']
        }

        subquery = subquery.where((builder) => {
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
      const reservedParams = ['q', 'fields', 'page', 'limit']
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
            subquery = subquery.where(field, operator, compareValue)
          } else {
            subquery = subquery.where(field, 'like', `%${trimmedValue}%`)
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

      // Wrap query and filter for rn = 1 (most recent per objectId)
      const query = db
        .from(subquery.as('ranked_logs'))
        .select('*')
        .where('rn', 1)
        .whereNotNull('objectId')
        .orderBy('eventTime', 'desc')

      const paginatedResult = await paginate(query, ctx)

      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult }
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
      const rows = await db(TABLE)
        .where({ objectId: ctx.params.objectId })
        .orderBy('eventTime', 'desc')

      ctx.status = 200
      ctx.body = { content: rows satisfies Log[], ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching logs for objectId')
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
      const row = await db(TABLE).where({ id: ctx.params.id }).first()
      if (!row) {
        ctx.status = 404
        ctx.body = { reason: 'Log not found', ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { content: row satisfies Log, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching log')
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

        const [row] = await db(TABLE).insert(payload).returning('*')
        ctx.status = 201
        ctx.body = { content: row satisfies Log, ...metadata }
      } catch (err) {
        logger.error(err, 'Error creating log')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )
}
