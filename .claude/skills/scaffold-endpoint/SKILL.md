---
name: scaffold-endpoint
description: |
  Scaffold new API endpoints across this monorepo's three layers: service (Koa + Knex/Prisma), core (API gateway with openapi-fetch adapters), and frontend (React + openapi-fetch hooks). Use this skill whenever the user wants to create a new endpoint, add a new resource, add CRUD operations, scaffold API boilerplate, create a new microservice, or set up the endpoint flow from backend through core to frontend. Trigger on phrases like "create an endpoint for X", "add a route for Y", "scaffold the API for Z", "we need new endpoints in the X service", "set up the full stack for a new resource", "create a new microservice", or when the user mentions needing backend + core + frontend for a new feature. Also trigger when the user says things like "we have the frontend in apps/X, we need to create a new endpoint" or "use the X microservice for this new resource". Do NOT trigger for debugging existing endpoints, refactoring adapters, adding parameters to existing routes, fixing tests, or schema modifications.
---

# Scaffold Endpoint

Generate endpoint boilerplate across the monorepo's three layers, following the exact patterns used in production code. The generated code must pass PR review against the rules in CLAUDE.md without modification (except for TODO placeholders that require human decisions).

## Critical rules — PR review blockers

These rules have caused PR rejections. Violating any of them means the generated code will not pass review.

1. **Zod schemas belong in `libs/types/`, never locally in the service.**
   Schemas are shared across service, core, and frontend layers. Defining them in a service's local `schemas.ts` creates duplication and breaks the type-sharing contract. Always add schemas to `libs/types/src/{service}/schema.ts` and import them via `@onecore/types` in both the service and core layers.

2. **POST/PUT/PATCH routes in the service layer must use `parseRequestBody(Schema)` middleware.**
   Do not validate request bodies inline with `Schema.safeParse(ctx.request.body)`. The `parseRequestBody` middleware handles validation, 400 responses, and typing in one place. Pass the Zod schema as the argument: `router.post('/resources', parseRequestBody(CreateResourceSchema), async (ctx) => { ... })`. The validated body is then available as `ctx.request.body` with the correct type.

3. **Core adapters for new services must create `helpers.ts` and `types.ts` — not a monolithic `index.ts`.**
   Follow the modular structure from `keys-adapter/`: separate `helpers.ts` (client, ok, fail, mapFetchError, parsePaginated), `types.ts` (CommonErr, type aliases, Zod schema re-exports), and per-resource modules (`{resource}s.ts`). Never put adapter methods directly in `index.ts` — that file is only a barrel export.

## How to use this skill

When invoked, determine these parameters from the user's request (ask if unclear):

1. **Layer(s)**: `service`, `core`, `frontend`, or `all` (default: `all`)
2. **Service name**: Which service this belongs to (e.g., `keys`, `inspection`, `work-order`)
3. **Resource name**: The entity being exposed (e.g., `key`, `inspection`, `component`)
4. **Operations**: Which CRUD operations to scaffold (default: `list`, `get`, `create`, `update`, `delete`)
5. **Frontend app** (if frontend layer): Which app (e.g., `keys-portal`, `property-tree`)

## Before generating code

Read the reference implementation files from the codebase to stay in sync with evolving patterns. Don't rely on memorized templates — the codebase is the source of truth.

**Always read these files first:**
- `references/service-layer.md` — for service layer patterns
- `references/core-layer.md` — for core layer patterns
- `references/frontend-layer.md` — for frontend layer patterns

Then read the actual reference files from the codebase listed in those documents to confirm current patterns haven't drifted.

## Layer: Service (`services/`)

### Files to generate

For a resource called `{resource}` in service `{service}`:

| File | Purpose |
|------|---------|
| `services/{service}/src/services/{service}-service/routes/{resource}s.ts` | Route handlers with Swagger JSDoc |
| `services/{service}/src/services/{service}-service/adapters/{resource}s-adapter.ts` | Database adapter (thin wrapper) |
| `libs/types/src/{service}/schema.ts` | Zod schemas (add to existing file) |
| `libs/types/src/{service}/types.ts` | TypeScript types inferred from Zod (add to existing) |
| `services/{service}/src/services/{service}-service/tests/routes/{resource}s.test.ts` | Route tests |
| `services/{service}/src/services/{service}-service/tests/adapters/{resource}s-adapter.test.ts` | Adapter tests |

### Wiring modifications

- `services/{service}/src/services/{service}-service/index.ts` — import and mount the new routes
- `libs/types/src/{service}/index.ts` — export new schemas/types

### Patterns to enforce

