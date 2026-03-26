---
name: type-pipeline
description: >
  Use when modifying, creating, or reasoning about TypeScript types, Zod schemas,
  Swagger/OpenAPI specs, or generated API types anywhere in the ONECore monorepo.
  Also use when adding new API endpoints, changing request/response shapes, or
  encountering type errors in consumers (Core adapters, frontends). Triggers on
  work touching files in libs/types, services/*/types, services/*/schemas,
  */generated/api-types.ts, core/src/swagger.ts, core/src/utils/openapi.ts,
  or any frontend service layer. If you're about to edit a type and aren't sure
  where it comes from — use this skill.
---

# ONECore Type Pipeline

Types in this monorepo flow through a pipeline: Zod schemas in microservices generate Swagger/OpenAPI specs, which generate TypeScript types consumed by Core and frontends. Understanding this pipeline prevents wasted work — editing generated types, implementing workarounds for stale types, or making changes in the wrong layer.

## First: Are the Types Just Stale?

Before editing any type to fix a mismatch, check whether the generated types are simply out of date. This is the most common cause of type errors in consumers. The generated `api-types.ts` files are snapshots from the last time `openapi-typescript` ran against a live service — if the Zod schemas have been updated since then, regeneration is the fix, not a workaround.

**Never** use type assertions, manual interfaces, `as any` casts, or wrapper types to paper over a mismatch that regeneration would fix.

**Regenerate automatically** — don't ask the user for permission. These commands only overwrite generated files, which are meant to be overwritten. If the service isn't running, tell the user to start it (the commands fetch from live Swagger endpoints).

| Target | Command | Requires |
|---|---|---|
| Core (all services) | `pnpm generate-types` | property, work-order, inspection, keys running |
| Core (property only) | `pnpm generate-types:property-base` | port 5050 |
| Core (work-order only) | `pnpm generate-types:work-order` | port 5070 |
| Core (inspection only) | `pnpm generate-types:inspection` | port 5090 |
| Core (keys only) | `pnpm generate-types:keys` | port 5092 |
| property-tree (property) | `pnpm generate-api-types` | port 5050 |
| property-tree (core) | `pnpm generate-api-types:core` | port 5010 |
| keys-portal (keys) | `pnpm generate-api-types` | port 5092 |
| keys-portal (core) | `pnpm generate-api-types:core` | port 5010 |

Run these from the relevant package directory. After regeneration, check if the type error is resolved before pursuing any other fix.

## The Type Flow

```
Zod Schema (service or libs/types)
    |
    v  zod-to-json-schema (target: openApi3)
registerSchema() in service routes
    |
    v
Swagger spec (/swagger.json on running service)
    |
    v  openapi-typescript
Generated api-types.ts
    |
    v
Consumers (Core adapters via openapi-fetch, frontends)
```

Not every service has the full pipeline — see the Service Inventory below.

## Where Am I? What Do I Do?

When you're about to change a type, first identify which layer you're in. The layer determines where the change should actually happen.

### libs/types — Shared Domain Types

**Path:** `libs/types/src/`

This is the shared type library (`@onecore/types`). It contains both hand-written TypeScript interfaces (like `Contact`, `Lease`, `Tenant` in `types.ts`) and Zod schemas (in `schemas/`). Both approaches are fine here — this layer defines shared domain concepts, not API contracts.

- Edit interfaces and schemas directly
- Changes here affect every consumer across the monorepo
- Build with `pnpm run build:types` after changes (consumers depend on the built output)

### services/* — Microservice Zod Schemas

**Paths:** `services/*/src/types/`, `services/*/src/services/*/schemas.ts`

This is the source of truth for API contracts. Type changes to an API's request/response shape start here.

1. Modify or create the Zod schema
2. Register it via `registerSchema()` in the service's route file (this connects it to Swagger)
3. Downstream consumers (Core, frontends) will need type regeneration

### core/src/utils/openapi.ts, core/src/swagger.ts — Swagger Registration

This is the glue between Zod schemas and the OpenAPI spec. `registerSchema()` converts Zod schemas to JSON Schema (OpenAPI 3.0 format) and adds them to the schema registry. `updateSwaggerSchemas()` injects registered schemas into the Swagger spec.

If a type exists as a Zod schema but isn't appearing in the Swagger output, it probably hasn't been registered. Add a `registerSchema('TypeName', TypeNameSchema)` call in the relevant route file.

### */generated/api-types.ts — Generated Types

**NEVER edit these files.** They are output of `openapi-typescript` and will be overwritten on next generation. If the types here are wrong, the fix is upstream — in the Zod schema, the `registerSchema()` call, or the Swagger configuration. If they're just stale, regenerate (see commands above).

### apps/property-tree, apps/keys-portal — Frontend Consumers

