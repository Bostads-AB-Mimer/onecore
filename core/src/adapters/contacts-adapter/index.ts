import { loggedAxios, PaginatedResponse } from '@onecore/utilities'
import type {
  Contact,
  GetContactResponseBody,
  GetContactsResponseBody,
  SyncContactsResponseBody,
} from '@onecore/contacts/schema'

import { AdapterResult } from '@/adapters/types'
import { AxiosResponse } from 'axios'

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

    async getByContactCode(
      contactCode: string
    ): Promise<AdapterResult<Contact, 'not-found' | 'unknown'>> {
      const response = await axios<GetContactResponseBody>(
        `/contacts/${contactCode}`
      )
      return singleResponse(response)
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
  }
}
