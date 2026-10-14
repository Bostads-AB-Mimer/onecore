import type { ContactsTokenResponse } from './keycloak-contacts'

export type ContactsTokenJson = {
  accessToken: string
  refreshToken?: string
  expiresIn: number
  refreshExpiresIn?: number
  tokenType: string
}

export function contactsTokenToJson(
  tokens: ContactsTokenResponse
): ContactsTokenJson {
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    refreshExpiresIn: tokens.refresh_expires_in,
    tokenType: tokens.token_type,
  }
}

export function readRefreshTokenFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined
  }
  const record = body as Record<string, unknown>
  if (typeof record.refreshToken === 'string' && record.refreshToken) {
    return record.refreshToken
  }
  if (typeof record.refresh_token === 'string' && record.refresh_token) {
    return record.refresh_token
  }
  return undefined
}
