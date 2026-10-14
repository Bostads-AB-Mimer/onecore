import keycloak from 'keycloak-koa'
import axios from 'axios'
import config from '../../common/config'
import { logger } from '@onecore/utilities'
import type { TokenData } from 'keycloak-koa/dist/types'

export function isContactsKeycloakConfigured(): boolean {
  const { clientSecret, clientId, realm } = config.auth.keycloakContacts
  return Boolean(clientSecret && clientId && realm && config.auth.keycloak.url)
}

function contactsKeycloakRealmUrl(): string {
  return `${config.auth.keycloak.url}/realms/${config.auth.keycloakContacts.realm}`
}

let contactsAuth: ReturnType<typeof keycloak> | null = null
let refreshInProgress: Promise<TokenData> | null = null

function getContactsAuth(): ReturnType<typeof keycloak> {
  if (!isContactsKeycloakConfigured()) {
    throw new Error('Contacts Keycloak is not configured')
  }

  if (!contactsAuth) {
    contactsAuth = keycloak({
      keycloakUrl: contactsKeycloakRealmUrl(),
      clientId: config.auth.keycloakContacts.clientId,
      clientSecret: config.auth.keycloakContacts.clientSecret,
    })
    logger.info(
      `Contacts Keycloak initialized for realm ${config.auth.keycloakContacts.realm}`
    )
  }

  return contactsAuth
}

export async function refreshContactsAccessToken(
  refreshToken: string
): Promise<TokenData> {
  if (refreshInProgress) {
    return refreshInProgress
  }

  refreshInProgress = (async () => {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.auth.keycloakContacts.clientId,
      client_secret: config.auth.keycloakContacts.clientSecret,
      refresh_token: refreshToken,
    }).toString()

    const tokenEndpoint = `${contactsKeycloakRealmUrl()}/protocol/openid-connect/token`

    const response = await axios.post<TokenData>(tokenEndpoint, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    })

    return response.data
  })()

  try {
    return await refreshInProgress
  } finally {
    refreshInProgress = null
  }
}

export async function exchangeContactsAuthorizationCode(
  code: string,
  redirectUri: string
) {
  const auth = getContactsAuth()
  const tokenData = await auth.tokenService.exchangeCodeForTokens(
    code,
    redirectUri
  )
  const verifiedToken = await auth.jwksService.verifyToken(
    tokenData.access_token
  )

  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in,
    token_type: tokenData.token_type ?? 'Bearer',
    user: {
      id: verifiedToken.sub,
      email: verifiedToken.email,
      name: verifiedToken.name,
      preferred_username: verifiedToken.preferred_username,
      realm_access: verifiedToken.realm_access,
      source: 'keycloak' as const,
    },
  }
}

/** @internal Test hook to reset cached client between tests */
export function resetContactsKeycloakClientForTests(): void {
  contactsAuth = null
  refreshInProgress = null
}
