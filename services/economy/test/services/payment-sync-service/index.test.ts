import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import * as xledgerAdapter from '@src/services/common/adapters/xledger-adapter'
import * as tenfastAdapter from '@src/common/adapters/tenfast/tenfast-adapter'
import { routes } from '@src/services/payment-sync-service'
import * as factory from '@test/factories'

const app = new Koa()
const router = new KoaRouter()

app.use(bodyParser())
routes(router)
app.use(router.routes())

describe('Payment Sync Service', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('GET /payments/latest-cursor', () => {
    it('responds with the latest cursor', async () => {
      jest
        .spyOn(xledgerAdapter, 'getLatestPaymentCursor')
        .mockResolvedValueOnce('cursor-999')

      const res = await request(app.callback()).get('/payments/latest-cursor')

      expect(res.status).toBe(200)
      expect(res.body.content).toBe('cursor-999')
    })

    it('responds with null when no transactions exist', async () => {
      jest
        .spyOn(xledgerAdapter, 'getLatestPaymentCursor')
        .mockResolvedValueOnce(null)

      const res = await request(app.callback()).get('/payments/latest-cursor')

      expect(res.status).toBe(200)
      expect(res.body.content).toBeNull()
    })

    it('responds with 500 when adapter throws', async () => {
      jest
        .spyOn(xledgerAdapter, 'getLatestPaymentCursor')
        .mockRejectedValueOnce(new Error('Xledger unavailable'))

      const res = await request(app.callback()).get('/payments/latest-cursor')

      expect(res.status).toBe(500)
    })
  })

  describe('GET /payments/since', () => {
    it('responds with payment events and lastCursor', async () => {
      const events = factory.invoicePaymentEvent.buildList(2)
      jest.spyOn(xledgerAdapter, 'getPaymentsSince').mockResolvedValueOnce({
        events,
        lastCursor: 'cursor-abc',
      })

      const res = await request(app.callback()).get(
        '/payments/since?after=cursor-abc'
      )

      expect(res.status).toBe(200)
      expect(res.body.content.events).toHaveLength(2)
      expect(res.body.content.lastCursor).toBe('cursor-abc')
    })

    it('passes the after cursor to the adapter', async () => {
      const spy = jest
        .spyOn(xledgerAdapter, 'getPaymentsSince')
        .mockResolvedValueOnce({ events: [], lastCursor: 'cursor-xyz' })

      await request(app.callback()).get('/payments/since?after=cursor-abc')

      expect(spy).toHaveBeenCalledWith('cursor-abc')
    })

    it('responds with 400 when after param is missing', async () => {
      const res = await request(app.callback()).get('/payments/since')

      expect(res.status).toBe(400)
    })

    it('responds with empty events when no new payments', async () => {
      jest.spyOn(xledgerAdapter, 'getPaymentsSince').mockResolvedValueOnce({
        events: [],
        lastCursor: null,
      })

      const res = await request(app.callback()).get(
        '/payments/since?after=cursor-abc'
      )

      expect(res.status).toBe(200)
      expect(res.body.content.events).toEqual([])
    })

    it('responds with 500 when adapter throws', async () => {
      jest
        .spyOn(xledgerAdapter, 'getPaymentsSince')
        .mockRejectedValueOnce(new Error('Xledger unavailable'))

      const res = await request(app.callback()).get(
        '/payments/since?after=cursor-abc'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('POST /invoices/:invoiceId/payments', () => {
    const validBody = {
      amount: 1000,
      dateTime: '2026-04-02T10:00:00.000Z',
      method: 'bank',
    }

    it('responds with 400 when body is missing required fields', async () => {
      const res = await request(app.callback())
        .post('/invoices/55123456/payments')
        .send({})

      expect(res.status).toBe(400)
    })

    it('responds with 404 when invoice is not found in Tenfast', async () => {
      jest
        .spyOn(tenfastAdapter, 'recordPaymentForInvoice')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback())
        .post('/invoices/55123456/payments')
        .send(validBody)

      expect(res.status).toBe(404)
    })

    it('responds with 200 on success', async () => {
      jest
        .spyOn(tenfastAdapter, 'recordPaymentForInvoice')
        .mockResolvedValueOnce({ ok: true, data: null })

      const res = await request(app.callback())
        .post('/invoices/55123456/payments')
        .send(validBody)

      expect(res.status).toBe(200)
      expect(tenfastAdapter.recordPaymentForInvoice).toHaveBeenCalledWith({
        ocr: '55123456',
        amount: 1000,
        dateTime: new Date('2026-04-02T10:00:00.000Z'),
        method: 'bank',
      })
    })

    it('responds with 500 on unknown adapter error', async () => {
      jest
        .spyOn(tenfastAdapter, 'recordPaymentForInvoice')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback())
        .post('/invoices/55123456/payments')
        .send(validBody)

      expect(res.status).toBe(500)
    })

    it('responds with 500 when adapter throws', async () => {
      jest
        .spyOn(tenfastAdapter, 'recordPaymentForInvoice')
        .mockRejectedValueOnce(new Error('Tenfast unavailable'))

      const res = await request(app.callback())
        .post('/invoices/55123456/payments')
        .send(validBody)

      expect(res.status).toBe(500)
    })
  })
})
