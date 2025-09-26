import { resolve } from '@/services/utils/env'

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
    'http://localhost:3000/callback'
  ),
}