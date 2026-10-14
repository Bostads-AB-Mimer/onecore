import keycloak from 'keycloak-koa'
import axios from 'axios'
import config from '../../common/config'
import { logger } from '@onecore/utilities'
import type { TokenData } from 'keycloak-koa/dist/types'

export function isContactsKeycloakConfigured(): boolean {
  const { clientSecret, clientId, realm } = config.auth.keycloak.contacts
  return Boolean(clientSecret && clientId && realm && config.auth.keycloak.url)
}

function contactsKeycloakRealmUrl(): string {
  return `${config.auth.keycloak.url}/realms/${config.auth.keycloak.contacts.realm}`
}

function tokenEndpointUrl(): string {
  return `${contactsKeycloakRealmUrl()}/protocol/openid-connect/token`
}

let contactsAuth: ReturnType<typeof keycloak> | null = null

function getContactsAuth(): ReturnType<typeof keycloak> {
  if (!isContactsKeycloakConfigured()) {
    throw new Error('Contacts Keycloak is not configured')
  }

  if (!contactsAuth) {
    contactsAuth = keycloak({
      keycloakUrl: contactsKeycloakRealmUrl(),
      clientId: config.auth.keycloak.contacts.clientId,
      clientSecret: config.auth.keycloak.contacts.clientSecret,
    })
    logger.info(
      `Contacts Keycloak initialized for realm ${config.auth.keycloak.contacts.realm}`
    )
  }

  return contactsAuth
}

export type ContactsTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  refresh_expires_in?: number
  token_type: string
}

function toContactsTokenResponse(data: TokenData): ContactsTokenResponse {
  const extended = data as TokenData & { refresh_expires_in?: number }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    refresh_expires_in: extended.refresh_expires_in,
    token_type: data.token_type ?? 'Bearer',
  }
}

export async function refreshContactsAccessToken(
  refreshToken: string
): Promise<ContactsTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.auth.keycloak.contacts.clientId,
    client_secret: config.auth.keycloak.contacts.clientSecret,
    refresh_token: refreshToken,
  }).toString()

  const response = await axios.post<TokenData>(tokenEndpointUrl(), params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  })

  return toContactsTokenResponse(response.data)
}

export async function exchangeContactsAuthorizationCode(
  code: string,
  redirectUri: string
): Promise<ContactsTokenResponse> {
  const auth = getContactsAuth()
  const tokenData = await auth.tokenService.exchangeCodeForTokens(
    code,
    redirectUri
  )
  return toContactsTokenResponse(tokenData)
}

/** @internal Test hook to reset cached client between tests */
export function resetContactsKeycloakClientForTests(): void {
  contactsAuth = null
}
