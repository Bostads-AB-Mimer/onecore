import axios, { isAxiosError } from 'axios'
import Personnummer from 'personnummer'

import config from '../../common/config'
import {
  contactsKeycloakAdminUrl,
  contactsKeycloakRequestConfig,
  contactsOAuthPostConfig,
  tokenEndpointUrl,
} from './keycloak-contacts'

export const CONTACT_CODE_ATTRIBUTE = 'contact_code'

/** Marks a login that belongs to a private individual, as opposed to a company. */
const ACCOUNT_TYPE_ATTRIBUTE = 'account_type'

/** Keycloak's required action that makes the user choose a password. */
const UPDATE_PASSWORD_ACTION = 'UPDATE_PASSWORD'

export type MimerContactsUser = {
  id: string
  username: string
  attributes?: Record<string, string[]>
  [key: string]: unknown
}

const PERSONNUMMER_OPTIONS = {
  allowCoordinationNumber: true,
  allowInterimNumber: false,
}

/**
 * The mimer-contacts username for a personnummer (or samordningsnummer): twelve digits, the
 * form Xpand stores for nearly all private individuals. null when the input is not a valid one.
 *
 * The one place this rule lives: registration writes usernames with it, and the contact_code
 * repair at login reads them back with it, so the two cannot drift apart.
 */
export function toContactsUsername(nationalId: string): string | null {
  if (!Personnummer.valid(nationalId, PERSONNUMMER_OPTIONS)) return null
  return Personnummer.parse(nationalId, PERSONNUMMER_OPTIONS).format(true)
}

export function isContactsProvisioningConfigured(): boolean {
  const { clientId, clientSecret } = config.auth.keycloak.contacts.provisioning
  return Boolean(clientId && clientSecret)
}

/**
 * An access token for the mimer-contacts provisioning client (client_credentials).
 *
 * Throws the axios error unchanged; callers decide what a failure means for them.
 */
export async function getProvisioningToken(): Promise<string> {
  const { clientId, clientSecret } = config.auth.keycloak.contacts.provisioning
  const res = await axios.post<{ access_token: string }>(
    tokenEndpointUrl(),
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
    contactsOAuthPostConfig
  )
  return res.data.access_token
}

/**
 * The HTTP status and axios code of a failed Keycloak call, for logging.
 *
 * Never log the error itself: its request config holds the username (a personnummer) and the
 * e-mail address.
 */
export function describeKeycloakFailure(error: unknown): {
  status?: number
  code?: string
} {
  if (isAxiosError(error)) {
    return { status: error.response?.status, code: error.code }
  }
  return { code: error instanceof Error ? error.name : 'unknown' }
}

/**
 * Admin calls against the mimer-contacts realm, all made with one provisioning token.
 *
 * Every method throws on failure, with the axios error unchanged.
 */
export type ContactsKeycloakAdmin = {
  getUser(id: string): Promise<MimerContactsUser>
  /** null when no user has exactly this username. */
  findUserByUsername(username: string): Promise<MimerContactsUser | null>
  /**
   * Creates an enabled person login with an unverified e-mail and no password.
   *
   * 'conflict' when Keycloak refuses with 409: a user with this username, or with this e-mail
   * when the realm does not allow duplicate e-mail addresses, already exists.
   */
  createPersonUser(user: {
    username: string
    email: string
    contactCode: string
  }): Promise<{ id: string } | 'conflict'>
  /**
   * Sets contact_code, replacing any it had, and leaves everything else on the user as it was.
   *
   * @param user the full representation, as getUser or findUserByUsername returns it
   */
  setContactCode(user: MimerContactsUser, contactCode: string): Promise<void>
  /** E-mails the user a link to choose a password, which ends on Mina sidor. */
  sendSetPasswordEmail(userId: string): Promise<void>
}

export async function connectContactsKeycloakAdmin(): Promise<ContactsKeycloakAdmin> {
  const token = await getProvisioningToken()
  const usersUrl = `${contactsKeycloakAdminUrl()}/users`
  const requestConfig = {
    ...contactsKeycloakRequestConfig,
    headers: { Authorization: `Bearer ${token}` },
  }

  const userUrl = (id: string) => `${usersUrl}/${encodeURIComponent(id)}`

  return {
    async getUser(id) {
      const res = await axios.get<MimerContactsUser>(userUrl(id), requestConfig)
      return res.data
    },

    async findUserByUsername(username) {
      const res = await axios.get<MimerContactsUser[]>(usersUrl, {
        ...requestConfig,
        // exact=true, or Keycloak matches the username as a substring.
        params: { username, exact: true, briefRepresentation: false },
      })
      const users = Array.isArray(res.data) ? res.data : []
      return users.find((user) => user.username === username) ?? null
    },

    async createPersonUser({ username, email, contactCode }) {
      try {
        const res = await axios.post(
          usersUrl,
          {
            username,
            email,
            emailVerified: false,
            enabled: true,
            attributes: {
              [CONTACT_CODE_ATTRIBUTE]: [contactCode],
              [ACCOUNT_TYPE_ATTRIBUTE]: ['person'],
            },
          },
          requestConfig
        )
        // Keycloak answers 201 with an empty body; the new id is the last segment of Location.
        const location = res.headers.location
        const id =
          typeof location === 'string'
            ? location.split('/').filter(Boolean).pop()
            : undefined
        if (!id) {
          throw new Error('Keycloak created a user without a Location header')
        }
        return { id }
      } catch (error: unknown) {
        if (isAxiosError(error) && error.response?.status === 409) {
          return 'conflict'
        }
        throw error
      }
    },

    async setContactCode(user, contactCode) {
      // With the declarative user profile, attributes missing from a PUT are removed, so the
      // whole representation goes back with only contact_code changed.
      await axios.put(
        userUrl(user.id),
        {
          ...user,
          attributes: {
            ...user.attributes,
            [CONTACT_CODE_ATTRIBUTE]: [contactCode],
          },
        },
        requestConfig
      )
    },

    async sendSetPasswordEmail(userId) {
      await axios.put(
        `${userUrl(userId)}/execute-actions-email`,
        [UPDATE_PASSWORD_ACTION],
        {
          ...requestConfig,
          params: {
            // The link ends on this client's redirect_uri, which Keycloak only accepts when it
            // is one of the client's valid redirect URIs.
            client_id: config.auth.keycloak.contacts.clientId,
            redirect_uri: config.auth.keycloak.contacts.setPasswordRedirectUri,
          },
        }
      )
    },
  }
}
