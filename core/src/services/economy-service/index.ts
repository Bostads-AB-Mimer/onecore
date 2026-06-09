import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import { economy } from '@onecore/types'
import * as communicationAdapter from '../../adapters/communication-adapter'
import * as economyAdapter from '../../adapters/economy-adapter'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import { parseRequestBody } from '../../middlewares/parse-request-body'
import config from '../../common/config'

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

  router.get('/invoices/:ocr/pdf', async (ctx) => {
    const result = await economyAdapter.getInvoicePdf(ctx.params.ocr)

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

  /**
   * @swagger
   * /invoices/{invoiceId}/deferral:
   *   put:
   *     tags:
   *       - Economy service
   *     summary: Set a grace period (anstånd) on an invoice
   *     description: Registers the grace period in Tenfast first, then updates the due date in Xledger via updateArTransactions. If either call fails a notification email is sent to the economy team.
   *     parameters:
   *       - in: path
   *         name: invoiceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The invoice OCR number
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - endDate
   *               - reason
   *             properties:
   *               endDate:
   *                 type: string
   *                 format: date
   *                 description: New due date (YYYY-MM-DD)
   *               reason:
   *                 type: string
   *                 description: Reason for the deferral (required by Tenfast)
   *     responses:
   *       '200':
   *         description: Deferral set successfully in both Xledger and Tenfast
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     ok:
   *                       type: boolean
   *       '400':
   *         description: Invalid request body
   *       '404':
   *         description: Invoice not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [code]
   *               properties:
   *                 code:
   *                   type: string
   *                   enum: [invoice-not-found]
   *       '500':
   *         description: One or both system calls failed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [code]
   *               properties:
   *                 code:
   *                   type: string
   *                   enum: [xledger-failed, tenfast-failed]
   *     security:
   *       - bearerAuth: []
   */
  router.put(
    '/invoices/:invoiceId/deferral',
    parseRequestBody(economy.DeferralRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { endDate, reason } = ctx.request.body
      const invoiceId = ctx.params.invoiceId
      const madeByEmail = ctx.state.user?.email

      if (!madeByEmail) {
        ctx.status = 401
        ctx.body = { code: 'unauthorized' }
        return
      }

      const tenfastResult = await economyAdapter.setTenfastGracePeriod({
        invoiceId,
        endDate,
        madeByEmail,
        reason,
      })

      if (!tenfastResult.ok) {
        if (tenfastResult.err === 'not-found') {
          ctx.status = 404
          ctx.body = { code: 'invoice-not-found' }
          return
        }

        try {
          await communicationAdapter.sendEmail({
            to: config.emailAddresses.economy,
            subject: 'Fel: anstånd kunde inte registreras i Tenfast',
            body: [
              `Anstånd på faktura ${invoiceId} misslyckades i: Tenfast.`,
              '',
              `Nytt förfallodatum: ${endDate}`,
              `Begärt av: ${madeByEmail}`,
              reason ? `Anledning: ${reason}` : '',
              '',
              'Åtgärd krävs: registrera anståndet manuellt.',
            ]
              .filter(Boolean)
              .join('\n'),
          })
        } catch (emailErr) {
          logger.error(emailErr, 'Failed to send deferral failure notification')
        }

        ctx.status = 500
        ctx.body = { code: 'tenfast-failed' }
        return
      }

      const xledgerResult = await economyAdapter.updateXledgerDeferralDate(
        invoiceId,
        endDate
      )

      if (!xledgerResult.ok) {
        try {
          await communicationAdapter.sendEmail({
            to: config.emailAddresses.economy,
            subject: 'Fel: anstånd kunde inte registreras i Xledger',
            body: [
              `Anstånd på faktura ${invoiceId} misslyckades i: Xledger.`,
              '',
              `Nytt förfallodatum: ${endDate}`,
              `Begärt av: ${madeByEmail}`,
              reason ? `Anledning: ${reason}` : '',
              '',
              'Åtgärd krävs: registrera anståndet manuellt.',
            ]
              .filter(Boolean)
              .join('\n'),
          })
        } catch (emailErr) {
          logger.error(emailErr, 'Failed to send deferral failure notification')
        }

        ctx.status = 500
        ctx.body = { code: 'xledger-failed' }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ ok: true }, metadata)
    }
  )

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
   * /invoices/notify-batch:
   *   post:
   *     tags:
   *       - Economy service
   *     summary: Send invoice notification emails for a selection of invoices
   *     description: For each OCR number, fetches invoice data and PDF from economy, contact info from leasing, then sends a notification email with the invoice PDF attached.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - ocrs
   *             properties:
   *               ocrs:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: List of invoice OCR numbers
   *                 maxItems: 1000
   *     responses:
   *       '200':
   *         description: Notifications processed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     sent:
   *                       type: array
   *                       items:
   *                         type: string
   *                     failed:
   *                       type: array
   *                       items:
   *                         type: object
   *                     totalSent:
   *                       type: number
   *                     totalFailed:
   *                       type: number
   *       '400':
   *         description: Invalid request
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('/invoices/notify-batch', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = ctx.request.body as { ocrs?: unknown }

    if (
      !Array.isArray(body?.ocrs) ||
      body.ocrs.length === 0 ||
      !body.ocrs.every((id) => typeof id === 'string')
    ) {
      ctx.status = 400
      ctx.body = {
        error: 'ocrs must be a non-empty array of strings',
        ...metadata,
      }
      return
    }

    if (body.ocrs.length > 1000) {
      ctx.status = 400
      ctx.body = {
        error: 'ocrs must not exceed 1000 items',
        ...metadata,
      }
      return
    }

    const ocrs = body.ocrs as string[]

    const processOcr = async (
      ocr: string
    ): Promise<{ ocr: string; sent: boolean; error?: string }> => {
      try {
        const [invoiceResult, pdfResult] = await Promise.all([
          economyAdapter.getInvoiceByOcr(ocr),
          economyAdapter.getInvoicePdf(ocr),
        ])

        if (!invoiceResult.ok)
          return { ocr, sent: false, error: invoiceResult.err }
        if (!pdfResult.ok)
          return { ocr, sent: false, error: `pdf-${pdfResult.err}` }

        const invoice = invoiceResult.data
        const leaseId = invoice.leaseIds[0]
        if (!leaseId) return { ocr, sent: false, error: 'no-lease-id' }

        const lease = await leasingAdapter.getLease(leaseId)
        if (!lease) return { ocr, sent: false, error: 'lease-not-found' }

        const contactCode = lease.tenantContactIds?.[0]
        if (!contactCode) return { ocr, sent: false, error: 'no-contact-code' }

        const contactResult =
          await leasingAdapter.getContactByContactCode(contactCode)
        if (!contactResult.ok)
          return { ocr, sent: false, error: contactResult.err }

        const contact = contactResult.data
        if (!contact.emailAddress)
          return { ocr, sent: false, error: 'no-email' }

        if (!invoice.expirationDate)
          return { ocr, sent: false, error: 'missing-expiration-date' }
        const dueDate = new Date(invoice.expirationDate)
          .toISOString()
          .split('T')[0]

        const emailTo =
          process.env.NODE_ENV !== 'production'
            ? config.emailAddresses.tenantDefault
            : contact.emailAddress

        const result = await communicationAdapter.sendInvoiceNotificationEmail({
          to: emailTo,
          firstName: contact.firstName,
          address: lease.rentalObject?.address ?? '',
          invoiceNumber: invoice.invoiceId,
          dueDate,
          totalAmount: String(invoice.amount),
          attachments: [
            {
              filename: `faktura-${ocr}.pdf`,
              content: pdfResult.data.data.toString('base64'),
              contentType: 'application/pdf',
            },
          ],
        })

        if (result.ok) return { ocr, sent: true }
        return { ocr, sent: false, error: result.err }
      } catch (err) {
        logger.error(
          { ocr, err },
          'economy-service.notifyBatch: unexpected error'
        )
        return { ocr, sent: false, error: 'unknown' }
      }
    }

    const results = await Promise.all(ocrs.map(processOcr))
    const sent = results.filter((r) => r.sent).map((r) => r.ocr)
    const failed = results
      .filter((r) => !r.sent)
      .map((r) => ({ ocr: r.ocr, error: r.error ?? 'unknown' }))

    logger.info(
      { totalSent: sent.length, totalFailed: failed.length },
      'Invoice notifications processed'
    )

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(
      { sent, failed, totalSent: sent.length, totalFailed: failed.length },
      metadata
    )
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
   *         description: Invalid request body or invalid CSV content.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                 reason:
   *                   type: string
   *                   enum:
   *                     - invalid-csv
   *                   description: Present when the request body is valid but the CSV content is invalid.
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
        ctx.body =
          result.err === 'invalid-csv'
            ? { error: 'Invalid CSV format', reason: 'invalid-csv' }
            : { error: 'Processing failed' }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    }
  )

  /**
   * @swagger
   * /invoice-channels:
   *   post:
   *     tags:
   *       - Economy service
   *     summary: Look up invoice channels for national registration numbers
   *     description: Returns the invoice delivery channel for each provided national registration number.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - nationalRegistrationNumbers
   *             properties:
   *               nationalRegistrationNumbers:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: List of national registration numbers to look up
   *     responses:
   *       '200':
   *         description: Successfully retrieved invoice channels.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - content
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                     required:
   *                       - channel
   *                       - matchedCandidates
   *                       - error
   *                     properties:
   *                       channel:
   *                         type: string
   *                         enum:
   *                           - Kivra
   *                           - eInvoiceB2C
   *                       matchedCandidates:
   *                         type: array
   *                         items:
   *                           type: string
   *                         nullable: true
   *                       error:
   *                         type: string
   *                         nullable: true
   *       '400':
   *         description: Invalid request body.
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
    '/invoice-channels',
    parseRequestBody(economy.ChannelLookupRequestBodySchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { nationalRegistrationNumbers } = ctx.request.body

      const response = await economyAdapter.getInvoiceChannels(
        nationalRegistrationNumbers
      )

      if (response.ok) {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(response.data, metadata)
      } else {
        ctx.status = 500
        ctx.body = {
          error: response.err,
        }
      }
    }
  )

  /**
   * @swagger
   * /autogiro-consent/{nationalRegistrationNumber}:
   *   get:
   *     tags:
   *       - Economy service
   *     summary: Get autogiro consent for tenant
   *     description: Returns autogiro consent by national registration number.
   *     parameters:
   *       - in: path
   *         name: nationalRegistrationNumber
   *         required: true
   *         schema:
   *           type: string
   *         description: The tenant's national registration number
   *     responses:
   *       '200':
   *         description: Successfully retrieved autogiro consent.
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
   *                     - _id
   *                     - hyresgast
   *                     - hyresvardBankgiro
   *                     - payerNumber
   *                     - fixedDueDay
   *                     - isCompany
   *                     - payerSSN
   *                     - status
   *                     - statusChangedAt
   *                     - extra
   *                     - payerBankAccountNumber
   *                   properties:
   *                     _id:
   *                       type: string
   *                     hyresgast:
   *                       type: string
   *                     hyresvardBankgiro:
   *                       type: string
   *                     payerNumber:
   *                       type: integer
   *                     fixedDueDay:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                     isCompany:
   *                       type: boolean
   *                     payerSSN:
   *                       type: string
   *                     status:
   *                       type: string
   *                       enum:
   *                         - ACTIVE
   *                         - MANUAL
   *                     statusChangedAt:
   *                       type: string
   *                       format: date-time
   *                     extra:
   *                       type: object
   *                       required:
   *                         - nameAndAddress1
   *                         - mismatch
   *                       properties:
   *                         nameAndAddress1:
   *                           type: string
   *                         mismatch:
   *                           type: string
   *                           nullable: true
   *                     payerBankAccountNumber:
   *                       type: string
   *       '404':
   *         description: No autogiro consent found for the given national registration number.
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
  router.get('/autogiro-consent/:nationalRegistrationNumber', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { nationalRegistrationNumber } = ctx.params

    const response = await economyAdapter.getAutogiroConsent(
      nationalRegistrationNumber
    )

    if (response.ok) {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(response.data, metadata)
      return
    }

    if (response.err === 'not-found') {
      ctx.status = 404
      ctx.body = { error: 'Not found' }
    } else {
      ctx.status = 500
      ctx.body = {
        error: 'Unknown error',
      }
    }
  })
}
