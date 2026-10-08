# Leasing portal frontend

The leasing portal pages, packaged two ways from one source tree:

- **Pages library** (`src/index.ts`, built by tsup to `dist/lib`). Exports
  `leasingModule`, the `OnecoreModule` contract from `@onecore/ui`: routes,
  sidebar navigation and a host wrapper that reads the BFF URL from the host's
  config. Property-tree mounts it under `/uthyrning` from its module registry.
- **Standalone shell** (`src/shell`, built by vite to `dist/app`). A thin app
  with its own header, Keycloak login and menu, for operators who do not run
  property-tree. It mounts the same route array at `/`.

## The one rule

`src/pages`, `src/host` and `src/api` never import from `src/shell`. Lint
enforces it. The host owns the frame around the pages, the pages own what is
inside it. Links inside pages are relative so they work under any prefix.

## Running locally

```bash
pnpm dev:init          # creates .env from .env.local.example
pnpm dev               # http://localhost:3020, expects core on 5010 and the BFF on 7002
pnpm generate-api-types  # regenerate src/api/generated from the running BFF
```

Property-tree mounts the pages whenever the module is bundled; set
`VITE_LEASING_BFF_URL` there for pages that call the BFF. In dev, property-tree's vite config aliases
this package to its source, so edits to the pages hot-reload there without a
build. Production builds of property-tree use `dist/lib`.

## Module decisions

Settled during review, so they need not be re-raised:

- **Bundled by default.** Property-tree ships the leasing module unless
  `ONECORE_FRONTEND_MODULES` leaves it out at build time. It is a Docker
  build argument (declared in property-tree's Dockerfile), not runtime
  config, so it cannot be set per environment from the production repo.
- **No runtime gate.** The menu and dashboard tile show wherever the module is
  bundled, whether or not `VITE_LEASING_BFF_URL` is set. Hiding it behind
  backend config was judged confusing at setup; a misconfigured environment
  shows a page error instead of a missing menu.
- **The module root is not a page.** `/uthyrning` redirects to `bostad`.

## Auth

The shell logs in through core's Keycloak flow, exactly like property-tree,
and reads the user from core's profile route. Calls to the BFF carry core's
cookie, so there is no second login.

The BFF forwards the token as a bearer, so core never refreshes it on the
way through. The API client in `src/api/client.ts` handles that: on a 401 it
posts to core's `/auth/refresh` with credentials and retries the request
once. If the refresh fails the 401 propagates and the host's login redirect
takes over. Both hosts also poll core's profile, which keeps the cookie fresh
in normal use, so the retry only matters after a long idle period.
