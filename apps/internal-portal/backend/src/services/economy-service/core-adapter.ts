import { Invoice } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { getFromCore } from '../../services/common/adapters/core-adapter'
import { AdapterResult } from '@/services/types'

import config from '../../common/config'

export async function getInvoiceByInvoiceId(
  invoiceId: string
): Promise<AdapterResult<Invoice, 'not-found' | 'unknown'>> {
  const response = await getFromCore<{ content: Invoice }>({
    method: 'get',
    url: `${config.core.url}/invoices/${invoiceId}`,
  })

  if (response.status === 404) {
    return { ok: false, err: 'not-found', statusCode: 404 }
  }

  if (response.status === 200) {
    return { ok: true, data: response.data.content }
  }

  logger.error(response.data, 'economy-adapter.getInvoiceByInvoiceId')
  return { ok: false, err: 'unknown', statusCode: 500 }
}

export async function getInvoicesByContactCode(
  invoiceId: string
): Promise<AdapterResult<Invoice[], 'unknown'>> {
  const response = await getFromCore<{ content: Invoice[] }>({
    method: 'get',
    url: `${config.core.url}/invoices/by-contact-code/${invoiceId}`,
  })

  if (response.status === 200) {
    return { ok: true, data: response.data.content }
  }

  logger.error(response.data, 'economy-adapter.getInvoicesByContactCode')
  return { ok: false, err: 'unknown', statusCode: 500 }
}
