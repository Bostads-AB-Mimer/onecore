import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import * as xledgerAdapter from '@src/services/common/adapters/xledger-adapter'
import * as xpandAdapter from '@src/services/invoice-service/adapters/xpand-db-adapter'
import * as commonXpandAdapter from '@src/services/common/adapters/xpand-db-adapter'
import { routes } from '@src/services/invoice-service'

import * as factory from '@test/factories'
import { schemas, SubmitMiscellaneousInvoiceErrorCodes } from '@onecore/types'

const app = new Koa()
const router = new KoaRouter()

app.use(bodyParser())
routes(router)
app.use(router.routes())

describe('Invoice Service', () => {
  describe('GET /invoices/bycontactcode/:contactCode', () => {
    beforeEach(() => {
      // Default: no Xledger records found for the by-number enrichment.
      // Overridden in the enrichment tests below.
      jest
        .spyOn(xledgerAdapter, 'getInvoicesByInvoiceNumbers')
        .mockResolvedValue([])
    })

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

      expect(res.body.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fromDate: xpandInvoice.fromDate.toISOString(),
            toDate: xpandInvoice.toDate.toISOString(),
          }),
        ])
      )
    })

    // MIM-1160: invoices found via a shared lease belong to another paying
    // contact, so the contact-scoped Xledger lookup misses them. They must be
    // enriched with Xledger data (debt collection, payment status) by number.
    it('enriches xpand-only invoices with xledger data fetched by invoice number', async () => {
      const sentToDebtCollection = new Date('2026-05-01T00:00:00.000Z')
      const xpandInvoice = factory.invoice.build({
        invoiceId: '552012345678',
        fromDate: new Date('2026-01-01T00:00:00.000Z'),
        toDate: new Date('2026-01-31T00:00:00.000Z'),
      })
      const xledgerInvoice = factory.invoice.build({
        invoiceId: '552012345678',
        source: 'next',
        sentToDebtCollection,
        fromDate: new Date('2026-02-01T00:00:00.000Z'),
        toDate: new Date('2026-02-28T00:00:00.000Z'),
      })

      jest
        .spyOn(xledgerAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([])
      jest
        .spyOn(xpandAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([xpandInvoice])
      const byNumberSpy = jest
        .spyOn(xledgerAdapter, 'getInvoicesByInvoiceNumbers')
        .mockResolvedValueOnce([xledgerInvoice])
      jest.spyOn(xpandAdapter, 'getInvoiceRows').mockResolvedValueOnce([])

      const res = await request(app.callback()).get(
        `/invoices/bycontactcode/P123456`
      )

      expect(res.status).toBe(200)
      expect(byNumberSpy).toHaveBeenCalledWith(['552012345678'])
      expect(res.body.content).toHaveLength(1)
      expect(res.body.content[0]).toEqual(
        expect.objectContaining({
          invoiceId: '552012345678',
          sentToDebtCollection: sentToDebtCollection.toISOString(),
          // period must still come from Xpand
          fromDate: xpandInvoice.fromDate.toISOString(),
          toDate: xpandInvoice.toDate.toISOString(),
        })
      )
    })

    it('returns unenriched xpand invoices when the by-number lookup fails', async () => {
      const xpandInvoice = factory.invoice.build({ invoiceId: '552012345678' })

      jest
        .spyOn(xledgerAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([])
      jest
        .spyOn(xpandAdapter, 'getInvoicesByContactCode')
        .mockResolvedValueOnce([xpandInvoice])
      jest
        .spyOn(xledgerAdapter, 'getInvoicesByInvoiceNumbers')
        .mockRejectedValueOnce(new Error('xledger unavailable'))
      jest.spyOn(xpandAdapter, 'getInvoiceRows').mockResolvedValueOnce([])

      const res = await request(app.callback()).get(
        `/invoices/bycontactcode/P123456`
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(1)
      expect(res.body.content[0].invoiceId).toBe('552012345678')
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

      const res = await request(app.callback()).get(`/invoices/12345`)

      expect(res.status).toBe(200)
      expect(() =>
        schemas.v1.InvoiceSchema.parse(res.body.content)
      ).not.toThrow()
    })

    it('accepts invoice numbers with a K suffix', async () => {
      const getInvoiceSpy = jest
        .spyOn(xledgerAdapter, 'getInvoiceByInvoiceNumber')
        .mockResolvedValueOnce(factory.invoice.build())

      const res = await request(app.callback()).get(`/invoices/12345K`)

      expect(res.status).toBe(200)
      expect(getInvoiceSpy).toHaveBeenCalledWith('12345K')
    })

    it.each(['abc', '1" ) { x }', '12345Kx', '123456789012345678901'])(
      'responds with 404 for invalid invoice number %p without calling xledger',
      async (invoiceNumber) => {
        const getInvoiceSpy = jest.spyOn(
          xledgerAdapter,
          'getInvoiceByInvoiceNumber'
        )
        getInvoiceSpy.mockClear()

        const res = await request(app.callback()).get(
          `/invoices/${encodeURIComponent(invoiceNumber)}`
        )

        expect(res.status).toBe(404)
        expect(getInvoiceSpy).not.toHaveBeenCalled()
      }
    )
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

    it.each(['abc', '1" ) { x }'])(
      'responds with 404 for invalid invoice number %p without calling xledger',
      async (invoiceNumber) => {
        const getMatchIdSpy = jest.spyOn(xledgerAdapter, 'getInvoiceMatchId')
        getMatchIdSpy.mockClear()

        const res = await request(app.callback()).get(
          `/invoices/${encodeURIComponent(invoiceNumber)}/payment-events`
        )

        expect(res.status).toBe(404)
        expect(getMatchIdSpy).not.toHaveBeenCalled()
      }
    )
  })

  describe('GET /invoices/miscellaneous/:rentalId', () => {
    it('is not swallowed by the invoice number guard', async () => {
      jest
        .spyOn(commonXpandAdapter, 'getPropertyCodeAndCostCentreForLease')
        .mockResolvedValueOnce({ costCentre: '123', propertyCode: '456' })

      const res = await request(app.callback()).get(
        `/invoices/miscellaneous/705-022-04-0201`
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({
        costCentre: '123',
        propertyCode: '456',
      })
    })
  })

  describe('POST /invoices/miscellaneous', () => {
    const invoiceBody = { invoice: JSON.stringify({ contactCode: 'P123456' }) }

    it('responds with 200 and the created items on success', async () => {
      jest
        .spyOn(xledgerAdapter, 'submitMiscellaneousInvoice')
        .mockResolvedValueOnce({ ok: true, data: [{ node: { dbId: 1 } }] })

      const res = await request(app.callback())
        .post('/invoices/miscellaneous')
        .send(invoiceBody)

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([{ node: { dbId: 1 } }])
    })

    it('responds with 404 and error type when the customer is missing in Xledger', async () => {
      jest
        .spyOn(xledgerAdapter, 'submitMiscellaneousInvoice')
        .mockResolvedValueOnce({
          ok: false,
          err: SubmitMiscellaneousInvoiceErrorCodes.XledgerCustomerNotFound,
        })

      const res = await request(app.callback())
        .post('/invoices/miscellaneous')
        .send(invoiceBody)

      expect(res.status).toBe(404)
      expect(res.body.type).toBe('xledger-customer-not-found')
    })

    it('responds with 500 on unknown errors', async () => {
      jest
        .spyOn(xledgerAdapter, 'submitMiscellaneousInvoice')
        .mockResolvedValueOnce({
          ok: false,
          err: SubmitMiscellaneousInvoiceErrorCodes.Unknown,
        })

      const res = await request(app.callback())
        .post('/invoices/miscellaneous')
        .send(invoiceBody)

      expect(res.status).toBe(500)
      expect(res.body.type).toBe('unknown')
    })
  })
})
