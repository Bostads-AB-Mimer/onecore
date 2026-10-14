import axios from 'axios'
import config from '../../common/config'
import type { TokenData } from 'keycloak-koa/dist/types'

/** OAuth token endpoint — must reject 4xx even when leasing-adapter widens axios defaults. */
const contactsTokenPostConfig = {
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  timeout: 10000,
  validateStatus: (status: number) => status >= 200 && status < 300,
} as const

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

  const response = await axios.post<TokenData>(
    tokenEndpointUrl(),
    params,
    contactsTokenPostConfig
  )

  return toContactsTokenResponse(response.data)
}

export async function exchangeContactsAuthorizationCode(
  code: string,
  redirectUri: string
): Promise<ContactsTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.auth.keycloak.contacts.clientId,
    client_secret: config.auth.keycloak.contacts.clientSecret,
    code,
    redirect_uri: redirectUri,
  }).toString()

  const response = await axios.post<TokenData>(
    tokenEndpointUrl(),
    params,
    contactsTokenPostConfig
  )

  return toContactsTokenResponse(response.data)
}

/** @internal Test hook — kept for tests that reset module state between cases */
export function resetContactsKeycloakClientForTests(): void {}