Types come from two sources:
- `components['schemas']['...']` extracted from generated `api-types.ts`
- Direct imports from `@onecore/types`

If a type is missing or wrong in the generated file, trace it back: generated file <- Core's Swagger <- microservice Zod schema. App-specific types that don't come from the API go in the app's `services/types.ts`.

Both apps use `openapi-fetch` for type-safe API calls — the `GET`, `POST`, etc. functions are fully typed from the generated paths.

### apps/internal-portal — BFF Architecture

Internal-portal has a Backend-For-Frontend (BFF) layer. This is established architecture — work through it, don't bypass it.

- **BFF backend** (`apps/internal-portal/backend/`): Koa server that proxies to Core via Axios. Uses `@onecore/types` directly. No type generation.
- **BFF frontend** (`apps/internal-portal/frontend/`): React app that calls the BFF via untyped Axios. Uses `@onecore/types` for domain types.
- Changes to shared types go in `libs/types`. No type generation pipeline is involved here.

## Tracing a Type Change Upstream

When you need to change an API contract (request/response shape), work upstream through the pipeline:

1. **Find the Zod schema** in the microservice (`services/*/src/types/` or `services/*/src/services/*/schemas.ts`)
2. **Modify the schema** — this is the source of truth
3. **Verify it's registered** — check that `registerSchema('TypeName', TypeNameSchema)` exists in the route file
4. **Regenerate downstream types** — run the appropriate generation commands
5. **Update consumers** — fix any code that uses the changed types

If the change is a shared domain type not part of any API contract (e.g., a utility type used only in frontend logic), edit it directly in `libs/types`.

## Services Without Full Pipeline

Some services don't have the full Zod -> Swagger -> codegen pipeline yet. When working in these services, warn about the gap and suggest building the pipeline as a separate task. Don't block current work — proceed with whatever approach currently works in that service. Don't build out missing pipeline steps as part of an unrelated task.

## Service Inventory

This table tracks which services have which parts of the pipeline. **Update this table** when you observe or make changes to a service's pipeline maturity — but only after changes are actually committed and working, not based on plans.

### Microservices

| Service | Zod Schemas | Swagger/OpenAPI | Registered in Swagger | Core Codegen | Notes |
|---|---|---|---|---|---|
| property | Yes | Yes | Yes | Yes | Full pipeline. Also has Prisma-generated Zod schemas |
| keys | Yes | Yes | Yes | Yes | Full pipeline |
| work-order | Yes | Yes | Yes | Yes | Full pipeline |
| inspection | Yes | Yes | Yes | Yes | Full pipeline |
| leasing | Yes | Yes | Partial | No | Schemas not fully registered. Core uses @onecore/types instead |
| communication | No | No | No | No | No type pipeline |
| property-management | No | Partial (JSDoc) | No | No | Basic Swagger via JSDoc, no Zod |
| economy | No | No | No | No | No type pipeline |
| file-storage | No | Partial (JSDoc) | No | No | Basic Swagger via JSDoc, no Zod |

### Frontends

| App | Type Generation | API Client | Type Source |
|---|---|---|---|
| property-tree | Yes (Core + property service) | openapi-fetch | Generated + @onecore/types |
| keys-portal | Yes (Core + keys service) | openapi-fetch | Generated + @onecore/types |
| internal-portal | No | Axios (untyped) | @onecore/types only |

### Service Ports

| Service | Port | Swagger URL |
|---|---|---|
| Core | 5010 | http://localhost:5010/swagger |
| Property | 5050 | http://localhost:5050/swagger |
| Work Order | 5070 | http://localhost:5070/swagger |
| Inspection | 5090 | http://localhost:5090/swagger |
| Keys | 5092 | http://localhost:5092/swagger |

## Naming Conventions

Follow these established conventions when creating new types or schemas:

| What | Convention | Example |
|---|---|---|
| Zod schema | `PascalCaseSchema` | `ComponentCategorySchema` |
| Inferred type from Zod | `PascalCase` (no suffix) | `type ComponentCategory = z.infer<typeof ComponentCategorySchema>` |
| Manual interface | `PascalCase` | `interface Contact` |
| Query param schema | `camelCaseSchema` | `buildingsQueryParamsSchema` |
| File names | `kebab-case.ts` | `component-category.ts` |
| Generated files | Don't rename | `api-types.ts` in `generated/` dirs |

## Key Packages

- `zod` — runtime validation + schema definition
- `zod-to-json-schema` — converts Zod to OpenAPI 3.0 JSON Schema
- `swagger-jsdoc` — parses JSDoc comments for API docs
- `openapi-typescript` — generates TypeScript types from Swagger/OpenAPI specs
- `openapi-fetch` — type-safe HTTP client consuming generated types
