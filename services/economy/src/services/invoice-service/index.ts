import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { economy } from '@onecore/types'

import {
  getInvoiceMatchId,
  getInvoicePaymentEvents,
  getInvoicesByContactCode as getXledgerInvoicesByContactCode,
} from './adapters/xledger-adapter'
import {
  getInvoiceRows,
  getInvoicesByContactCode as getXpandInvoicesByContactCode,
} from './adapters/xpand-db-adapter'
import { getInvoiceDetails } from './service'
import { getInvoicesNotExported } from '@src/common/adapters/tenfast/tenfast-adapter'
import {
  createAggregateAccounting,
  exportRentalInvoicesAccounting,
} from './servicev2'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/invoices/import', async (ctx) => {
    try {
      const invoices = await exportRentalInvoicesAccounting('001')
      const exportInvoiceRows = await createAggregateAccounting(invoices)

      ctx.status = 200
      ctx.body = exportInvoiceRows
    } catch (error) {
      ctx.status = 500
      ctx.body = 'Could not export invoices ' + (error as any).message
    }
  })

  router.get('(.*)/invoices/bycontactcode/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const queryParams = economy.GetInvoicesByContactCodeQueryParams.safeParse(
      ctx.query
    )

    if (!queryParams.success) {
      ctx.status = 400
      return
    }

    const from = queryParams.data?.from
    const contactCode = ctx.params.contactCode
    try {
      const xledgerInvoices =
        (await getXledgerInvoicesByContactCode(contactCode, { from: from })) ??
        []
      const xpandInvoices =
        (await getXpandInvoicesByContactCode(contactCode, { from: from })) ?? []

      const xledgerInvoiceIds = xledgerInvoices.map(
        (invoice) => invoice.invoiceId
      )

      // If invoice exists in xpand, use period (fromDate, toDate) from xpand invoice
      // Otherwise use period from xledger invoice
      const invoices = xledgerInvoices
        .map((invoice) => {
          const xpandInvoice = xpandInvoices.find(
            (v) => v.invoiceId === invoice.invoiceId
          )

          if (xpandInvoice?.fromDate && xpandInvoice.toDate) {
            return {
              ...invoice,
              fromDate: xpandInvoice.fromDate,
              toDate: xpandInvoice.toDate,
            }
          } else {
            return invoice
          }
        })
        .concat(
          xpandInvoices.filter(
            (invoice) => !xledgerInvoiceIds.includes(invoice.invoiceId)
          )
        )

      const invoiceRows = await getInvoiceRows(
        new Date().getFullYear(),
        '001', // Mimer company id.
        invoices.map((v) => v.invoiceId)
      )

      const invoicesWithRows = invoices.map((invoice) => {
        const rows = invoiceRows.filter(
          (row) => row.invoiceNumber === invoice.invoiceId
        )

        return { ...invoice, invoiceRows: rows }
      })

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(invoicesWithRows, metadata)
    } catch (error: any) {
      logger.error(
        { error, contactCode: contactCode },
        'Error getting invoices for contact code'
      )
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.get('(.*)/invoices/:invoiceNumber', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const result = await getInvoiceDetails(ctx.params.invoiceNumber)
      if (!result) {
        ctx.status = 404
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result, metadata)
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.get('(.*)/invoices/:invoiceNumber/payment-events', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const matchId = await getInvoiceMatchId(ctx.params.invoiceNumber)
      if (!matchId) {
        ctx.status = 404
        return
      }

      const events = await getInvoicePaymentEvents(matchId)

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(events, metadata)
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })
}
