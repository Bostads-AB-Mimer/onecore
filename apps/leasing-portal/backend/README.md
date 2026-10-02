# Leasing portal backend

Backend for frontend (BFF) for the ONECore leasing portal. It talks only to
core and is served under core's hostname at the `/leasing-portal` prefix, so
the browser sends core's host-only auth cookie along with every request. The
token in that cookie is forwarded to core as a bearer token, so core's role
checks apply to the logged-in user.

Login, logout and token refresh are not handled here. The frontend uses core's
`/auth/*` routes directly, the same way property-tree does.

## Token refresh contract

Core only refreshes an expiring token when it reads it from the cookie itself.
This service forwards the token as a bearer header, so core never refreshes
on our behalf and never sets new cookies through us. Once the access token
expires, every call here returns 401 until the frontend refreshes it:

1. A call returns 401.
2. The frontend calls `POST {core}/auth/refresh` with credentials included.
   Core reads the `refresh_token` cookie and sets a fresh `auth_token` cookie.
3. The frontend retries the original call once.
4. If the refresh itself returns 401, the frontend sends the user to login.

Core 4xx responses (403, 404, 409...) are passed through with core's body so
core's role checks reach the browser unchanged. Anything else from core,
including network failure, becomes 502 `core-unavailable`.

## Running locally

```bash
pnpm dev:init   # creates .env from .env.template
pnpm dev        # http://localhost:7002/leasing-portal
```

Swagger UI: `http://localhost:7002/leasing-portal/swagger`

## Layout

- `src/app.ts` builds the Koa app from an `AppContext`.
- `src/context.ts` wires config and modules. Tests override modules here.
- `src/adapters/core-adapter.ts` is the only way out to core.
- `src/services/*` hold the typed routes, one folder per area.
- `test/e2e` runs the app through supertest with a fake core client.
