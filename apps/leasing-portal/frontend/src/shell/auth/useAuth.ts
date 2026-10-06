import { authConfig } from '../authConfig'

// Third copy of the Keycloak login flow (property-tree, keys-portal, here). Candidate for a shared auth package.
export function useAuth() {
  const login = (currentClientPath?: string) => {
    let keycloakBaseUrl = authConfig.keycloakUrl
    if (keycloakBaseUrl.match(/realms\/[a-zA-Z0-9-]+$/)) {
      keycloakBaseUrl = keycloakBaseUrl.slice(
        0,
        keycloakBaseUrl.indexOf('/realms/')
      )
    }
    const authUrl = new URL(
      `${keycloakBaseUrl}/realms/${authConfig.keycloakRealm}/protocol/openid-connect/auth`
    )
    authUrl.searchParams.append('client_id', authConfig.clientId)
    authUrl.searchParams.append('redirect_uri', authConfig.redirectUri)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('scope', 'openid profile email')

    // TODO: `state` only carries the return path; generate a nonce and verify it in
    // AuthCallback for CSRF protection. Same gap in property-tree and keys-portal.
    if (currentClientPath) {
      authUrl.searchParams.append('state', currentClientPath)
    }

    window.location.href = authUrl.toString()
  }

  const logout = () => {
    window.location.href = `${authConfig.apiUrl}/auth/logout`
  }

  return { login, logout }
}
