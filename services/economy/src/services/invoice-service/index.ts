import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { economy, Invoice } from '@onecore/types'

import {
  getAllInvoicesWithMatchIds,
  getInvoiceByInvoiceNumber,
  getInvoiceMatchId,
  getInvoicePaymentEvents,
  getInvoicesByContactCode as getXledgerInvoicesByContactCode,
  submitMiscellaneousInvoice,
} from '../common/adapters/xledger-adapter'
import {
  getInvoiceRows,
  getInvoicesByContactCode as getXpandInvoicesByContactCode,
} from './adapters/xpand-db-adapter'
import { getPropertyCodeAndCostCentreForLease } from '../common/adapters/xpand-db-adapter'
import {
  fetchInvoiceRows,
  fetchPaymentEvents,
  getLeaseDetails,
} from './service'

export const routes = (router: KoaRouter) => {
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

      const regularInvoices: Invoice[] = []
      const losses: Invoice[] = []

      xledgerInvoices.forEach((i) => {
        // A loss is recorded as a transaction on account 1529
        if (i.accountCode === '1529') {
          losses.push(i)
        } else {
          regularInvoices.push(i)
        }
      })

      // An invoice is marked as an expected loss if there is a recorded loss with the same invoice number
      regularInvoices.forEach((i) => {
        const lossForInvoice = losses.find((l) => l.invoiceId === i.invoiceId)
        if (lossForInvoice) {
          i.expectedLoss = true
        }
      })

      // If invoice exists in xpand, use period (fromDate, toDate) from xpand invoice
      // Otherwise use period from xledger invoice
      const invoices = regularInvoices
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

  // TODO: This route doesn't take xpand into account
  // Also doesn't get invoice rows
  router.get('(.*)/invoices/:invoiceNumber', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const result = await getInvoiceByInvoiceNumber(ctx.params.invoiceNumber)
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

  router.get('(.*)/invoices', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const queryParams = economy.GetInvoicesQueryParams.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      return
    }

    const pageSize = queryParams.data?.pageSize ?? 500
    const after = queryParams.data?.after

    try {
      const invoices = await getAllInvoicesWithMatchIds({
        from: queryParams.data?.from,
        to: queryParams.data?.to,
        remainingAmountGreaterThan:
          queryParams.data?.remainingAmountGreaterThan,
        after,
        pageSize,
      })

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(
        {
          content: invoices.content,
          pageInfo: invoices.pageInfo,
        },
        metadata
      )
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })
  /* 
    Gets property information required to create a miscellaneous invoice for a lease.
    We could instead get the required information by making several queries to the leasing- and
    property-services, but since it is only required in one place at the moment 
    (creating miscellaneous invoices from the onecore web application) I decided to keep it
    isolated here.
  */
  router.get('(.*)/invoices/miscellaneous/:rentalId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const result = await getPropertyCodeAndCostCentreForLease(
        ctx.params.rentalId
      )

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result, metadata)
    } catch (error: any) {
      logger.error(error)
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/invoices/miscellaneous', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const success = await submitMiscellaneousInvoice({
        ...JSON.parse(ctx.request.body.invoice),
        attachment: ctx.request.files?.attachment,
      })

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(success, metadata)
    } catch (error: any) {
      logger.error(error)
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/rent-invoice-rows/batch', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const invoiceIds = ctx.request.body.invoiceIds as string[] // TODO schema

    try {
      const invoices = await fetchInvoiceRows(invoiceIds)

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(invoices, metadata)
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/payment-events/batch', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const matchIds = ctx.request.body.matchIds as string[] // TODO schema

    try {
      const paymentEvents = await fetchPaymentEvents(
        matchIds.map((id) => parseInt(id))
      )

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(paymentEvents, metadata)
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/lease-details/batch', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const invoiceIds = ctx.request.body.invoiceIds as string[] // TODO schema

    try {
      const leaseDetails = await getLeaseDetails(invoiceIds)

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(leaseDetails, metadata)
    } catch (error: any) {
      logger.error(error, 'Error getting lease details')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })
}
