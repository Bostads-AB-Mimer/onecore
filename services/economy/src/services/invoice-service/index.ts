import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { economy } from '@onecore/types'

import {
  getAllInvoicesWithMatchIds,
  getInvoiceMatchId,
  getInvoicePaymentEvents,
  submitMiscellaneousInvoice,
  updateInvoiceDeferralDate,
} from '../common/adapters/xledger-adapter'
import { getPropertyCodeAndCostCentreForLease } from '../common/adapters/xpand-db-adapter'
import {
  getInvoicesByContactCode,
  fetchInvoiceRows,
  fetchPaymentEvents,
  getLeaseDetails,
  stralforsPostChannelLookup,
  getAutogiroConsent,
} from './service'
import { getInvoiceDetails } from './service'
import {
  getInvoiceByOcr,
  getInvoicePdf,
  setGracePeriod,
} from '../../common/adapters/tenfast/tenfast-adapter'

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
      const invoices = await getInvoicesByContactCode(contactCode, { from })

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(invoices, metadata)
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

  router.get('(.*)/invoices/:ocr/pdf', async (ctx) => {
    const result = await getInvoicePdf(ctx.params.ocr)

    if (!result.ok) {
      ctx.status = result.err === 'not-found' ? 404 : 500
      return
    }

    ctx.status = 200
    ctx.set('Content-Type', 'application/pdf')
    ctx.set(
      'Content-Disposition',
      (
        result.data.contentDisposition || 'attachment; filename="invoice.pdf"'
      ).replace(/[\r\n]/g, '')
    )
    ctx.body = result.data.data
  })

  router.get('(.*)/invoices/by-ocr/:ocr', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await getInvoiceByOcr(ctx.params.ocr)

    if (!result.ok) {
      ctx.status = result.err.includes('not found') ? 404 : 500
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(result.data, metadata)
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

  router.put('(.*)/invoices/:invoiceNumber/xledger-deferral', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = economy.XledgerDeferralRequestSchema.safeParse(
      ctx.request.body
    )

    if (!body.success) {
      ctx.status = 400
      ctx.body = { message: body.error.issues[0]?.message ?? 'Invalid request' }
      return
    }

    try {
      await updateInvoiceDeferralDate(
        ctx.params.invoiceNumber,
        new Date(body.data.endDate)
      )
      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ ok: true }, metadata)
    } catch (error: any) {
      logger.error(
        { error, invoiceNumber: ctx.params.invoiceNumber },
        'Error updating invoice deferral date in Xledger'
      )
      ctx.status = 500
      ctx.body = { message: error.message }
    }
  })

  router.put(
    '(.*)/invoices/:invoiceNumber/tenfast-grace-period',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const body = economy.TenfastGracePeriodRequestSchema.safeParse(
        ctx.request.body
      )

      if (!body.success) {
        ctx.status = 400
        ctx.body = {
          message: body.error.issues[0]?.message ?? 'Invalid request',
        }
        return
      }

      const result = await setGracePeriod({
        invoiceOcr: ctx.params.invoiceNumber,
        endDate: body.data.endDate,
        madeByEmail: body.data.madeByEmail,
        reason: body.data.reason,
      })

      if (!result.ok) {
        ctx.status = result.err === 'not-found' ? 404 : 500
        ctx.body = {
          message:
            result.err === 'not-found'
              ? 'Invoice not found in Tenfast'
              : 'Failed to set grace period in Tenfast',
        }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ ok: true }, metadata)
    }
  )

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

  router.post('(.*)/invoice-channels', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { nationalRegistrationNumbers } = ctx.request.body

    try {
      const results = await stralforsPostChannelLookup(
        nationalRegistrationNumbers
      )

      ctx.status = 200
      ctx.body = {
        ...metadata,
        content: results,
      }
    } catch (error: any) {
      logger.error(error, 'Invoice channels lookup error')
      ctx.status = 500
      ctx.body = { ...metadata, message: error.message }
    }
  })

  router.get(
    '(.*)/autogiro-consent/:nationalRegistrationNumber',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { nationalRegistrationNumber } = ctx.params

      try {
        const results = await getAutogiroConsent(nationalRegistrationNumber)

        if (results === null) {
          ctx.status = 404
          ctx.body = { ...metadata, message: 'No autogiro consent found' }
          return
        }

        ctx.status = 200
        ctx.body = {
          ...metadata,
          content: results,
        }
      } catch (error: any) {
        logger.error(error, 'Error getting autogiro consent')
        ctx.status = 500
        ctx.body = { ...metadata, message: error.message }
      }
    }
  )
}
