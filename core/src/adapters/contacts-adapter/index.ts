import { logger, loggedAxios, PaginatedResponse } from '@onecore/utilities'
import { CreateContactErrorCodeSchema } from '@onecore/contacts/schema'
import type {
  Contact,
  CreateContactErrorCode,
  CreateContactErrorResponseBody,
  CreateContactRequestBody,
  CreateContactResponseBody,
  GetContactResponseBody,
  GetContactsResponseBody,
  SyncContactsResponseBody,
} from '@onecore/contacts/schema'

import { AdapterResult } from '@/adapters/types'
import { AxiosResponse } from 'axios'
import config from '../../common/config'

/**
 * Failures the contacts service can report when creating a contact, plus the
 * catch-all for a response we do not recognise at all.
 */
export type CreateContactError =
  | CreateContactErrorCode
  | 'invalid-request'
  | 'contacts-service-error'

/**
 * Derived from the schema rather than listed here: a code added by the service
 * must not silently fall through to the catch-all, which would drop the
 * `detail` text the new code was created to carry.
 */
const KNOWN_CREATE_ERRORS: ReadonlySet<string> = new Set<CreateContactErrorCode>(
  CreateContactErrorCodeSchema.options
)

export const makeContactsAdapter = (contactsServiceUrl: string) => {
  const axios = loggedAxios.create({
    baseURL: contactsServiceUrl,
    validateStatus: () => true,
  })

  const listResponse = (
    response: AxiosResponse<GetContactsResponseBody, any>
  ): AdapterResult<Contact[], 'unknown'> => {
    if (response.status === 200) {
      return { ok: true, data: response.data.content.contacts }
    }

    return { ok: false, err: 'unknown', statusCode: response.status }
  }

  const singleResponse = (
    response: AxiosResponse<GetContactResponseBody, any>
  ): AdapterResult<Contact, 'not-found' | 'unknown'> => {
    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    if (response.status === 404) {
      return { ok: false, err: 'not-found', statusCode: 404 }
    }

    return { ok: false, err: 'unknown', statusCode: response.status }
  }

  return {
    async listContacts(
      q: string[],
      type?: 'individual' | 'organisation',
      page?: number,
      limit?: number
    ): Promise<AdapterResult<PaginatedResponse<Contact>, 'unknown'>> {
      const response = await axios<PaginatedResponse<Contact>>(`/contacts`, {
        params: { type, q, page, limit },
      })

      if (response.status === 200) {
        return { ok: true, data: response.data }
      }

      return { ok: false, err: 'unknown', statusCode: response.status }
    },

    async getByContactCodes(
      codes: string[]
    ): Promise<AdapterResult<Contact[], 'unknown'>> {
      const response = await axios<GetContactsResponseBody>(
        `/contacts/by-codes`,
        { params: { codes: codes.join(',') } }
      )
      return listResponse(response)
    },

    async getByContactCode(
      contactCode: string
    ): Promise<AdapterResult<Contact, 'not-found' | 'unknown'>> {
      const response = await axios<GetContactResponseBody>(
        `/contacts/${contactCode}`
      )
      return singleResponse(response)
    },

    async getByContactCodeBatch(
      contactCodes: string[],
      options?: {
        includePhone?: boolean
        includeEmail?: boolean
        includeAddress?: boolean
        includeRelations?: boolean
      }
    ): Promise<AdapterResult<Contact[], 'unknown'>> {
      if (contactCodes.length === 0) return { ok: true, data: [] }

      const { includePhone, includeEmail, includeAddress, includeRelations } =
        options ?? {}

      const response = await axios<GetContactsResponseBody>(`/contacts/batch`, {
        params: {
          code: contactCodes,
          includePhone,
          includeEmail,
          includeAddress,
          includeRelations,
        },
        // Required: contacts microservice uses Koa's default Node querystring
        // parser (no koa-qs), which doesn't unpack `?code[]=A` into an array.
        paramsSerializer: { indexes: null },
      })
      return listResponse(response)
    },

    async getByTrusteeOfContactCode(
      contactCode: string
    ): Promise<AdapterResult<Contact, 'not-found' | 'unknown'>> {
      const response = await axios<GetContactResponseBody>(
        `/contacts/${contactCode}/trustee`
      )
      return singleResponse(response)
    },

    async getByNationalId(
      nid: string
    ): Promise<AdapterResult<Contact, 'not-found' | 'unknown'>> {
      const response = await axios<GetContactResponseBody>(
        `/contacts/by-nid/${nid}`
      )
      return singleResponse(response)
    },

    async listByPhoneNumber(
      phoneNumber: string
    ): Promise<AdapterResult<Contact[], 'unknown'>> {
      const response = await axios<GetContactsResponseBody>(
        `/contacts/by-phone-number/${phoneNumber}`
      )
      return listResponse(response)
    },

    async listByEmailAddress(
      emailAddress: string
    ): Promise<AdapterResult<Contact[], 'unknown'>> {
      const response = await axios<GetContactsResponseBody>(
        `/contacts/by-email-address/${emailAddress}`
      )
      return listResponse(response)
    },

    async getUpdatedContacts(
      since: Date | null
    ): Promise<
      AdapterResult<{ contact: Contact; timestamp: Date }[], 'unknown'>
    > {
      const params = since ? { since: since.toISOString() } : {}
      const response = await axios<SyncContactsResponseBody>(`/contacts/sync`, {
        params,
      })

      if (response.status === 200) {
        const data = response.data.content.contacts.map(
          (c: { contact: Contact; timestamp: string }) => ({
            contact: c.contact,
            timestamp: new Date(c.timestamp),
          })
        )
        return { ok: true, data }
      }

      return { ok: false, err: 'unknown', statusCode: response.status }
    },

    /**
     * Creates a contact.
     *
     * NOT REVERSIBLE — a 201 means the contact exists in Xpand permanently.
     * Callers must never retry a request that may have succeeded.
     *
     * The service's own error code is passed through rather than re-derived
     * from the status, so callers can distinguish cases that share a status
     * (a rejected request and an invalid identity number are both 422, but a
     * caseworker needs to be told different things).
     */
    async createContact(
      body: CreateContactRequestBody
    ): Promise<
      AdapterResult<CreateContactResponseBody['content'], CreateContactError>
    > {
      try {
        const response = await axios.post<
          CreateContactResponseBody & CreateContactErrorResponseBody
        >('/contacts', body)

        if (response.status === 201) {
          return { ok: true, data: response.data.content }
        }

        if (response.status === 400) {
          return {
            ok: false,
            err: 'invalid-request',
            statusCode: 400,
          }
        }

        const reported = response.data?.error
        if (reported && KNOWN_CREATE_ERRORS.has(reported)) {
          return {
            ok: false,
            err: reported,
            statusCode: response.status,
            detail: response.data?.detail,
          }
        }

        return {
          ok: false,
          err: 'contacts-service-error',
          statusCode: response.status,
        }
      } catch (err) {
        logger.error({ err }, 'contactsAdapter.createContact')
        return { ok: false, err: 'contacts-service-error' }
      }
    },
  }
}

/**
 * Singleton contacts adapter wired to the configured contacts service URL.
 * Use this anywhere in core that needs to call the contacts microservice
 * without re-instantiating the adapter. Mirrors the leasingAdapter pattern.
 */
export const contactsAdapter = makeContactsAdapter(config.contactsService.url)
