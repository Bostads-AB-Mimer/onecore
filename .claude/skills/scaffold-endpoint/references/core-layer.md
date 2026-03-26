# Core Layer Patterns

## Reference files to read before generating

Read these files from the codebase to confirm current patterns:

- `core/src/adapters/keys-adapter/helpers.ts` — client(), ok(), fail(), mapFetchError(), parsePaginated()
- `core/src/adapters/keys-adapter/keys.ts` — gold standard adapter methods
- `core/src/adapters/keys-adapter/types.ts` — type aliases + CommonErr
- `core/src/adapters/keys-adapter/index.ts` — barrel exports
- `core/src/adapters/types.ts` — AdapterResult<T, E> definition
- `core/src/services/keys-service/keys.ts` — route handler pattern
- `core/src/services/keys-service/index.ts` — schema registration + route mounting
- `core/src/utils/openapi.ts` — registerSchema utility
- `core/src/api.ts` — route registration hub
- `core/src/adapters/tests/keys-adapter/` — MSW test pattern

## File structure

For resource `{resource}` in service `{service}`:

```
core/src/
├── adapters/
│   └── {service}-adapter/
│       ├── helpers.ts              # Existing: client(), ok(), fail(), etc.
│       ├── types.ts                # MODIFY: add type aliases
│       ├── index.ts                # MODIFY: add barrel export
│       ├── {resource}s.ts          # NEW: adapter methods
│       └── generated/
│           └── api-types.ts        # Auto-generated (DO NOT EDIT)
├── services/
│   └── {service}-service/
│       ├── index.ts                # MODIFY: registerSchema + mount routes
│       └── {resource}s.ts          # NEW: route handlers
└── adapters/tests/
    └── {service}-adapter/
        └── {resource}s.test.ts     # NEW: MSW-based tests
```

If creating a brand-new service adapter (no existing `{service}-adapter/` directory), also create:
- `helpers.ts` with `client()`, `ok()`, `fail()`, `mapFetchError()`, `parsePaginated()`
- `types.ts` with `CommonErr` type and all type aliases
- Add route import to `core/src/api.ts`
- Add scan path to `core/src/swagger.ts`

## Adapter methods pattern

This is the gold standard pattern from `keys-adapter/keys.ts`. Every new adapter MUST follow this exact structure:

```typescript
import { logger } from '@onecore/utilities'
import { z } from 'zod'
import { client, mapFetchError, ok, fail, parsePaginated } from './helpers'
import {
  {Resource},
  {Resource}Schema,
  PaginatedResponse,
  CommonErr,
  AdapterResult,
} from './types'

export const {Resource}sApi = {
  list: async (
    query: Record<string, string | string[] | undefined>
  ): Promise<AdapterResult<PaginatedResponse<{Resource}>, CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/{resource}s', {
        params: { query: query as any },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(parsePaginated({Resource}Schema, data))
    } catch (e) {
      logger.error({ err: e }, '{service}-adapter: GET /{resource}s failed')
      return fail('unknown')
    }
  },

  get: async (
    id: string
  ): Promise<AdapterResult<{Resource}, 'not-found' | CommonErr>> => {
    try {
      const { data, error, response } = await client().GET('/{resource}s/{id}', {
        params: { path: { id } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok({Resource}Schema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, '{service}-adapter: GET /{resource}s/{id} failed')
      return fail('unknown')
    }
  },

  create: async (
    payload: Partial<{Resource}>
  ): Promise<AdapterResult<{Resource}, 'bad-request' | CommonErr>> => {
    try {
      const { data, error, response } = await client().POST('/{resource}s', {
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok({Resource}Schema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, '{service}-adapter: POST /{resource}s failed')
      return fail('unknown')
    }
  },

  update: async (
    id: string,
    payload: Partial<{Resource}>
  ): Promise<AdapterResult<{Resource}, 'not-found' | 'bad-request' | CommonErr>> => {
    try {
      const { data, error, response } = await client().PUT('/{resource}s/{id}', {
        params: { path: { id } },
        body: payload as any,
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok({Resource}Schema.parse(data.content))
    } catch (e) {
      logger.error({ err: e }, '{service}-adapter: PUT /{resource}s/{id} failed')
      return fail('unknown')
    }
  },

  remove: async (
    id: string
  ): Promise<AdapterResult<unknown, 'not-found' | CommonErr>> => {
    try {
      const { error, response } = await client().DELETE('/{resource}s/{id}', {
        params: { path: { id } },
      })
      if (error || !response.ok) return fail(mapFetchError(response))
      return ok(undefined)
    } catch (e) {
      logger.error({ err: e }, '{service}-adapter: DELETE /{resource}s/{id} failed')
      return fail('unknown')
    }
  },
}
```

## helpers.ts pattern (for new service adapters only)

If creating a brand-new adapter directory, create `helpers.ts` following this pattern from `keys-adapter/helpers.ts`:

