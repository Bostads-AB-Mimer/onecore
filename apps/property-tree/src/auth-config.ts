export const authConfig = {
  keycloakUrl:
    import.meta.env.VITE_KEYCLOAK_URL ||
    'https://auth-test.mimer.nu/realms/onecore-test',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'onecore-test',
  apiUrl: import.meta.env.VITE_CORE_API_URL || 'http://localhost:5010',
  redirectUri:
    import.meta.env.VITE_KEYCLOAK_REDIRECT_URI ||
    'http://localhost:3000/callback',
}
