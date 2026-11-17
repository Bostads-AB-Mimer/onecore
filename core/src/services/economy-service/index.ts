import KoaRouter from '@koa/router'
import {
  errorMessage,
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import {
  economy,
  RouteErrorResponse,
  SubmitMiscellaneousInvoiceErrorCodes,
} from '@onecore/types'
import * as communicationAdapter from '../../adapters/communication-adapter'
import * as economyAdapter from '../../adapters/economy-adapter'
import { parseRequestBody } from '../../middlewares/parse-request-body'
import config from '../../common/config'
import { filenameFromContentDisposition } from '../../utils/content-disposition'
import {
  SendInvoiceEmailFailure,
  sendMiscellaneousInvoiceEmail,
  sendRentNoticeEmail,
  toNotifyBatchError,
  toSendInvoiceEmailError,
} from './send-invoice-email'

const invoicesErrorStatus: Record<
  economyAdapter.GetInvoicesByContactCodeError,
  number
> = {
  'not-found': 404,
  unavailable: 503,
  unknown: 500,
}

const invoicesErrorText: Record<
  economyAdapter.GetInvoicesByContactCodeError,
  string
> = {
  'not-found': 'Not found',
  unavailable: 'Service unavailable',
  unknown: 'Unknown error',
}

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
      ctx.status = invoicesErrorStatus[result.err]
      ctx.body = {
        error: invoicesErrorText[result.err],
        reason: result.err,
      }
      return
    } else {
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(result.data, metadata)
    }
  })

  /**
   * @swagger
   * /invoices/{ocr}/pdf:
   *   get:
   *     tags:
   *       - Economy service
   *     summary: Download the rent notice PDF for an invoice
   *     parameters:
   *       - in: path
   *         name: ocr
   *         required: true
   *         schema:
   *           type: string
   *         description: The OCR number of the rent notice
   *     responses:
   *       '200':
   *         description: The rent notice PDF
   *         content:
   *           application/pdf:
   *             schema:
   *               type: string
   *               format: binary
   *       '404':
   *         description: There is no rent notice with this OCR number
   *       '500':
   *         description: The PDF could not be fetched
   *     security:
   *       - bearerAuth: []
   */
  router.get('/invoices/:ocr/pdf', async (ctx) => {
    const result = await economyAdapter.getInvoicePdf(ctx.params.ocr)

    if (!result.ok) {
      ctx.status = result.err === 'not-found' ? 404 : 500
      return
    }

    ctx.status = 200
    // attachment() quotes and encodes the filename. The upstream header is
    // passed on unquoted, which browsers reject when the name has a comma.
    ctx.attachment(
      filenameFromContentDisposition(result.data.contentDisposition) ??
        'invoice.pdf'
    )
    ctx.set('Content-Type', 'application/pdf')
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
      ctx.status = invoicesErrorStatus[result.err]
      ctx.body = {
        error: invoicesErrorText[result.err],
        reason: result.err,
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

  router.post('/miscellaneous-invoices', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.submitMiscellaneousInvoice(
      JSON.parse(ctx.request.body.invoice),
      ctx.request.files?.attachment
    )

    if (!result.ok) {
      if (
        result.err ===
        SubmitMiscellaneousInvoiceErrorCodes.XledgerCustomerNotFound
      ) {
        ctx.status = 404
        ctx.body = {
          type: result.err,
          title: 'Customer not found in Xledger',
          status: 404,
          detail:
            'The contact does not exist as a customer (subledger) in Xledger.',
          ...metadata,
        } satisfies RouteErrorResponse
        return
      }

      ctx.status = 500
      ctx.body = {
        type: result.err,
        title: 'Error creating miscellaneous invoice',
        status: 500,
        ...metadata,
      } satisfies RouteErrorResponse
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
   *     description: Grant an invoice deferral by setting a new due date and reason. Requires the invoice-deferral role.
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
   *                 description: Reason for the deferral
   *     responses:
   *       '200':
   *         description: Deferral registered successfully
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
   *       '422':
   *         description: Invoice not eligible for deferral
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [code]
   *               properties:
   *                 code:
   *                   type: string
   *                   enum: [invoice-not-eligible]
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
   *         description: Deferral could not be completed
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

      const deferralResult = await economyAdapter.deferInvoice({
        invoiceId,
        endDate,
        madeByEmail,
        reason,
      })

      if (!deferralResult.ok) {
        if (
          deferralResult.err === 'invoice-not-found' ||
          deferralResult.err === 'invoice-not-eligible'
        ) {
          ctx.status = deferralResult.statusCode ?? 400
          ctx.body = { code: deferralResult.err }
          return
        }

        if (
          deferralResult.err === 'tenfast-failed' ||
          deferralResult.err === 'xledger-failed'
        ) {
          const failedSystem =
            deferralResult.err === 'tenfast-failed' ? 'Tenfast' : 'Xledger'

          try {
            await communicationAdapter.sendEmail({
              to: config.emailAddresses.economy,
              subject: `Fel: anstånd kunde inte registreras i ${failedSystem}`,
              body: [
                `Anstånd på faktura ${invoiceId} misslyckades i: ${failedSystem}.`,
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
            logger.error(
              emailErr,
              'Failed to send deferral failure notification'
            )
          }

          ctx.status = 500
          ctx.body = { code: deferralResult.err }
          return
        }

        ctx.status = 500
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ ok: true }, metadata)
    }
  )

  router.get('/miscellaneous-invoices', async (ctx) => {
    const queryParams = economy.GetMiscellaneousInvoicesQueryParams.safeParse(
      ctx.query
    )

    if (!queryParams.success) {
      ctx.status = 400
      return
    }

    const metadata = generateRouteMetadata(ctx)
    const result = await economyAdapter.getMiscellaneousInvoices({
      from: queryParams.data?.from,
      to: queryParams.data?.to,
      after: queryParams.data?.after,
      pageSize: queryParams.data?.pageSize,
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
        { content: result.data.content, pageInfo: result.data.pageInfo },
        metadata
      )
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
   * /invoices/{invoiceId}/send:
   *   post:
   *     tags:
   *       - Economy service
   *     summary: Email an invoice to the customer
   *     description: |
   *       Emails the invoice with its PDF attached. A rent notice goes to the
   *       first tenant on its lease with the rent notice PDF. A miscellaneous
   *       invoice goes to the customer it is billed to with the PDF from the
   *       ledger. Outside production the email goes to the test inbox.
   *     parameters:
   *       - in: path
   *         name: invoiceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The invoice number (the OCR number for a rent notice)
   *     responses:
   *       '200':
   *         description: The email was sent
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   type: object
   *                   required: [sent]
   *                   properties:
   *                     sent:
   *                       type: boolean
   *       '404':
   *         description: The invoice or its PDF was not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SendInvoiceEmailError'
   *       '422':
   *         description: The invoice has no recipient, the recipient has no email address, or the invoice has no due date
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SendInvoiceEmailError'
   *       '500':
   *         description: The email could not be sent
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SendInvoiceEmailError'
   *     security:
   *       - bearerAuth: []
   * components:
   *   schemas:
   *     SendInvoiceEmailError:
   *       type: object
   *       required: [reason]
   *       properties:
   *         reason:
   *           type: string
   *           enum:
   *             - invoice-not-found
   *             - pdf-not-found
   *             - no-recipient
   *             - no-email
   *             - missing-due-date
   *             - send-failed
   *             - unknown
   */
  router.post('/invoices/:invoiceId/send', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { invoiceId } = ctx.params

    const fail = (failure: SendInvoiceEmailFailure) => {
      const { status, reason } = toSendInvoiceEmailError(failure)
      // Adapters log their own failures; a 404/422 is not a server failure.
      if (status < 500) {
        logger.warn({ invoiceId, failure }, 'economy-service.sendInvoice')
      }
      ctx.status = status
      ctx.body = { reason, ...metadata }
    }

    try {
      const invoiceResult =
        await economyAdapter.getInvoiceByInvoiceId(invoiceId)
      if (!invoiceResult.ok) {
        return fail(
          invoiceResult.err === 'not-found'
            ? 'invoice-not-found'
            : 'invoice-unknown'
        )
      }

      const invoice = invoiceResult.data
      const result =
        invoice.type === 'Other'
          ? await sendMiscellaneousInvoiceEmail(invoice)
          : await sendRentNoticeEmail(invoiceId)

      if (!result.ok) return fail(result.err)

      ctx.status = 200
      ctx.body = makeSuccessResponseBody({ sent: true }, metadata)
    } catch (err: unknown) {
      logger.error(
        { invoiceId, error: errorMessage(err) },
        'economy-service.sendInvoice'
      )
      ctx.status = 500
      ctx.body = { reason: 'unknown', ...metadata }
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
   *                         required: [ocr, error]
   *                         properties:
   *                           ocr:
   *                             type: string
   *                           error:
   *                             type: string
   *                             description: not-found, unknown, pdf-not-found, pdf-unknown, no-lease-id, lease-not-found, no-contact-code, no-email or missing-expiration-date
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
        const result = await sendRentNoticeEmail(ocr)
        if (result.ok) return { ocr, sent: true }
        return { ocr, sent: false, error: toNotifyBatchError(result.err) }
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
   *     summary: Look up invoice channels for recipients
   *     description: Returns the invoice delivery channels for each provided recipient.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - recipients
   *             properties:
   *               recipients:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required:
   *                     - recipientId
   *                     - recipientType
   *                   properties:
   *                     recipientId:
   *                       type: string
   *                     recipientType:
   *                       type: string
   *                       enum:
   *                         - individual
   *                         - organization
   *                 description: List of recipients to look up
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
   *                   type: object
   *                   required:
   *                     - candidates
   *                   properties:
   *                     candidates:
   *                       type: array
   *                       items:
   *                         type: object
   *                         required:
   *                           - referenceId
   *                           - availableInChannels
   *                           - notAvailableInChannels
   *                         properties:
   *                           referenceId:
   *                             type: string
   *                           availableInChannels:
   *                             type: array
   *                             items:
   *                               type: string
   *                           notAvailableInChannels:
   *                             type: array
   *                             items:
   *                               type: string
   *                     channelErrors:
   *                       type: array
   *                       items:
   *                         type: object
   *                         required:
   *                           - channel
   *                           - error
   *                         properties:
   *                           channel:
   *                             type: string
   *                           error:
   *                             type: string
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
      const { recipients } = ctx.request.body

      const response = await economyAdapter.getInvoiceChannels(recipients)

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
