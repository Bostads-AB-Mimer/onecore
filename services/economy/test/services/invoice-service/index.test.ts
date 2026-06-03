import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import * as xledgerAdapter from '@src/services/common/adapters/xledger-adapter'
import * as tenfastAdapter from '@src/common/adapters/tenfast/tenfast-adapter'
import { routes } from '@src/services/invoice-service'

import * as factory from '@test/factories'
import { schemas } from '@onecore/types'

const app = new Koa()
const router = new KoaRouter()

app.use(bodyParser())
routes(router)
app.use(router.routes())

describe('Invoice Service', () => {
  describe('GET /invoices/bycontactcode/:contactCode', () => {
    it('responds with 400 if invalid query params', async () => {
      const res = await request(app.callback()).get(
        `/invoices/bycontactcode/P123456?from=invalid`
      )

      expect(res.status).toBe(400)
    })

    it('responds with invoices', async () => {
      jest
        .spyOn(xledgerAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([
          factory.invoice.build({ invoiceId: '123' }),
          factory.invoice.build({ invoiceId: '456' }),
          factory.invoice.build({ invoiceId: '789' }),
        ])

      jest
        .spyOn(tenfastAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([
          factory.invoice.build({ invoiceId: '123' }),
          factory.invoice.build({ invoiceId: '456' }),
          factory.invoice.build({ invoiceId: '789' }),
        ])

      const res = await request(app.callback()).get(
        `/invoices/bycontactcode/P123456`
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(3)
      expect(() =>
        schemas.v1.InvoiceSchema.array().parse(res.body.content)
      ).not.toThrow()
    })

    it('maps and includes invoices rows to corresponding invoices', async () => {
      const [invoice_1, invoice_2] = [
        factory.invoice.build({ invoiceId: 'foo' }),
        factory.invoice.build({ invoiceId: 'bar' }),
      ]

      jest
        .spyOn(xledgerAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([invoice_1])

      jest
        .spyOn(tenfastAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([invoice_2])

      const res = await request(app.callback()).get(
        `/invoices/bycontactcode/P123456`
      )

      expect(res.status).toBe(200)

      const invoice_1_response = res.body.content.find(
        (invoice: any) => invoice.invoiceId === invoice_1.invoiceId
      )

      const invoice_2_response = res.body.content.find(
        (invoice: any) => invoice.invoiceId === invoice_2.invoiceId
      )

      expect(invoice_1_response.invoiceRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ invoiceNumber: invoice_1.invoiceId }),
        ])
      )

      expect(invoice_2_response.invoiceRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ invoiceNumber: invoice_2.invoiceId }),
        ])
      )

      expect(() =>
        schemas.v1.InvoiceSchema.array().parse(res.body.content)
      ).not.toThrow()
    })

    it('uses fromDate and toDate from Xpand if available', async () => {
      const invoiceId = 'foo'
      const tenfastInvoice = factory.invoice.build({
        invoiceId,
        fromDate: new Date('2023-03-01T00:00:00.000Z'),
        toDate: new Date('2023-03-31T00:00:00.000Z'),
      })

      const xledgerInvoice = factory.invoice.build({
        invoiceId,
        fromDate: new Date('2025-02-01T00:00:00.000Z'),
        toDate: new Date('2025-02-28T00:00:00.000Z'),
      })

      jest
        .spyOn(xledgerAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([xledgerInvoice])

      jest
        .spyOn(tenfastAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([tenfastInvoice])

      const res = await request(app.callback()).get(
        `/invoices/bycontactcode/P123456`
      )

      expect(res.body.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fromDate: tenfastInvoice.fromDate.toISOString(),
            toDate: tenfastInvoice.toDate.toISOString(),
          }),
        ])
      )
    })

    it('uses fromDate and toDate from Xledger if xpand not available', async () => {
      const invoiceId = 'foo'
      const xledgerInvoice = factory.invoice.build({
        invoiceId,
        fromDate: new Date('2025-02-01T00:00:00.000Z'),
        toDate: new Date('2025-02-28T00:00:00.000Z'),
      })

      jest
        .spyOn(tenfastAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([])

      jest
        .spyOn(xledgerAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([xledgerInvoice])

      const res = await request(app.callback()).get(
        `/invoices/bycontactcode/P123456`
      )

      expect(res.body.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fromDate: xledgerInvoice.fromDate.toISOString(),
            toDate: xledgerInvoice.toDate.toISOString(),
          }),
        ])
      )
    })
  })

  describe('GET /invoices/:invoiceNumber', () => {
    it('responds with 404 if invoice not found', async () => {
      jest
        .spyOn(xledgerAdapter, 'getInvoiceByInvoiceNumber')
        .mockResolvedValueOnce(null)

      const res = await request(app.callback()).get(`/invoices/12345`)

      expect(res.status).toBe(404)
    })

    it('responds with invoice', async () => {
      jest
        .spyOn(xledgerAdapter, 'getInvoiceByInvoiceNumber')
        .mockResolvedValueOnce(factory.invoice.build())
      jest
        .spyOn(tenfastAdapter, 'getInvoiceByOcr')
        .mockResolvedValueOnce({ ok: true, data: factory.invoice.build() })

      const res = await request(app.callback()).get(`/invoices/12345`)

      expect(res.status).toBe(200)
      expect(() =>
        schemas.v1.InvoiceSchema.parse(res.body.content)
      ).not.toThrow()
    })
  })

  describe('GET /invoices/:invoiceNumber/payment-events', () => {
    it('responds with 404 if matchId not found', async () => {
      jest
        .spyOn(xledgerAdapter, 'getInvoiceMatchId')
        .mockResolvedValueOnce(null)

      const res = await request(app.callback()).get(
        `/invoices/12345/payment-events`
      )

      expect(res.status).toBe(404)
    })

    it('responds with payment events', async () => {
      const invoicePaymentEvents = factory.invoicePaymentEvent.buildList(2)
      jest
        .spyOn(xledgerAdapter, 'getInvoiceMatchId')
        .mockResolvedValueOnce('match-123')
      jest
        .spyOn(xledgerAdapter, 'getInvoicePaymentEvents')
        .mockResolvedValueOnce(invoicePaymentEvents)

      const res = await request(app.callback()).get(
        `/invoices/12345/payment-events`
      )

      expect(res.status).toBe(200)
      expect(() =>
        schemas.v1.InvoicePaymentEventSchema.array().parse(res.body.content)
      ).not.toThrow()
    })
  })

  describe('GET /invoices/:invoiceId/pdf', () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 mock')
    const contentDisposition = 'attachment; filename=Hyresavi.pdf'

    it('returns 200 with pdf bytes and headers on success', async () => {
      jest.spyOn(tenfastAdapter, 'getInvoicePdf').mockResolvedValueOnce({
        ok: true,
        data: { data: pdfBuffer, contentDisposition },
      })

      const res = await request(app.callback()).get('/invoices/55123456/pdf')

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toMatch('application/pdf')
      expect(res.headers['content-disposition']).toBe(contentDisposition)
      expect(Buffer.from(res.body)).toEqual(pdfBuffer)
    })

    it('returns 404 when invoice is not found', async () => {
      jest.spyOn(tenfastAdapter, 'getInvoicePdf').mockResolvedValueOnce({
        ok: false,
        err: 'not-found',
      })

      const res = await request(app.callback()).get('/invoices/NONEXISTENT/pdf')

      expect(res.status).toBe(404)
    })

    it('returns 500 on unknown error', async () => {
      jest.spyOn(tenfastAdapter, 'getInvoicePdf').mockResolvedValueOnce({
        ok: false,
        err: 'unknown',
      })

      const res = await request(app.callback()).get('/invoices/55123456/pdf')

      expect(res.status).toBe(500)
    })
  })
})
