import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import * as xledgerAdapter from '@src/services/common/adapters/xledger-adapter'
import * as tenfastAdapter from '@src/common/adapters/tenfast/tenfast-adapter'
import * as invoiceService from '@src/services/invoice-service/service'
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

  describe('PUT /invoices/:invoiceNumber/deferral', () => {
    const validBody = {
      endDate: '2026-06-30',
      madeByEmail: 'admin@mimer.nu',
      reason: 'Betalningsplan överenskommen.',
    }

    it('returns 400 when endDate is missing', async () => {
      const res = await request(app.callback())
        .put('/invoices/55123456/deferral')
        .send({ madeByEmail: 'admin@mimer.nu', reason: 'test' })

      expect(res.status).toBe(400)
    })

    it('returns 200 and calls deferInvoice with correct args', async () => {
      const spy = jest
        .spyOn(invoiceService, 'deferInvoice')
        .mockResolvedValueOnce({ ok: true })

      const res = await request(app.callback())
        .put('/invoices/55123456/deferral')
        .send(validBody)

      expect(res.status).toBe(200)
      expect(spy).toHaveBeenCalledWith({
        invoiceOcr: '55123456',
        endDate: validBody.endDate,
        madeByEmail: validBody.madeByEmail,
        reason: validBody.reason,
      })
    })

    it('returns 422 with invoice-not-eligible when deferral is rejected', async () => {
      jest
        .spyOn(invoiceService, 'deferInvoice')
        .mockResolvedValueOnce({ ok: false, err: 'invoice-not-eligible' })

      const res = await request(app.callback())
        .put('/invoices/55123456/deferral')
        .send(validBody)

      expect(res.status).toBe(422)
      expect(res.body.code).toBe('invoice-not-eligible')
    })

    it('returns 404 with invoice-not-found when invoice is missing', async () => {
      jest
        .spyOn(invoiceService, 'deferInvoice')
        .mockResolvedValueOnce({ ok: false, err: 'invoice-not-found' })

      const res = await request(app.callback())
        .put('/invoices/55123456/deferral')
        .send(validBody)

      expect(res.status).toBe(404)
      expect(res.body.code).toBe('invoice-not-found')
    })

    it('returns 500 with tenfast-failed when Tenfast update fails', async () => {
      jest
        .spyOn(invoiceService, 'deferInvoice')
        .mockResolvedValueOnce({ ok: false, err: 'tenfast-failed' })

      const res = await request(app.callback())
        .put('/invoices/55123456/deferral')
        .send(validBody)

      expect(res.status).toBe(500)
      expect(res.body.code).toBe('tenfast-failed')
    })

    it('returns 500 with xledger-failed when Xledger update fails', async () => {
      jest
        .spyOn(invoiceService, 'deferInvoice')
        .mockResolvedValueOnce({ ok: false, err: 'xledger-failed' })

      const res = await request(app.callback())
        .put('/invoices/55123456/deferral')
        .send(validBody)

      expect(res.status).toBe(500)
      expect(res.body.code).toBe('xledger-failed')
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

  describe('GET /autogiro-consent/:nationalRegistrationNumber', () => {
    const mockConsent = factory.TenfastAutogiroConsentFactory.build()

    it('responds with consent when found', async () => {
      jest
        .spyOn(tenfastAdapter, 'getAutogiroConsentByNationalRegistrationNumber')
        .mockResolvedValueOnce({ ok: true, data: mockConsent })

      const res = await request(app.callback()).get(
        `/autogiro-consent/198001011234`
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toMatchObject({ _id: mockConsent._id })
    })

    it('responds with 404 when no consent found', async () => {
      jest
        .spyOn(tenfastAdapter, 'getAutogiroConsentByNationalRegistrationNumber')
        .mockResolvedValueOnce({ ok: true, data: null })

      const res = await request(app.callback()).get(
        `/autogiro-consent/198001011234`
      )

      expect(res.status).toBe(404)
      expect(res.body).toMatchObject({ message: 'No autogiro consent found' })
    })

    it('responds with 500 when tenfast returns error', async () => {
      jest
        .spyOn(tenfastAdapter, 'getAutogiroConsentByNationalRegistrationNumber')
        .mockResolvedValueOnce({ ok: false, err: 'API error' })

      const res = await request(app.callback()).get(
        `/autogiro-consent/198001011234`
      )

      expect(res.status).toBe(500)
    })
  })
})
