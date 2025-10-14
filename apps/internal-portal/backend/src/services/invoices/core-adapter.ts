import { AxiosError } from 'axios'
import { logger } from '@onecore/utilities'
import { InvoicePaymentEvent } from '@onecore/types'

import { AdapterResult } from '@/services/types'

import Config from '../../common/config'
import { getFromCore } from '../common/adapters/core-adapter'

const coreBaseUrl = Config.core.url

export async function getInvoicePaymentEvents(
  invoiceId: string
): Promise<AdapterResult<Array<InvoicePaymentEvent>, 'unknown'>> {
  try {
    const url = `${coreBaseUrl}/invoices/${invoiceId}/payment-events`
    const response = await getFromCore<{
      content: Array<InvoicePaymentEvent>
    }>({
      method: 'get',
      url: url,
    })

    return { ok: true, data: response.data.content }
  } catch (err) {
    logger.error(
      { err: err instanceof AxiosError ? err.message : err },
      'Failed to fetch invoice payment events'
    )

    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}
