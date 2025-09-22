import { Contact, Invoice } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { AdapterResult } from '@/services/types'

import { getFromCore } from '../common/adapters/core-adapter'
import config from '../../common/config'

type GetContactResponse = Contact & {
  invoices: Invoice[]
}

export async function getContact(
  contactCode: string
): Promise<AdapterResult<GetContactResponse, 'not-found' | 'unknown'>> {
  const getContact = await getFromCore<{ content: Contact }>({
    method: 'get',
    url: `${config.core.url}/contacts/${contactCode}`,
  })

  if (getContact.status === 404) {
    return { ok: false, err: 'not-found', statusCode: 404 }
  }

  if (getContact.status !== 200) {
    logger.error(getContact.data, 'tenant-adapter.getContact')
    return { ok: false, err: 'unknown', statusCode: 500 }
  }

  const getInvoices = await getFromCore<{ content: Invoice[] }>({
    method: 'get',
    url: `${config.core.url}/invoices/by-contact-code/${contactCode}`,
  })

  console.log('helloooo', getInvoices.status)
  if (getInvoices.status === 404) {
    return { ok: false, err: 'not-found', statusCode: 404 }
  }

  if (getInvoices.status !== 200) {
    // logger.error(getInvoices.data, 'tenant-adapter.getInvoices')
    return { ok: false, err: 'unknown', statusCode: 500 }
  }

  return {
    ok: true,
    data: { ...getContact.data.content, invoices: getInvoices.data.content },
  }
}
