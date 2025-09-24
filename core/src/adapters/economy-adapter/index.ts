import { loggedAxios as axios, logger } from '@onecore/utilities'
import { Invoice } from '@onecore/types'

import config from '../../common/config'
import { AdapterResult } from './../types'

export async function getInvoiceByInvoiceId(
  invoiceId: string
): Promise<AdapterResult<Invoice, 'not-found' | 'unknown'>> {
  const response = await axios.get(
    `${config.economyService.url}/invoices/${invoiceId}`
  )

  if (response.status === 404) {
    return { ok: false, err: 'not-found' }
  }

  if (response.status === 200) {
    return { ok: true, data: response.data }
  }

  logger.error(response.data, 'economy-adapter.getInvoiceByInvoiceId')
  return { ok: false, err: 'unknown' }
}

export async function getInvoicesByContactCode(
  contactCode: string
): Promise<AdapterResult<Invoice[], 'not-found' | 'unknown'>> {
  const response = await axios.get(
    `${config.economyService.url}/invoices/bycontactcode/${contactCode}`
  )

  if (response.status === 404) {
    return { ok: false, err: 'not-found' }
  }

  if (response.status === 200) {
    return { ok: true, data: response.data }
  }

  logger.error(response.data, 'economy-adapter.getInvoicesByContactCode')
  return { ok: false, err: 'unknown' }
}
