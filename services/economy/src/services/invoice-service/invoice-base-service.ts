import { logger } from '@onecore/utilities'
import { InvoiceBase } from '@onecore/types'
import * as invoiceBaseDbAdapter from './adapters/invoice-base-db-adapter'
import * as xledgerAdapter from '../common/adapters/xledger-adapter'

export const getInvoiceBases = async ({
  from,
  to,
  skip,
  pageSize,
}: invoiceBaseDbAdapter.BaseInvoiceQueryOptions) => {
  const invoiceBases = await invoiceBaseDbAdapter.getInvoiceBases({
    from,
    to,
    skip,
    pageSize,
  })
  const invoiceBaseItems = await invoiceBaseDbAdapter.getInvoiceBaseItems(
    invoiceBases.map((b) => b.id)
  )
  const xledgerInvoiceBaseItems = await xledgerAdapter.getInvoiceBaseItems(
    invoiceBaseItems.map((i) => i.XledgerDbId)
  )

  return invoiceBases.reduce<InvoiceBase[]>((acc, b) => {
    const items = xledgerInvoiceBaseItems.filter(
      (xi) => xi.externalIdentifier === b.externalIdentifier
    )

    if (items.length > 0) {
      acc.push({
        ...b,
        ourReference: items[0].ourReference,
        attachment: items[0].attachment,
        headerInfo: items[0].headerInfo,
        invoiceDate: items[0].invoiceDate,
        totalAmount: items.reduce((acc, xi) => acc + xi.amount, 0),
        items: items.map((xi) => ({
          xledgerDbId: xi.xledgerDbId,
          text: xi.text,
          amount: xi.amount,
          unitPrice: xi.unitPrice,
          quantity: xi.quantity,
        })),
      })
    } else {
      logger.error(
        `No invoice base items found for invoice base ${b.externalIdentifier}`
      )
    }

    return acc
  }, [])
}

export const createInvoiceBase = async (
  invoiceBasePayload: invoiceBaseDbAdapter.InvoiceBasePayload
) => {
  return invoiceBaseDbAdapter.createInvoiceBase(invoiceBasePayload)
}
