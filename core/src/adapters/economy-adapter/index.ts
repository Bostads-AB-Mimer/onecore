import { loggedAxios as axios, logger } from '@onecore/utilities'
import { Invoice, InvoicePaymentEvent } from '@onecore/types'

import config from '../../common/config'
import { AdapterResult } from './../types'
import dayjs from 'dayjs'

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
    return { ok: true, data: response.data.content }
  }

  logger.error(response.data, 'economy-adapter.getInvoiceByInvoiceId')
  return { ok: false, err: 'unknown' }
}

export async function getInvoicePaymentEvents(
  invoiceId: string
): Promise<AdapterResult<InvoicePaymentEvent[], 'unknown' | 'not-found'>> {
  const response = await axios.get(
    `${config.economyService.url}/invoices/${invoiceId}/payment-events`
  )

  if (response.status === 200) {
    return { ok: true, data: response.data.content }
  }
  if (response.status === 404) {
    return { ok: false, err: 'not-found', statusCode: 404 }
  }

  logger.error(response.data, 'economy-adapter.getInvoicePaymentEvents')
  return { ok: false, err: 'unknown', statusCode: 500 }
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
    return { ok: true, data: response.data.content }
  }

  logger.error(response.data, 'economy-adapter.getInvoicesByContactCode')
  return { ok: false, err: 'unknown' }
}

export async function getInvoicesSentToDebtCollection(
  contactCode: string
): Promise<AdapterResult<Invoice[], 'not-found' | 'unknown'>> {
  const invoicesResult = await getInvoicesByContactCode(contactCode, {
    from: dayjs().subtract(6, 'month').toDate(),
  })
  if (!invoicesResult.ok) {
    return { ok: false, err: invoicesResult.err }
  }

  const hasDebtCollection = invoicesResult.data.filter((invoice: Invoice) => {
    return invoice.sentToDebtCollection !== undefined
  })

  return { ok: true, data: hasDebtCollection }
}
