import axios, { isAxiosError } from 'axios'
import { decodeJwt } from 'jose'
import { logger } from '@onecore/utilities'

import config from '../../common/config'
import { contactsAdapter } from '../../adapters/contacts-adapter'
import type { AdapterResult } from '../../adapters/types'
import {
  type ContactsTokenResponse,
  refreshContactsAccessToken,
} from './keycloak-contacts'

const CONTACT_CODE_ATTRIBUTE = 'contact_code'

/** Must reject 4xx even when leasing-adapter widens axios defaults. */
const keycloakRequestConfig = {
  timeout: 10000,
  validateStatus: (status: number) => status >= 200 && status < 300,
} as const

export class ContactCodeError extends Error {
  constructor(
    readonly reason: 'contacts_unavailable' | 'keycloak_unavailable',
    readonly cause?: unknown
  ) {
    super(reason)
  }
}

type KeycloakUserRepresentation = {
  id: string
  username: string
  attributes?: Record<string, string[]>
  [key: string]: unknown
}

export function isContactsProvisioningConfigured(): boolean {
  const { clientId, clientSecret } = config.auth.keycloak.contacts.provisioning
  return Boolean(clientId && clientSecret)
}

function contactsRealmUrl(path: string): string {
  return `${config.auth.keycloak.url}${path.replace(
    '{realm}',
    config.auth.keycloak.contacts.realm
  )}`
}

/** null when the contacts service has no such contact. */
async function findContact<T>(
  lookup: () => Promise<AdapterResult<T, 'not-found' | 'unknown'>>
): Promise<T | null> {
  let result: AdapterResult<T, 'not-found' | 'unknown'>
  try {
    result = await lookup()
  } catch (error) {
    // Whether the adapter returns or throws a 404 depends on the axios defaults it was created
    // with (leasing-adapter widens them), so both mean no such contact.
    if (isAxiosError(error) && error.response?.status === 404) return null
    throw new ContactCodeError('contacts_unavailable', error)
  }
  if (result.ok) return result.data
  if (result.err === 'not-found') return null
  throw new ContactCodeError('contacts_unavailable')
}

async function keycloak<T>(request: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await request()).data
  } catch (error) {
    throw new ContactCodeError('keycloak_unavailable', error)
  }
}

async function getProvisioningToken(): Promise<string> {
  const { clientId, clientSecret } = config.auth.keycloak.contacts.provisioning
  const tokens = await keycloak(() =>
    axios.post<{ access_token: string }>(
      contactsRealmUrl('/realms/{realm}/protocol/openid-connect/token'),
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      {
        ...keycloakRequestConfig,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    )
  )
  return tokens.access_token
}

/**
 * Makes sure a customer's token names a contact that exists, before webapi gets it.
 *
 * A personnummer can belong to several contacts and the contacts service picks which one a
 * lookup returns, so a contact_code that still resolves is never replaced; only a missing or
 * deleted one is set from the personnummer (the Keycloak username). Without a contact for the
 * personnummer the tokens go back without contact_code, and webapi answers no_active_account.
 *
 * @throws ContactCodeError when the contacts service or Keycloak's admin API fails, so a
 *   failed lookup is never reported as a missing contact.
 */
export async function ensureContactCode(
  tokens: ContactsTokenResponse
): Promise<ContactsTokenResponse> {
  const claims = decodeJwt(tokens.access_token)
  const current =
    typeof claims[CONTACT_CODE_ATTRIBUTE] === 'string'
      ? (claims[CONTACT_CODE_ATTRIBUTE] as string)
      : undefined

  if (
    current &&
    (await findContact(() => contactsAdapter.getByContactCode(current)))
  ) {
    return tokens
  }

  if (!claims.sub || !tokens.refresh_token) return tokens

  if (!isContactsProvisioningConfigured()) {
    logger.warn(
      { sub: claims.sub },
      'contact_code missing or stale, but the mimer-contacts provisioning client is not configured'
    )
    return tokens
  }

  const adminToken = await getProvisioningToken()
  const userUrl = contactsRealmUrl(
    `/admin/realms/{realm}/users/${encodeURIComponent(claims.sub)}`
  )
  const adminConfig = {
    ...keycloakRequestConfig,
    headers: { Authorization: `Bearer ${adminToken}` },
  }

  const user = await keycloak(() =>
    axios.get<KeycloakUserRepresentation>(userUrl, adminConfig)
  )
  const contact = await findContact(() =>
    contactsAdapter.getByNationalId(user.username)
  )
  if (!contact) {
    logger.info({ sub: claims.sub }, 'No contact for mimer-contacts user')
    return tokens
  }

  logger.info(
    {
      sub: claims.sub,
      contactCode: contact.contactCode,
      previous: current ?? null,
    },
    'Setting contact_code on mimer-contacts user'
  )
  // With the declarative user profile, attributes missing from a PUT are removed, so the whole
  // representation goes back with only contact_code changed.
  await keycloak(() =>
    axios.put(
      userUrl,
      {
        ...user,
        attributes: {
          ...user.attributes,
          [CONTACT_CODE_ATTRIBUTE]: [contact.contactCode],
        },
      },
      adminConfig
    )
  )

  // The attribute was just set, so only a refreshed token carries it.
  return keycloak(async () => ({
    data: await refreshContactsAccessToken(tokens.refresh_token as string),
  }))
}
