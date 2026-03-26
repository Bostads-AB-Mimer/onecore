# Service Layer Patterns

## IMPORTANT: Schema location

Zod schemas go in `libs/types/src/{service}/schema.ts` — NOT in the service's local `schemas.ts`. This is a shared types package imported via `@onecore/types` by both the service and core layers. If you define schemas locally, they'll be duplicated and will fail PR review.

Also: POST/PUT/PATCH route handlers MUST use `parseRequestBody(Schema)` middleware, not inline `safeParse()`. Read `services/keys/src/middlewares/parse-request-body.ts` to see the implementation.

## Reference files to read before generating

Before generating service-layer code, read these files from the codebase to confirm current patterns:

- `services/keys/src/services/key-service/routes/keys.ts` — route pattern with Swagger JSDoc
- `services/keys/src/services/key-service/adapters/keys-adapter.ts` — Knex adapter pattern
- `services/keys/src/middlewares/parse-request-body.ts` — parseRequestBody middleware
- `services/keys/src/utils/openapi.ts` — registerSchema utility
- `services/keys/src/utils/pagination.ts` — paginate utility
- `libs/types/src/keys/schema.ts` — Zod schema patterns
- `libs/types/src/keys/types.ts` — inferred TypeScript types
- `services/keys/src/services/key-service/tests/routes/keys.test.ts` — route test pattern

For Prisma-based services, also read:
- `services/property/src/adapters/property-adapter.ts` — Prisma adapter pattern

## File structure

For resource `{resource}` in service `{service}`:

```
services/{service}/src/
├── services/{service}-service/
│   ├── index.ts                    # Mount new routes here
│   ├── routes/
│   │   └── {resource}s.ts          # NEW: route handlers
│   ├── adapters/
│   │   ├── db.ts                   # Existing Knex/Prisma instance
│   │   └── {resource}s-adapter.ts  # NEW: database adapter
│   └── tests/
│       ├── routes/
│       │   └── {resource}s.test.ts # NEW: route tests
│       ├── adapters/
│       │   └── {resource}s-adapter.test.ts # NEW: adapter tests
│       └── factories/
│           └── index.ts            # Add factory for new resource
libs/types/src/{service}/
├── schema.ts                       # ADD schemas for new resource
├── types.ts                        # ADD inferred types
└── index.ts                        # EXPORT new schemas/types
```

## Route pattern

```typescript
import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { {service} } from '@onecore/types'
import { db } from '../adapters/db'
import * as {resource}sAdapter from '../adapters/{resource}s-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { registerSchema } from '../../../utils/openapi'
import { paginate } from '../../../utils/pagination'

const {
  {Resource}Schema,
  Create{Resource}RequestSchema,
  Update{Resource}RequestSchema,
} = {service}

type {Resource} = {service}.{Resource}
type Create{Resource}Request = {service}.Create{Resource}Request
type Update{Resource}Request = {service}.Update{Resource}Request

/**
 * @swagger
 * tags:
 *   - name: {Resource}s
 *     description: CRUD operations for {resource}s
 */
export const routes = (router: KoaRouter) => {
  registerSchema('{Resource}', {Resource}Schema)
  registerSchema('Create{Resource}Request', Create{Resource}RequestSchema)
  registerSchema('Update{Resource}Request', Update{Resource}RequestSchema)

  /**
   * @swagger
   * /{resource}s:
   *   get:
   *     summary: List {resource}s with pagination
   *     tags: [{Resource}s]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 20
   *     responses:
   *       200:
   *         description: Paginated list of {resource}s
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/PaginatedResponse'
   *                 - type: object
   *                   properties:
   *                     content:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/{Resource}'
   *       500:
   *         description: Server error
   */
  router.get('/{resource}s', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const query = {resource}sAdapter.getAll{Resource}sQuery(db)
      const paginatedResult = await paginate(query, ctx)

      ctx.status = 200
      ctx.body = { ...metadata, ...paginatedResult }
    } catch (err) {
      logger.error(err, 'Error listing {resource}s')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /{resource}s/{id}:
   *   get:
   *     summary: Get {resource} by ID
   *     tags: [{Resource}s]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: {Resource} found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/{Resource}'
   *       404:
   *         description: Not found
   *       500:
   *         description: Server error
   */
  router.get('/{resource}s/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const result = await {resource}sAdapter.get{Resource}ById(ctx.params.id, db)

      if (!result) {
        ctx.status = 404
        ctx.body = { reason: '{Resource} not found', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: result, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching {resource}')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /{resource}s:
   *   post:
   *     summary: Create a {resource}
   *     tags: [{Resource}s]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Create{Resource}Request'
   *     responses:
   *       201:
   *         description: Created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/{Resource}'
   *       400:
   *         description: Invalid request
   *       500:
   *         description: Server error
   */
  router.post(
    '/{resource}s',
    parseRequestBody(Create{Resource}RequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: Create{Resource}Request = ctx.request.body
        const result = await {resource}sAdapter.create{Resource}(payload, db)

        ctx.status = 201
        ctx.body = { content: result, ...metadata }
      } catch (err) {
        logger.error(err, 'Error creating {resource}')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /{resource}s/{id}:
   *   put:
   *     summary: Update a {resource}
   *     tags: [{Resource}s]
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
   *             $ref: '#/components/schemas/Update{Resource}Request'
   *     responses:
   *       200:
   *         description: Updated
   *       404:
   *         description: Not found
   *       500:
   *         description: Server error
   */
  router.put(
    '/{resource}s/:id',
    parseRequestBody(Update{Resource}RequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const payload: Update{Resource}Request = ctx.request.body
        const result = await {resource}sAdapter.update{Resource}(
          ctx.params.id,
          payload,
          db
        )

        if (!result) {
          ctx.status = 404
          ctx.body = { reason: '{Resource} not found', ...metadata }
          return
        }

        ctx.status = 200
        ctx.body = { content: result, ...metadata }
      } catch (err) {
        logger.error(err, 'Error updating {resource}')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /{resource}s/{id}:
   *   delete:
   *     summary: Delete a {resource}
   *     tags: [{Resource}s]
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
   *       500:
   *         description: Server error
   */
  router.delete('/{resource}s/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const existing = await {resource}sAdapter.get{Resource}ById(ctx.params.id, db)

      if (!existing) {
        ctx.status = 404
        ctx.body = { reason: '{Resource} not found', ...metadata }
        return
      }

      await {resource}sAdapter.delete{Resource}(ctx.params.id, db)

      ctx.status = 200
      ctx.body = { ...metadata }
    } catch (err) {
      logger.error(err, 'Error deleting {resource}')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
```