**Schemas — always in `libs/types/` (see critical rule #1):**
- Add schemas to `libs/types/src/{service}/schema.ts` (create the directory if it doesn't exist)
- Add inferred types to `libs/types/src/{service}/types.ts`
- Export from `libs/types/src/{service}/index.ts`
- Add barrel export in `libs/types/src/index.ts` if this is a new service
- Import in both service and core layers via `import { {service} } from '@onecore/types'`
- Schema patterns: `z.object({...})`, `z.coerce.date()` for dates, `z.string().uuid()` for IDs
- Create separate schemas: `{Resource}Schema`, `Create{Resource}RequestSchema`, `Update{Resource}RequestSchema`

**Routes:**
- Export `routes = (router: KoaRouter) => { ... }`
- Every route has `@swagger` JSDoc block with full OpenAPI 3.0 spec
- POST/PUT/PATCH routes use `parseRequestBody(Schema)` middleware (see critical rule #2) — do NOT use inline safeParse
- Wrap handler body in try/catch
- Use `generateRouteMetadata(ctx)` for tracing
- Use `logger.error({ err }, 'context')` structured logging
- Import schemas from `@onecore/types`, not from local files

**Adapters:**
- Accept optional `dbConnection: Knex | Knex.Transaction = db` parameter
- Pure DB wrappers — no business logic
- For Knex services: raw query builders
- For Prisma services: Prisma client calls with try/catch + `logger.error({ err }, 'adapter.functionName')`

## Layer: Core (`core/`)

### Files to generate

For a resource in service `{service}`:

| File | Purpose |
|------|---------|
| `core/src/adapters/{service}-adapter/{resource}s.ts` | API methods using openapi-fetch |
| `core/src/adapters/{service}-adapter/types.ts` | Type aliases (add to existing) |
| `core/src/adapters/{service}-adapter/index.ts` | Barrel export (add to existing) |
| `core/src/services/{service}-service/{resource}s.ts` | Route handlers |
| `core/src/services/{service}-service/index.ts` | Schema registration + route mounting (modify existing) |
| `core/src/adapters/tests/{service}-adapter/{resource}s.test.ts` | MSW-based adapter tests |

### Wiring modifications

- `core/src/api.ts` — only if adding a brand-new service (import + register routes)
- `core/src/swagger.ts` — only if adding a brand-new service (add scan path)

### Patterns to enforce

**Adapter methods** — follow the gold standard from `keys-adapter/keys.ts`:
- ALWAYS use `openapi-fetch` (never axios for new code)
- ALWAYS wrap in try/catch with `logger.error({ err: e }, 'adapter: METHOD /path failed')`
- ALWAYS return `AdapterResult<T, E>` via `ok()` / `fail()` helpers
- Use `parsePaginated(Schema, data)` for list endpoints
- Use `Schema.parse(data.content)` for single-item endpoints

**Core route handlers:**
- `@swagger` JSDoc on every route
- `const metadata = generateRouteMetadata(ctx)`
- Pattern-match on `result.ok` / `result.err`
- Map error codes to HTTP status: `not-found` -> 404, `bad-request` -> 400, else 500
- Register schemas with `registerSchema('Name', ZodSchema)`

**Tests** — MSW-based:
- `setupServer()` with `mockServer.listen/resetHandlers/close`
- Mock HTTP responses, assert `AdapterResult` shape

## Layer: Frontend (`apps/`)

### Files to generate

| File | Purpose |
|------|---------|
| `apps/{app}/src/services/api/{resource}Service.ts` | Service adapter using openapi-fetch |
| `apps/{app}/src/services/types.ts` | Type re-exports (add to existing) |
| `apps/{app}/src/hooks/use{Resource}s.ts` | Data-fetching hook |

### Patterns to enforce

**Service adapter:** Import `GET, POST, PUT, DELETE` from `./core/base-api`, throw on error.

**Types:** Extract from `components['schemas']['ResourceName']` in generated types.

**Hooks:** Match the target app's existing pattern:
- `keys-portal`: Manual `useState` + `useCallback` + `useEffect`
- `property-tree`: React Query (`useQuery` / `useMutation`)

## Cross-layer checklist

After generating, output this checklist for the developer:

```
Generated files:
- [ ] Service routes: services/{service}/src/.../routes/{resource}s.ts
- [ ] Service adapter: services/{service}/src/.../adapters/{resource}s-adapter.ts
- [ ] Schemas added to: libs/types/src/{service}/schema.ts
- [ ] Core adapter: core/src/adapters/{service}-adapter/{resource}s.ts
- [ ] Core routes: core/src/services/{service}-service/{resource}s.ts
- [ ] Core adapter tests: core/src/adapters/tests/{service}-adapter/{resource}s.test.ts
- [ ] Frontend service: apps/{app}/src/services/api/{resource}Service.ts
- [ ] Frontend hook: apps/{app}/src/hooks/use{Resource}s.ts

Modified files:
- [ ] Service route index (mounted new routes)
- [ ] Core adapter index.ts (barrel export)
- [ ] Core service index.ts (registerSchema + route mount)
- [ ] Frontend types.ts (type re-exports)

TODOs requiring human input:
- [ ] Fill in Zod schema fields for your resource
- [ ] Add business logic in service route handlers
- [ ] Update DB migration if using Knex
- [ ] Run `generate-types` scripts after service Swagger is live
- [ ] Write additional test cases for your specific business logic
```

## Important constraints

- Read CLAUDE.md rules before generating — the skill must enforce them by construction
- The skill works for ANY service in the monorepo, not just keys or inspection
- Use openapi-fetch for all new core adapters (never axios)
- Frontend layer is optional (some endpoints are internal-only)
- All code, comments, and identifiers must be in English
- Include Swagger JSDoc on every route — not as a follow-up
