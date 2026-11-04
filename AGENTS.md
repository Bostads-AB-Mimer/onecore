# ONECore Project Guide

This is a monorepo containing all base services and applications of the ONECore platform.

## Project Structure

```
onecore/
├── core/                 # Core orchestration service (API proxy/gateway)
├── apps/                 # User-facing frontend applications
│   ├── internal-portal/
│   ├── keys-portal/
│   └── property-tree/
├── libs/                 # Libraries with common functionality
│   ├── assets/
│   ├── dax-client/
│   ├── types/
│   └── utilities/
├── services/             # Microservices providing ONECore features
│   ├── communication/
│   ├── contacts/
│   ├── economy/
│   ├── file-storage/
│   ├── inspection/
│   ├── keys/
│   ├── leasing/
│   ├── property/
│   ├── property-management/
│   └── work-order/
├── docs/                 # Local design notes (gitignored)
└── scripts/              # Build and setup scripts
```

## Package Manager

Always use `pnpm` — never `npm` or `yarn`.

## Setup

- `.env` files are copied from `.env.template` — `pnpm run dev:init` creates them and initializes databases.
- Build libraries before dependent services/apps: `pnpm run build:libs`.
- `pnpm run generate:static`: Generates code not in version control
- `pnpm run generate-types`: Generates API types from OpenAPI specs (run in core/)
- `pnpm run db:init`: Creates database schemas
- Process flows are documented as Mermaid diagrams in `DOCS_*.md` next to the code (e.g. `core/src/processes/`).

---

## Code Standards

### General

- Don't duplicate logic — check for existing helpers before writing new ones. Extract shared logic into reusable functions.
- Clean up before completing: remove resolved TODOs, commented-out code, debug logs, unused imports/variables.
- Explain non-obvious code (magic strings, hard-coded IDs, boolean flags) with inline comments.
- All code, comments, and identifiers must be in English — even when mirroring Swedish values from upstream systems like Xpand.
- New non-trivial logic (utilities, adapters, helpers) must ship with unit tests.
- NEVER use `any` typing. If types need to be generated, stop and prompt the user — never add temporary `any`.
- Errors keep their meaning end to end: use typed error codes, never decide by matching message text, and never report or log a failed or unknown outcome as success.
- A lookup of one specific resource that doesn't exist returns 404 with a specific error code. A search or list with no matches returns 200 with an empty array — never 404. A 404 is not a server failure, so the service logs it at `warn` or lower. If the caller expected the resource to exist (e.g. a code taken from another record), the caller logs it with `logger.error`. Keep `logger.error` for real failures, logged once.
- Remove code your change supersedes in the same PR, not just unused imports.
- Filter, sort and paginate at the data source. Run independent calls in parallel. No N+1 or repeated identical queries.
- Check-then-write is a race: decide inside the transaction or rely on a unique index and map the violation to 409. Never hold a transaction open across a network call. Enforce invariants on every write path (create, update, move, re-parent).
- Xpand char codes are space-padded and SQL compares them ignoring trailing blanks and case — JavaScript doesn't. Trim and normalise both sides before comparing, and handle NULL.
- Keep the diff to the change: no unrelated generated-type, lockfile or notes churn. Don't add backward-compatibility machinery for internal tools unless asked.
- When you change a flow, update its `DOCS_*.md`, `ARCHITECTURE.md` and any `.claude/skills` file that describes it, including failure branches.

### Security

- Authorize on the backend — hiding a button is not access control.
- Never interpolate input into SQL, LIKE patterns or GraphQL.
- No secrets in query strings. Never log a raw AxiosError; log `{ status, error }`.
- Protected identity (skyddad identitet): contact data comes only from the contacts service, and that path fails closed.

### Types

Define Zod schemas shared between a microservice (`services/`) and core in `libs/types/src/{service}/schema.ts` with inferred types in `types.ts` — this is the single source of truth. Import them via `@onecore/types` in both microservice routes and core adapters. The reference pattern is `libs/types/src/keys/schema.ts`. Core-only schemas (Swagger response shapes in `core/src/services/**/schemas.ts`) stay in core.