## Adapter pattern (Knex)

```typescript
import { Knex } from 'knex'
import { db } from './db'
import { {service} } from '@onecore/types'

type {Resource} = {service}.{Resource}
type Create{Resource}Request = {service}.Create{Resource}Request
type Update{Resource}Request = {service}.Update{Resource}Request

const TABLE = '{resource}s'

export function getAll{Resource}sQuery(
  dbConnection: Knex | Knex.Transaction = db
): Knex.QueryBuilder {
  return dbConnection(TABLE).orderBy('createdAt', 'desc')
}

export async function get{Resource}ById(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<{Resource} | undefined> {
  return await dbConnection(TABLE).where({ id }).first()
}

export async function create{Resource}(
  payload: Create{Resource}Request,
  dbConnection: Knex | Knex.Transaction = db
): Promise<{Resource}> {
  const [result] = await dbConnection(TABLE)
    .insert(payload)
    .returning('*')
  return result
}

export async function update{Resource}(
  id: string,
  payload: Update{Resource}Request,
  dbConnection: Knex | Knex.Transaction = db
): Promise<{Resource} | undefined> {
  const [result] = await dbConnection(TABLE)
    .where({ id })
    .update({ ...payload, updatedAt: new Date() })
    .returning('*')
  return result
}

export async function delete{Resource}(
  id: string,
  dbConnection: Knex | Knex.Transaction = db
): Promise<void> {
  await dbConnection(TABLE).where({ id }).delete()
}
```

## Adapter pattern (Prisma)

For Prisma-based services (e.g., property), the adapter wraps Prisma calls with try/catch:

```typescript
import { logger } from '@onecore/utilities'
import { prisma } from './db'

export async function get{Resource}ById(id: string) {
  try {
    return await prisma.{resource}.findUnique({ where: { id } })
  } catch (err) {
    logger.error({ err }, '{resource}s-adapter.get{Resource}ById')
    throw err
  }
}
```

## Schema pattern (libs/types)

Add to `libs/types/src/{service}/schema.ts`:

```typescript
// --- {Resource} schemas ---
export const {Resource}Schema = z.object({
  id: z.string().uuid(),
  // TODO: Add resource-specific fields
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const Create{Resource}RequestSchema = {Resource}Schema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const Update{Resource}RequestSchema = Create{Resource}RequestSchema.partial()
```

Add to `libs/types/src/{service}/types.ts`:

```typescript
export type {Resource} = z.infer<typeof {Resource}Schema>
export type Create{Resource}Request = z.infer<typeof Create{Resource}RequestSchema>
export type Update{Resource}Request = z.infer<typeof Update{Resource}RequestSchema>
```

## Test pattern (routes)

```typescript
import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { routes } from '../../routes/{resource}s'
import * as {resource}sAdapter from '../../adapters/{resource}s-adapter'
import * as factory from '../factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.clearAllMocks)

describe('GET /{resource}s/:id', () => {
  it('responds with 200 when found', async () => {
    const mock{Resource} = factory.{resource}.build({ id: 'test-id' })
    jest.spyOn({resource}sAdapter, 'get{Resource}ById').mockResolvedValueOnce(mock{Resource})

    const res = await request(app.callback()).get('/{resource}s/test-id')

    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({ id: 'test-id' })
  })

  it('responds with 404 when not found', async () => {
    jest.spyOn({resource}sAdapter, 'get{Resource}ById').mockResolvedValueOnce(undefined)

    const res = await request(app.callback()).get('/{resource}s/nonexistent')

    expect(res.status).toBe(404)
  })
})

describe('POST /{resource}s', () => {
  it('creates and returns 201', async () => {
    const created = factory.{resource}.build({ id: 'new-id' })
    jest.spyOn({resource}sAdapter, 'create{Resource}').mockResolvedValueOnce(created)

    const res = await request(app.callback())
      .post('/{resource}s')
      .send(factory.create{Resource}Request.build())

    expect(res.status).toBe(201)
  })
})
```
