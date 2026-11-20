import KoaRouter from '@koa/router'
import {
  createExcelExport,
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
  setExcelDownloadHeaders,
} from '@onecore/utilities'

import { BOSOCIALA_COLUMNS } from '../../processes/reports/converters/excelConverter'
import {
  getOpenInvoiceReport,
  toOpenInvoiceExcelRow,
} from '../../processes/reports/open-invoices'
import { registerSchema } from '../../utils/openapi'
import { errorLogFields } from '../../utils/error-log'
import {
  OpenInvoiceReportErrorCode,
  OpenInvoiceReportErrorResponseSchema,
  OpenInvoiceReportRow,
  OpenInvoiceReportRowSchema,
} from './schemas'

registerSchema('OpenInvoiceReportRow', OpenInvoiceReportRowSchema)
registerSchema(
  'OpenInvoiceReportErrorResponse',
  OpenInvoiceReportErrorResponseSchema
)

const ERROR_STATUS: Record<OpenInvoiceReportErrorCode, number> = {
  'cache-warming': 503,
  'upstream-failed': 503,
  unknown: 500,
}

// Seconds to wait before asking again while leasing's lease cache loads.
const RETRY_AFTER_SECONDS = '30'

const ERROR_REASON: Record<OpenInvoiceReportErrorCode, string> = {
  'cache-warming': 'The leases are loading. Try again shortly',
  'upstream-failed':
    'The invoices, their cost centres or the leases could not be read',
  unknown: 'Unexpected response from the economy service',
}

const sendFailure = (
  ctx: {
    status: number
    body: unknown
    set: (field: string, value: string) => void
  },
  err: OpenInvoiceReportErrorCode,
  metadata: object
) => {
  if (err === 'cache-warming') ctx.set('Retry-After', RETRY_AFTER_SECONDS)
  ctx.status = ERROR_STATUS[err]
  ctx.body = { error: err, reason: ERROR_REASON[err], ...metadata }
}

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Reports
 *     description: Reports for staff
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /reports/open-invoices:
   *   get:
   *     summary: List open invoices (restlista)
   *     description: >
   *       Every invoice that is not paid, credited or cancelled and still has
   *       money left to pay, the oldest due date first. Each row has the
   *       lease status from leasing, the cost centre of the rental object and
   *       the tenant's name and address from the contacts service. The name
   *       and address are empty when the contacts service fails, when the
   *       contact has a protected identity or when it has no record of the
   *       contact. Requires the open-invoices:read role.
   *     tags:
   *       - Reports
   *     responses:
   *       '200':
   *         description: The open invoices. None gives an empty list.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/OpenInvoiceReportRow'
   *       '403':
   *         description: The caller lacks the open-invoices:read role.
   *       '500':
   *         description: Unexpected answer from the economy service (error unknown).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OpenInvoiceReportErrorResponse'
   *       '503':
   *         description: >
   *           The invoices, their cost centres or the status of a lease could
   *           not be read (error upstream-failed), or leasing's lease cache is
   *           loading for the first time (error cache-warming, retry after the
   *           Retry-After header).
   *         headers:
   *           Retry-After:
   *             schema:
   *               type: integer
   *             description: Seconds to wait, sent with cache-warming.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OpenInvoiceReportErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/reports/open-invoices', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await getOpenInvoiceReport()
    if (!result.ok) {
      sendFailure(ctx, result.err, metadata)
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody(result.data, metadata)
  })

  /**
   * @swagger
   * /reports/open-invoices/export:
   *   get:
   *     summary: Export open invoices to Excel (restlista)
   *     description: >
   *       The rows of GET /reports/open-invoices in the columns of the unpaid
   *       invoice report (Bosociala): invoice number, invoice date, due date,
   *       amount, debt, days past due, rental object, name, contact code,
   *       address, lease status and cost centre. The name and address follow
   *       the same rules as the list. Requires the open-invoices:read role.
   *     tags:
   *       - Reports
   *     responses:
   *       '200':
   *         description: Excel file download.
   *         content:
   *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
   *             schema:
   *               type: string
   *               format: binary
   *       '403':
   *         description: The caller lacks the open-invoices:read role.
   *       '500':
   *         description: Unexpected answer from the economy service (error unknown), or the file could not be built.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OpenInvoiceReportErrorResponse'
   *       '503':
   *         description: >
   *           The invoices, their cost centres or the status of a lease could
   *           not be read (error upstream-failed), or leasing's lease cache is
   *           loading for the first time (error cache-warming, retry after the
   *           Retry-After header).
   *         headers:
   *           Retry-After:
   *             schema:
   *               type: integer
   *             description: Seconds to wait, sent with cache-warming.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OpenInvoiceReportErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/reports/open-invoices/export', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await getOpenInvoiceReport()
    if (!result.ok) {
      sendFailure(ctx, result.err, metadata)
      return
    }

    try {
      const buffer = await createExcelExport<OpenInvoiceReportRow>({
        sheetName: 'Restlista',
        columns: BOSOCIALA_COLUMNS.map((column) => ({
          ...column,
          width: column.width ?? 20,
        })),
        data: result.data,
        rowMapper: toOpenInvoiceExcelRow,
      })

      setExcelDownloadHeaders(ctx, 'restlista')
      ctx.body = buffer
    } catch (err: unknown) {
      logger.error(
        { ...errorLogFields(err), rows: result.data.length },
        'Error building the open invoice Excel export'
      )
      sendFailure(ctx, 'unknown', metadata)
    }
  })
}
