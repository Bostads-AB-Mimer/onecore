import { resolve } from './lib/env'

// Defaults mirror property-tree's so local dev logs in against the same realm and client.
export const authConfig = {
  keycloakUrl: resolve(
    'VITE_KEYCLOAK_URL',
    'https://auth-test.mimer.nu/realms/onecore-test'
  ),
  keycloakRealm: resolve('VITE_KEYCLOAK_REALM', 'onecore'),
  clientId: resolve('VITE_KEYCLOAK_CLIENT_ID', 'onecore'),
  apiUrl: resolve('VITE_CORE_API_URL', 'http://localhost:5010'),
  redirectUri: resolve(
    'VITE_KEYCLOAK_REDIRECT_URI',
    'http://localhost:3020/callback'
  ),
  bffUrl: resolve(
    'VITE_LEASING_BFF_URL',
    'http://localhost:7002/leasing-portal'
  ),
}
