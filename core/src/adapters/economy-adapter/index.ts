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
  contactCode: string,
  filters?: { from?: Date }
): Promise<AdapterResult<Invoice[], 'not-found' | 'unknown'>> {
  const url = `${config.economyService.url}/invoices/bycontactcode/${contactCode}`
  const params = filters ? { params: filters } : {}
  const response = await axios.get(url, params)

  if (response.status === 404) {
    return { ok: false, err: 'not-found' }
  }

  if (response.status === 200) {
    return { ok: true, data: response.data }
  }

  logger.error(response.data, 'economy-adapter.getInvoicesByContactCode')
  return { ok: false, err: 'unknown' }
}

export async function getUnpaidInvoices(
  offset?: number,
  size?: number
): Promise<AdapterResult<Invoice[], 'unknown'>> {
  try {
    const params = new URLSearchParams()
    if (offset !== undefined) {
      params.append('offset', offset.toString())
    }
    if (size !== undefined) {
      params.append('size', size.toString())
    }

    const url = `${config.economyService.url}/invoices/unpaid?${params.toString()}`
    const response = await axios.get(url)

    if (response.status === 200) {
      return { ok: true, data: response.data }
    }

    logger.error(response.data, 'economy-adapter.getUnpaidInvoices')
    return { ok: false, err: 'unknown' }
  } catch (error) {
    logger.error(error, 'economy-adapter.getUnpaidInvoices')
    return { ok: false, err: 'unknown' }
  }
}
