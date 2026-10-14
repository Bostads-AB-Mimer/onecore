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

/** JSON `null`, arrays, and non-objects normalize to {} for validation. */
export function readJsonBodyRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {}
  }
  return body as Record<string, unknown>
}

export function readCodeVerifierFromBody(body: unknown): string | undefined {
  const record = readJsonBodyRecord(body)
  if (typeof record.codeVerifier === 'string' && record.codeVerifier) {
    return record.codeVerifier
  }
  if (typeof record.code_verifier === 'string' && record.code_verifier) {
    return record.code_verifier
  }
  return undefined
}

export function readRefreshTokenFromBody(body: unknown): string | undefined {
  const record = readJsonBodyRecord(body)
  if (typeof record.refreshToken === 'string' && record.refreshToken) {
    return record.refreshToken
  }
  if (typeof record.refresh_token === 'string' && record.refresh_token) {
    return record.refresh_token
  }
  return undefined
}
