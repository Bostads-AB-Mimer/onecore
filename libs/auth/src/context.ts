import { createContext, useContext } from 'react'

/** Where to log in and where core lives. Each app resolves these from its own env. */
export interface AuthConfig {
  /** Keycloak base URL. A trailing `/realms/<realm>` is tolerated and ignored. */
  keycloakUrl: string
  keycloakRealm: string
  clientId: string
  /** This app's callback route, registered as a redirect URI on the Keycloak client. */
  redirectUri: string
  /** Base URL of core, which owns the session cookie and the `/auth/*` routes. */
  coreUrl: string
}

export const AuthConfigContext = createContext<AuthConfig | null>(null)

export function useAuthConfig(): AuthConfig {
  const config = useContext(AuthConfigContext)
  if (!config)
    throw new Error('useAuthConfig must be used inside <AuthProvider>')
  return config
}
