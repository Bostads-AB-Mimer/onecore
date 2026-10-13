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

// Header
const { logout } = useAuth()
```

## Behaviour worth knowing

- **`state` is a nonce.** `login()` stores a random nonce and the return path
  in sessionStorage and sends only the nonce to Keycloak. `useAuthCallback`
  exchanges the code only if the returned `state` matches, and each nonce
  works once. A callback link that this tab did not start ends in
  `state-mismatch`.
- **The return path stays on the origin.** It is resolved with `URL` and
  replaced with `/` if it would leave the origin, which includes inputs like
  `/\evil.example` that browsers normalise to `//evil.example`.
- **A user who is down is not a user who is logged out.** `useUser` reports
  `unavailable` for 5xx and network errors, and only a 401 reports
  `unauthenticated` (which `useRequireUser` turns into a login). Once a user
  has loaded, a failed poll keeps them, so a brief core outage doesn't send
  anyone away from unsaved work.
- **The profile is polled every 5 seconds.** This also keeps core's session
  cookie fresh.
- **Keycloak outages show up as 401.** If core can't reach Keycloak's keys it
  falls back to legacy JWT verification, which answers 401. The
  `unavailable` state covers core and the network, not Keycloak.
