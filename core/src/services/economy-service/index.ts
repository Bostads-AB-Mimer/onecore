import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { economy } from '@onecore/types'

import * as economyAdapter from '../../adapters/economy-adapter'
import { parseRequestBody } from '../../middlewares/parse-request-body'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Economy service
 *     description: Operations related to economy
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * security:
 *   - bearerAuth: []
 */
export const routes = (router: KoaRouter) => {
  router.get('/invoices/:invoiceId/payment-events', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getInvoicePaymentEvents(
      ctx.params.invoiceId
    )

    if (!result.ok) {
      ctx.status = result.statusCode ?? 500
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    }
  })

  router.get('/invoices/:contactCode/credit-check', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getInvoicesSentToDebtCollection(
      ctx.params.contactCode
    )

    if (!result.ok) {
      ctx.status = result.err === 'not-found' ? 404 : 500
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    }
  })

  router.get('/invoices/:invoiceId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getInvoiceByInvoiceId(
      ctx.params.invoiceId
    )

    if (!result.ok) {
      ctx.status = result.err === 'not-found' ? 404 : 500
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    }
  })

  router.get('/invoices/by-contact-code/:contactCode', async (ctx) => {
    const queryParams = economy.GetInvoicesByContactCodeQueryParams.safeParse(
      ctx.query
    )

    if (!queryParams.success) {
      ctx.status = 400
      return
    }

    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getInvoicesByContactCode(
      ctx.params.contactCode,
      queryParams.data
    )

    if (!result.ok) {
      ctx.status = result.err === 'not-found' ? 404 : 500
      ctx.body = {
        error: result.err === 'not-found' ? 'Not found' : 'Unknown error',
      }
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(
        { data: result.data, totalCount: result.data.length },
        metadata
      )
    }
  })

  router.post('/invoices/miscellaneous', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.submitMiscellaneousInvoice(
      JSON.parse(ctx.request.body.invoice),
      ctx.request.files?.attachment
    )

    if (!result.ok) {
      ctx.status = 500
      ctx.body = {
        error: 'Unknown error',
      }
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ data: result.data }, metadata)
    }
  })

  router.get('/invoices/miscellaneous/:rentalId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getMiscellaneousInvoiceDataForLease(
      ctx.params.rentalId
    )

    if (!result.ok) {
      ctx.status = 500
      ctx.body = {
        error: 'Unknown error',
      }
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ data: result.data }, metadata)
    }
  })
  router.get('/invoices', async (ctx) => {
    const queryParams = economy.GetInvoicesQueryParams.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      return
    }

    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getInvoices({
      from: queryParams.data?.from,
      to: queryParams.data?.to,
      remainingAmountGreaterThan: queryParams.data?.remainingAmountGreaterThan,
    })

    if (!result.ok) {
      ctx.status = 500
      ctx.body = {
        error: 'Unknown error',
      }
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(
        { data: result.data, totalCount: result.data.length },
        metadata
      )
      ctx.body = makeSuccessResponseBody({ data: result.data }, metadata)
    }
  })

  router.get('/xledger-contacts', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getContacts()

    if (!result.ok) {
      ctx.status = 500
      ctx.body = {
        error: 'Unknown error',
      }
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    }
  })

  router.get('/xledger-projects', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getProjects()

    if (!result.ok) {
      ctx.status = 500
      ctx.body = {
        error: 'Unknown error',
      }
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    }
  })

  /**
   * @swagger
   * /imd/process:
   *   post:
   *     tags:
   *       - Economy service
   *     summary: Process IMD CSV data
   *     description: Accepts raw IMD CSV data, enriches it with lease information from Xpand, and returns Tenfast-ready CSV output along with a CSV of unprocessed rows.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - csv
   *             properties:
   *               csv:
   *                 type: string
   *                 description: Raw semicolon-delimited IMD CSV content
   *     responses:
   *       '200':
   *         description: Successfully processed IMD data.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - content
   *               properties:
   *                 content:
   *                   type: object
   *                   required:
   *                     - totalRows
   *                     - numEnriched
   *                     - numUnprocessed
   *                     - enrichedCsv
   *                     - unprocessedCsv
   *                   properties:
   *                     totalRows:
   *                       type: integer
   *                     numEnriched:
   *                       type: integer
   *                     numUnprocessed:
   *                       type: integer
   *                     enrichedCsv:
   *                       type: string
   *                     unprocessedCsv:
   *                       type: string
   *       '400':
   *         description: Missing or invalid csv field.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *       '500':
   *         description: Internal server error.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   */
  router.post(
    '/imd/process',
    parseRequestBody(economy.ProcessIMDRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { csv } = ctx.request.body

      const result = await economyAdapter.processIMD(csv)

      if (!result.ok) {
        ctx.status = result.statusCode ?? 500
        ctx.body = { error: 'Processing failed' }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    }
  )
}
