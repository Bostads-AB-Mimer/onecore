import { authConfig } from '@/auth-config'

export function useAuth() {
  const login = (currentClientPath?: string) => {
    let keycloakBaseUrl = authConfig.keycloakUrl
    if (keycloakBaseUrl?.match(/realms\/[a-zA-Z0-9-]+$/)) {
      console.warn(
        'VITE_KEYCLOAK_URL should not contain realm path - use VITE_KEYCLOAK_REALM'
      )
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

    if (currentClientPath) {
      authUrl.searchParams.append(
        'state',
        encodeURIComponent(currentClientPath)
      )
    }

    window.location.href = authUrl.toString()
  }

  const logout = () => {
    const logoutUrl = new URL(`${authConfig.apiUrl}/auth/logout`)
    window.location.href = logoutUrl.toString()
  }

  return {
    login,
    logout,
  }
}
