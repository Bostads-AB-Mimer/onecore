# Leasing portal frontend

The leasing portal pages, packaged two ways from one source tree:

- **Pages library** (`src/index.ts`, built by tsup to `dist/lib`). Exports
  `leasingRoutes`, a react-router route array, and `LeasingHostProvider`,
  which a host wraps around them to supply the BFF URL and the logged-in
  user. Property-tree mounts this under `/uthyrning`.
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

To see the pages inside property-tree, start property-tree with
`VITE_LEASING_BFF_URL` set. In dev, property-tree's vite config aliases this
package to its source, so edits to the pages hot-reload there without a
build. Production builds of property-tree use `dist/lib`.

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
