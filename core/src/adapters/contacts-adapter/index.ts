import { loggedAxios } from '@onecore/utilities'
import type {
  Contact,
  GetContactResponseBody,
  GetContactsResponseBody,
} from '@onecore/contacts/schema'

import { AdapterResult } from '@/adapters/types'
import { AxiosResponse } from 'axios'

export const makeContactsAdapter = (contactsServiceUrl: string) => {
  const axios = loggedAxios.create({
    baseURL: contactsServiceUrl,
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
  ): AdapterResult<Contact, 'unknown'> => {
    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    return { ok: false, err: 'unknown', statusCode: response.status }
  }

  return {
    async listContacts(
      q: string[],
      type?: 'individual' | 'organisation',
      page?: number,
      pageSize?: number
    ): Promise<AdapterResult<Contact[], 'unknown'>> {
      const response = await axios<GetContactsResponseBody>(`/contacts`, {
        params: { type, q, page, pageSize },
      })

      return listResponse(response)
    },

    async getByContactCode(
      contactCode: string
    ): Promise<AdapterResult<Contact, 'unknown'>> {
      const response = await axios<GetContactResponseBody>(
        `/contacts/${contactCode}`
      )
      return singleResponse(response)
    },

    async getByTrusteeOfContactCode(
      contactCode: string
    ): Promise<AdapterResult<Contact, 'unknown'>> {
      const response = await axios<GetContactResponseBody>(
        `/contacts/${contactCode}/trustee`
      )
      return singleResponse(response)
    },

    async getByNationalId(
      nid: string
    ): Promise<AdapterResult<Contact, 'unknown'>> {
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
  }
}
