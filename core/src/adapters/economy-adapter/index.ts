import { loggedAxios as axios, logger } from '@onecore/utilities'
import { Invoice, InvoicePaymentEvent, RentInvoiceRow } from '@onecore/types'

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
  contactCode: string,
  from?: Date
): Promise<AdapterResult<Invoice[], 'not-found' | 'unknown'>> {
  const invoicesResult = await getInvoicesByContactCode(contactCode, { from })
  if (!invoicesResult.ok) {
    return { ok: false, err: invoicesResult.err }
  }

  const hasDebtCollection = invoicesResult.data.filter((invoice: Invoice) => {
    return invoice.sentToDebtCollection !== undefined
  })

  return { ok: true, data: hasDebtCollection }
}

export async function getInvoices({
  from,
  to,
  remainingAmountGreaterThan,
}: {
  from?: Date
  to?: Date
  remainingAmountGreaterThan?: number
}): Promise<AdapterResult<Invoice[], 'unknown'>> {
  try {
    const pageSize = 500
    let after: string | undefined = undefined
    let allInvoices: Invoice[] = []
    let hasNextPage = true

    while (hasNextPage) {
      const response: any = await axios.get(
        `${config.economyService.url}/invoices`,
        {
          params: { from, to, remainingAmountGreaterThan, after, pageSize },
        }
      )

      if (response.status === 200) {
        const { content, pageInfo } = response.data.content
        allInvoices = allInvoices.concat(content)
        hasNextPage = pageInfo?.hasNextPage
        after = pageInfo?.endCursor
      } else {
        logger.error(response.data, 'economy-adapter.getInvoices')
        return { ok: false, err: 'unknown', statusCode: 500 }
      }
    }

    return { ok: true, data: allInvoices }
  } catch (err: any) {
    logger.error(err, 'economy-adapter.getInvoices')
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

export async function getRentInvoiceRows(
  invoiceIds: string[]
): Promise<AdapterResult<RentInvoiceRow[], 'unknown'>> {
  try {
    const pageSize = 500
    let allRows: RentInvoiceRow[] = []
    for (let i = 0; i < invoiceIds.length; i += pageSize) {
      const batch = invoiceIds.slice(i, i + pageSize)
      const response = await axios.post(
        `${config.economyService.url}/rent-invoice-rows/batch`,
        { invoiceIds: batch }
      )
      if (response.status === 200) {
        allRows = allRows.concat(response.data.content)
      } else {
        logger.error(response.data, 'economy-adapter.getRentInvoiceRows')
        return { ok: false, err: 'unknown', statusCode: 500 }
      }
    }
    return { ok: true, data: allRows }
  } catch (err: any) {
    logger.error(err, 'economy-adapter.getRentInvoiceRows')
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

export async function getPaymentEvents(
  matchIds: number[]
): Promise<AdapterResult<InvoicePaymentEvent[], 'unknown'>> {
  try {
    const pageSize = 500
    let allEvents: InvoicePaymentEvent[] = []
    for (let i = 0; i < matchIds.length; i += pageSize) {
      const batch = matchIds.slice(i, i + pageSize)
      const response = await axios.post(
        `${config.economyService.url}/payment-events/batch`,
        { matchIds: batch }
      )
      if (response.status === 200) {
        allEvents = allEvents.concat(response.data.content)
      } else {
        logger.error(response.data, 'economy-adapter.getPaymentEvents')
        return { ok: false, err: 'unknown', statusCode: 500 }
      }
    }
    return { ok: true, data: allEvents }
  } catch (err: any) {
    logger.error(err, 'economy-adapter.getPaymentEvents')
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

type InvoiceDetails = {
  invoiceId: string
  details: { leaseId: string; costCentre: string }[]
}

export async function getLeaseDetailsForInvoices(
  invoiceIds: string[]
): Promise<AdapterResult<InvoiceDetails[], 'unknown'>> {
  try {
    const pageSize = 500
    let allLeaseDetails: InvoiceDetails[] = []
    for (let i = 0; i < invoiceIds.length; i += pageSize) {
      const batch = invoiceIds.slice(i, i + pageSize)
      const response = await axios.post(
        `${config.economyService.url}/lease-details/batch`,
        { invoiceIds: batch }
      )
      if (response.status === 200) {
        allLeaseDetails = allLeaseDetails.concat(response.data.content)
      } else {
        logger.error(response.data, 'economy-adapter.getLeaseDetailsForInvoice')
        return { ok: false, err: 'unknown', statusCode: 500 }
      }
    }
    return { ok: true, data: allLeaseDetails }
  } catch (err: any) {
    logger.error(err, 'economy-adapter.getLeaseDetailsForInvoice')
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}
