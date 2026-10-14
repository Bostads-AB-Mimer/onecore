# @onecore/auth

Login for the ONECore frontends through core's Keycloak flow. Keycloak issues
a code, core exchanges it and sets the session cookie, and the app reads the
user from core's `/auth/profile`.

The package has the logic only: hooks and plain functions, no markup. Each
app renders its own loading, error and callback views with its own
components.

## Using it in an app

```tsx
// App.tsx
import { AuthProvider } from '@onecore/auth'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider config={authConfig}>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

`authConfig` is an `AuthConfig` (`keycloakUrl`, `keycloakRealm`, `clientId`,
`redirectUri`, `coreUrl`). The app resolves the values from its own env. The
package does not read `window.__ENV` or `import.meta.env`.

```tsx
// Route guard: sends the user to login once on a 401.
const user = useRequireUser()

// Callback route (the app's redirectUri): exchanges the code, then the app navigates.
const callback = useAuthCallback()
if (callback.tag === 'success')
  return <Navigate to={callback.returnTo} replace />
if (callback.tag === 'not-started') return <Navigate to="/" replace />

// Header
const { logout } = useAuth()
```

## Behaviour worth knowing

- **`state` is a nonce.** `login()` stores a random nonce and the return path
  in sessionStorage and sends only the nonce to Keycloak. `useAuthCallback`
  exchanges the code only if the returned `state` matches, and each nonce
  works once. A nonce that doesn't match ends in `state-mismatch`.
- **A callback the tab didn't start is not an error.** With no pending login
  in the tab (the Back button returning to Keycloak after a finished login,
  or a Keycloak email link opened in a new tab), `useAuthCallback` returns
  `not-started` without exchanging the code. The app should send the user to
  `/`, where `useRequireUser` logs in again if needed.
- **The return path stays on the origin.** It is resolved with `URL`, and
  both the input and the normalised result must stay on the origin, or the
  path becomes `/`. This covers inputs browsers normalise to another origin,
  such as `/\evil.example` and `/.//evil.example`.
- **A user who is down is not a user who is logged out.** `useUser` reports
  `unavailable` for 5xx and network errors, and only a 401 reports
  `unauthenticated` (which `useRequireUser` turns into a login). Once a user
  has loaded, a failed poll keeps them, so a brief core outage doesn't send
  anyone away from unsaved work.
- **Core answers 204 when it can't reach Keycloak.** If fetching Keycloak's
  signing keys fails, core's auth middleware lets the request through without
  a user and `/auth/profile` returns an empty 204. `useUser` treats that as
  `unavailable` too.
- **The profile is polled every 5 seconds.** This also keeps core's session
  cookie fresh.
