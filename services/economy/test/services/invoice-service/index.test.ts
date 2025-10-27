import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import * as xledgerAdapter from '@src/services/invoice-service/adapters/xledger-adapter'
import * as xpandAdapter from '@src/services/invoice-service/adapters/xpand-db-adapter'
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
        .mockResolvedValueOnce(factory.invoice.buildList(3))

      jest
        .spyOn(xpandAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce(factory.invoice.buildList(3))

      jest.spyOn(xpandAdapter, 'getInvoiceRows').mockResolvedValueOnce([])

      const res = await request(app.callback()).get(
        `/invoices/bycontactcode/P123456`
      )

      expect(res.status).toBe(200)
      expect(res.body).toEqual(expect.any(Array))
    })

    it('maps invoice rows to invoices', async () => {
      const [invoice_1, invoice_2] = [
        factory.invoice.build({ invoiceId: 'foo' }),
        factory.invoice.build({ invoiceId: 'bar' }),
      ]

      const [invoiceRows_1, invoiceRows_2] = [
        factory.invoiceRow.buildList(3, { invoiceNumber: invoice_1.invoiceId }),
        factory.invoiceRow.buildList(3, { invoiceNumber: invoice_2.invoiceId }),
      ]

      jest
        .spyOn(xledgerAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([invoice_1])

      jest
        .spyOn(xpandAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([invoice_2])

      jest
        .spyOn(xpandAdapter, 'getInvoiceRows')
        .mockResolvedValueOnce(invoiceRows_1.concat(invoiceRows_2))

      const res = await request(app.callback()).get(
        `/invoices/bycontactcode/P123456`
      )

      expect(res.status).toBe(200)
      expect(res.body).toEqual(expect.any(Array))

      const invoice_1_response = res.body.find(
        (invoice: any) => invoice.invoiceId === invoice_1.invoiceId
      )

      const invoice_2_response = res.body.find(
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
    })

    it('uses fromDate and toDate from Xpand if available', async () => {
      const invoiceId = 'foo'
      const xpandInvoice = factory.invoice.build({
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
        .spyOn(xpandAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([xpandInvoice])

      jest
        .spyOn(xledgerAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([xledgerInvoice])

      jest.spyOn(xpandAdapter, 'getInvoiceRows').mockResolvedValueOnce([])

      const res = await request(app.callback()).get(
        `/invoices/bycontactcode/P123456`
      )

      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fromDate: xpandInvoice.fromDate.toISOString(),
            toDate: xpandInvoice.toDate.toISOString(),
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
        .spyOn(xpandAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([])

      jest
        .spyOn(xledgerAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([xledgerInvoice])

      jest.spyOn(xpandAdapter, 'getInvoiceRows').mockResolvedValueOnce([])

      const res = await request(app.callback()).get(
        `/invoices/bycontactcode/P123456`
      )

      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fromDate: xledgerInvoice.fromDate.toISOString(),
            toDate: xledgerInvoice.toDate.toISOString(),
          }),
        ])
      )
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
})
