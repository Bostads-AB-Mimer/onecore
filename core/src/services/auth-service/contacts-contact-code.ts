import axios, { isAxiosError } from 'axios'
import { decodeJwt } from 'jose'
import Personnummer from 'personnummer'
import { logger } from '@onecore/utilities'

import config from '../../common/config'
import { contactsAdapter } from '../../adapters/contacts-adapter'
import type { AdapterResult } from '../../adapters/types'
import { httpStatusForContactsKeycloakError } from './contacts-keycloak-errors'
import {
  type ContactsTokenResponse,
  contactsKeycloakAdminUrl,
  contactsKeycloakRequestConfig,
  contactsOAuthPostConfig,
  refreshContactsAccessToken,
  tokenEndpointUrl,
} from './keycloak-contacts'

const CONTACT_CODE_ATTRIBUTE = 'contact_code'

/**
 * Upper bound on the whole step. webapi gives up on /auth/contacts/token after 15 s, and the
 * code exchange before this and the logout after a failure have to fit in that as well; a
 * response webapi never receives leaves a live session nobody can end.
 */
export const CONTACT_CODE_BUDGET_MS = 8000

export type ContactCodeErrorReason =
  | 'contacts_unavailable'
  | 'keycloak_unavailable'
  /** Keycloak rejected the refresh that should carry the new contact_code (invalid_grant). */
  | 'session_ended'
  /** A repair was needed but the mimer-contacts provisioning client is not configured. */
  | 'provisioning_not_configured'
  | 'timeout'

export class ContactCodeError extends Error {
  constructor(
    readonly reason: ContactCodeErrorReason,
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

/**
 * The contact_code claim as a single value. A user attribute mapper set to multivalued puts a
 * one-element array in the token; without accepting that, every login would look like a missing
 * code and overwrite a working one.
 */
function readContactCodeClaim(value: unknown): string | undefined {
  if (typeof value === 'string' && value) return value
  if (
    Array.isArray(value) &&
    value.length === 1 &&
    typeof value[0] === 'string' &&
    value[0]
  ) {
    return value[0]
  }
  return undefined
}

/**
 * The Keycloak username as a twelve-digit personnummer, or null when it is not one.
 *
 * Only a valid personnummer (or samordningsnummer) is ever looked up, so a username that is
 * something else costs no call to the contacts service. Twelve digits is the form Xpand stores
 * for nearly all private individuals.
 */
function personnummerFromUsername(username: string): string | null {
  const options = { allowCoordinationNumber: true, allowInterimNumber: false }
  if (!Personnummer.valid(username, options)) return null
  return Personnummer.parse(username, options).format(true)
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
  throw new ContactCodeError(
    'contacts_unavailable',
    new Error(
      `Contacts service answered ${result.statusCode ?? 'without a status'}`
    )
  )
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
      tokenEndpointUrl(),
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      contactsOAuthPostConfig
    )
  )
  return tokens.access_token
}

/** The attribute was just set, so only a refreshed token carries it. */
async function refreshWithContactCode(
  refreshToken: string
): Promise<ContactsTokenResponse> {
  try {
    return await refreshContactsAccessToken(refreshToken)
  } catch (error) {
    // The session ended between the exchange and here; webapi sends the user back to log in.
    if (httpStatusForContactsKeycloakError(error) === 400) {
      throw new ContactCodeError('session_ended', error)
    }
    throw new ContactCodeError('keycloak_unavailable', error)
  }
}

async function setContactCode(
  tokens: ContactsTokenResponse
): Promise<ContactsTokenResponse> {
  const claims = decodeJwt(tokens.access_token)
  const current = readContactCodeClaim(claims[CONTACT_CODE_ATTRIBUTE])

  if (
    current &&
    (await findContact(() => contactsAdapter.getByContactCode(current)))
  ) {
    return tokens
  }

  // A repair is needed from here on, so a setup fault must not pass for "no contact".
  if (!claims.sub || !tokens.refresh_token) {
    throw new ContactCodeError(
      'keycloak_unavailable',
      new Error('Token from the code exchange has no sub or refresh_token')
    )
  }
  if (!isContactsProvisioningConfigured()) {
    throw new ContactCodeError('provisioning_not_configured')
  }

  const adminToken = await getProvisioningToken()
  const userUrl = `${contactsKeycloakAdminUrl()}/users/${encodeURIComponent(claims.sub)}`
  const adminConfig = {
    ...contactsKeycloakRequestConfig,
    headers: { Authorization: `Bearer ${adminToken}` },
  }

  const user = await keycloak(() =>
    axios.get<KeycloakUserRepresentation>(userUrl, adminConfig)
  )
  const personnummer = personnummerFromUsername(user.username)
  if (!personnummer) {
    logger.warn(
      { sub: claims.sub },
      'mimer-contacts username is not a personnummer, so it has no contact'
    )
    return tokens
  }
  const contact = await findContact(() =>
    contactsAdapter.getLoginContactByNationalId(personnummer)
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

  return refreshWithContactCode(tokens.refresh_token)
}

/**
 * Makes sure a customer's token names a contact that exists, before webapi gets it.
 *
 * A contact_code that still resolves is never replaced. A missing one is set from the
 * personnummer (the Keycloak username) with the contacts service's login-contact rule: a
 * personnummer can belong to several contacts (a second registration, a supplier contact for
 * payouts, a sole trader's company), and that rule picks the one the person uses. Without a
 * contact for the personnummer the tokens go back without contact_code, and webapi answers
 * no_active_account.
 *
 * @throws ContactCodeError when the contacts service or Keycloak fails, the provisioning client
 *   is not configured, or the step runs past budgetMs, so none of these is ever reported as a
 *   missing contact.
 */
export async function ensureContactCode(
  tokens: ContactsTokenResponse,
  budgetMs: number = CONTACT_CODE_BUDGET_MS
): Promise<ContactsTokenResponse> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new ContactCodeError(
            'timeout',
            new Error(`Setting contact_code took longer than ${budgetMs} ms`)
          )
        ),
      budgetMs
    )
  })
  // The work is not cancelled on timeout. Whatever it still writes is the right contact_code,
  // and the next login picks it up.
  return Promise.race([setContactCode(tokens), timeout]).finally(() =>
    clearTimeout(timer)
  )
}
