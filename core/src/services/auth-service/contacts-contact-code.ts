import { isAxiosError } from 'axios'
import { decodeJwt } from 'jose'
import { logger } from '@onecore/utilities'

import { contactsAdapter } from '../../adapters/contacts-adapter'
import type { AdapterResult } from '../../adapters/types'
import { httpStatusForContactsKeycloakError } from './contacts-keycloak-errors'
import {
  CONTACT_CODE_ATTRIBUTE,
  connectContactsKeycloakAdmin,
  isContactsProvisioningConfigured,
  toContactsUsername,
} from './contacts-keycloak-provisioning'
import {
  type ContactsTokenResponse,
  refreshContactsAccessToken,
} from './keycloak-contacts'

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

async function keycloak<T>(request: Promise<T>): Promise<T> {
  try {
    return await request
  } catch (error) {
    throw new ContactCodeError('keycloak_unavailable', error)
  }
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

  // A contact deleted in Xpand, e.g. merged into the person's other contact by customer
  // service, counts as gone, so the rule below moves the login to a live one.
  if (
    current &&
    (await findContact(() =>
      contactsAdapter.getByContactCode(current, { excludeDeleted: true })
    ))
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

  const admin = await keycloak(connectContactsKeycloakAdmin())
  const user = await keycloak(admin.getUser(claims.sub))
  // The username is the personnummer. Only a valid one is ever looked up: the contacts
  // service's by-nid lookup matches anything for an input without digits.
  const personnummer = toContactsUsername(user.username)
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
  await keycloak(admin.setContactCode(user, contact.contactCode))

  return refreshWithContactCode(tokens.refresh_token)
}

/**
 * Makes sure a customer's token names a contact that exists, before webapi gets it.
 *
 * A contact_code that names a live contact is never replaced. One that is missing, or names a
 * contact that no longer exists or is marked as deleted, is set from the personnummer (the
 * Keycloak username) with the contacts service's login-contact rule: a personnummer can belong
 * to several contacts (a second registration, a supplier contact for payouts, a sole trader's
 * company), and that rule picks the one the person uses. Without a contact for the personnummer
 * the tokens go back without contact_code, and webapi answers no_active_account.
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