Frontends get types via the Swagger schemas exposed by core. Only define a local interface if it is display-only and used in a single file. If a type needs to be passed between components or across the app, it belongs in the shared source.

No `as` or `!` without a comment saying why; use `catch (err: unknown)`. `satisfies` is compile-time only — `.parse()` at boundaries.

### Frontend (`apps/`)

- Extract data-fetching and async logic into dedicated hooks — never inline in components.
- Guard async state updates against unmount and stale/out-of-order responses.
- Domain queries live in `entities/<entity>/hooks/` — check there before fetching at a higher layer and threading the result down. React Query dedupes, so deep components can call the same hook directly.
- A failed request gets its own error state — never render it as "no data", "logged out" or success, and never show raw server error text.
- Mutations invalidate every query key that shows the changed data. Derive state instead of syncing it with effects; reset dependent form fields when the controlling field changes.

### Core (`core/`)

- Adapters in `core/src/adapters/` are pure HTTP wrappers to one microservice — no business logic, no calling other adapters. Multi-service orchestration belongs in routes under `core/src/services/`.
- Use `PaginatedResponse<T>` — don't define custom pagination types.
- Use HTTP client built-ins for URLs and query params, not manual string construction.
- New adapters must use `openapi-fetch` with `createClient({ baseUrl })` — never `axios`. Existing axios adapters (e.g. `leasing-adapter`) are legacy and should not be used as a pattern for new code.
- Adapters map every status the service can return (400/404/409/503) to a specific error and pass `reason` through to the route and its Swagger — never collapse to 500.
- `leasing-adapter` sets `axios.defaults.validateStatus` (<500) for the whole process: set `validateStatus` explicitly on any axios call you write.
- Keep vendor names (Tenfast, Xledger) out of core routes, types and config — they belong inside a service's own adapters.
- Use `makeSuccessResponseBody` for response bodies.

### Services (`services/`)

- Microservices never call other onecore services or core — outbound HTTP is for external systems only. Multi-service orchestration belongs in core route handlers (see "Core" above).
- Every adapter function must have try/catch with `logger.error({ err }, 'adapter.functionName')`. Pino requires `(object, message)` argument order so structured fields land correctly in Elasticsearch — never use `console.error` or string concatenation.
- Swagger/JSDoc docs for every new endpoint, kept in sync with implementation.
- Return specific, semantically correct error codes — never `'unknown'`.
- Use `parseRequestBody` middleware instead of manual body parsing.
- Use `.parse()` inside try/catch — not `.safeParse()`-then-throw. Use `.safeParse()` only when you need `{ ok: false }` return semantics and you are not inside a try/catch.

---

## UI & Styling

When modifying UI styling (CSS, Tailwind, MUI, etc.), only change the specific properties requested. Do not remove or alter other existing styles. If asked to change font-size, don't touch font-weight. If asked to change spacing, don't touch colors. When in doubt, make a smaller change rather than a larger one.

## Implementation Behavior

When the user provides a task or plan, start implementing immediately. Do not spend time re-exploring the codebase, writing plan files, or restating the requirements unless explicitly asked. If you need to read files to implement, read them — but don't turn that into an exploration phase.

## Cross-Service Verification

After completing a set of related changes, run `pnpm run typecheck` before presenting the result. The monorepo currently has zero type errors — keep it that way. If you change SQL queries, show the before/after and explain what changed.

## Prettier

When you are done implementing a task, run `pnpm exec prettier --write <paths>` on the files you touched. Do NOT use `pnpm run prettier` or `pnpm -r run prettier` — those scripts have a repo-wide glob and will reformat hundreds of unrelated files regardless of the paths you pass.

## Reviewing

- Label each finding blocking, should-fix or nit. Blocking = breaks behaviour, leaks data, or breaks a Security rule or the race/invariant rule above.
- Findings in code the PR didn't touch: mark as pre-existing and suggest a follow-up card instead.
- At most 5 nits. Don't report what CI enforces (lint, formatting, types).
