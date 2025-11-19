import { loggedAxios as axios } from '@onecore/utilities'

import config from '../../common/config'
import { AdapterResult } from '../types'
import z from 'zod'
import { ContactSchema } from '@/api/v1/contacts/schema'
const contactsServiceUrl = config.contactsService.url

type Contact = z.infer<typeof ContactSchema>

export const listContacts = async (
  q: string[],
  page?: number,
  pageSize?: number
): Promise<AdapterResult<Contact[], 'unknown'>> => {
  const response = await axios(`${contactsServiceUrl}/contacts`, {
    params: { q, page, pageSize },
  })

  if (response.status === 200) {
    return { ok: true, data: response.data.content }
  }

  return { ok: false, err: 'unknown', statusCode: response.status }
}