```typescript
import createClient from 'openapi-fetch'
import { z } from 'zod'
import Config from '../../common/config'
import { paths } from './generated/api-types'
import {
  CommonErr,
  AdapterResult,
  PaginatedResponse,
  PaginationMetaSchema,
  PaginationLinksSchema,
} from './types'

export const client = () =>
  createClient<paths>({
    baseUrl: Config.{service}Service.url,
    headers: { 'Content-Type': 'application/json' },
  })

export function mapFetchError(response: { status: number }): CommonErr {
  const status = response.status
  if (status === 400) return 'bad-request'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not-found'
  if (status === 409) return 'conflict'
  return 'unknown'
}

export function ok<T>(data: T): AdapterResult<T, never> {
  return { ok: true, data }
}

export function fail<E extends CommonErr>(err: E): AdapterResult<never, E> {
  return { ok: false, err }
}

export function parsePaginated<S extends z.ZodTypeAny>(
  itemSchema: S,
  data: unknown
): PaginatedResponse<z.output<S>> {
  const obj = data as Record<string, unknown>
  return {
    content: z.array(itemSchema).parse(obj.content),
    _meta: PaginationMetaSchema.parse(obj._meta),
    _links: z.array(PaginationLinksSchema).parse(obj._links),
  }
}
```

## types.ts pattern (for new service adapters)

```typescript
import { {service} } from '@onecore/types'

export type { AdapterResult } from '../types'

// Type aliases from @onecore/types
export type {Resource} = {service}.{Resource}
export type Create{Resource}Request = {service}.Create{Resource}Request
export type Update{Resource}Request = {service}.Update{Resource}Request
export type PaginatedResponse<T> = {service}.PaginatedResponse<T>

// Zod schemas
export const {
  {Resource}Schema,
  PaginationMetaSchema,
  PaginationLinksSchema,
} = {service}

// Shared error type
export type CommonErr =
  | 'bad-request'
  | 'not-found'
  | 'conflict'
  | 'unauthorized'
  | 'forbidden'
  | 'unknown'
```

## Core route handler pattern

```typescript
import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { {Resource}sApi } from '../../adapters/{service}-adapter'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /{resource}s:
   *   get:
   *     summary: List {resource}s with pagination
   *     tags: [{Service} Service]
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
   *         description: Paginated list
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
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/{resource}s', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await {Resource}sApi.list(ctx.query)

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching {resource}s')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })

  /**
   * @swagger
   * /{resource}s/{id}:
   *   get:
   *     summary: Get {resource} by ID
   *     tags: [{Service} Service]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/{Resource}'
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
  router.get('/{resource}s/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await {Resource}sApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: '{Resource} not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching {resource}')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /{resource}s:
   *   post:
   *     summary: Create a {resource}
   *     tags: [{Service} Service]
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
  router.post('/{resource}s', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await {Resource}sApi.create(payload)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating {resource}')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /{resource}s/{id}:
   *   put:
   *     summary: Update a {resource}
   *     tags: [{Service} Service]
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
   *     security:
   *       - bearerAuth: []
   */
  router.put('/{resource}s/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await {Resource}sApi.update(ctx.params.id, payload)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: '{Resource} not found', ...metadata }
        return
      }
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating {resource}')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  /**
   * @swagger
   * /{resource}s/{id}:
   *   delete:
   *     summary: Delete a {resource}
   *     tags: [{Service} Service]
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
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/{resource}s/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await {Resource}sApi.remove(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: '{Resource} not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error deleting {resource}')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata }
  })
}
```

## Service index.ts modifications

Add to the existing `core/src/services/{service}-service/index.ts`:

```typescript
// Add import
import { routes as {resource}Routes } from './{resource}s'

// Inside the routes function, add:
// 1. Schema registrations
registerSchema('{Resource}', {Resource}Schema)
registerSchema('Create{Resource}Request', Create{Resource}RequestSchema)
registerSchema('Update{Resource}Request', Update{Resource}RequestSchema)

// 2. Mount sub-routes
{resource}Routes(router)
```

## MSW test pattern

```typescript
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import config from '../../../common/config'
import { {Resource}sApi } from '../../{service}-adapter'

const mockServer = setupServer()

describe('{service}-adapter {Resource}sApi', () => {
  beforeAll(() => mockServer.listen())
  afterEach(() => mockServer.resetHandlers())
  afterAll(() => mockServer.close())

  describe('list', () => {
    it('returns paginated {resource}s on 200', async () => {
      mockServer.use(
        http.get(`${config.{service}Service.url}/{resource}s`, () =>
          HttpResponse.json({
            content: [{ id: 'test-id' }],
            _meta: { totalRecords: 1, page: 1, limit: 20, count: 1 },
            _links: [{ href: '/{resource}s?page=1&limit=20', rel: 'self' }],
          }, { status: 200 })
        )
      )

      const result = await {Resource}sApi.list({})
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.content).toHaveLength(1)
      }
    })

    it('returns error on 500', async () => {
      mockServer.use(
        http.get(`${config.{service}Service.url}/{resource}s`, () =>
          new HttpResponse(null, { status: 500 })
        )
      )

      const result = await {Resource}sApi.list({})
      expect(result.ok).toBe(false)
    })
  })

  describe('get', () => {
    it('returns {resource} on 200', async () => {
      mockServer.use(
        http.get(`${config.{service}Service.url}/{resource}s/:id`, () =>
          HttpResponse.json({
            content: { id: 'test-id' },
          }, { status: 200 })
        )
      )

      const result = await {Resource}sApi.get('test-id')
      expect(result.ok).toBe(true)
    })

    it('returns not-found on 404', async () => {
      mockServer.use(
        http.get(`${config.{service}Service.url}/{resource}s/:id`, () =>
          new HttpResponse(null, { status: 404 })
        )
      )

      const result = await {Resource}sApi.get('missing')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('not-found')
    })
  })
})
```
