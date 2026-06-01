import axios from 'axios'
jest.mock('@onecore/utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
    },
    loggedAxios: axios,
    axiosTypes: axios,
    generateRouteMetadata: jest.fn(() => ({})),
    makeSuccessResponseBody: jest.fn((content, metadata) => ({
      content,
      ...metadata,
    })),
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { economy } from '@onecore/types'

import { routes } from '../index'
import * as economyAdapter from '../../../adapters/economy-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as communicationAdapter from '../../../adapters/communication-adapter'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('economy-service routes', () => {
  afterEach(() => jest.restoreAllMocks())

  describe('GET /invoices/:ocr/pdf', () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 mock')
    const contentDisposition = 'attachment; filename=Hyresavi.pdf'

    it('returns 200 with pdf bytes and headers on success', async () => {
      jest.spyOn(economyAdapter, 'getInvoicePdf').mockResolvedValueOnce({
        ok: true,
        data: { data: pdfBuffer, contentDisposition },
      })

      const res = await request(app.callback()).get(
        '/invoices/552606001476999/pdf'
      )

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toMatch('application/pdf')
      expect(res.headers['content-disposition']).toBe(contentDisposition)
      expect(Buffer.from(res.body)).toEqual(pdfBuffer)
    })

    it('returns 404 when invoice is not found', async () => {
      jest.spyOn(economyAdapter, 'getInvoicePdf').mockResolvedValueOnce({
        ok: false,
        err: 'not-found',
      })

      const res = await request(app.callback()).get('/invoices/NONEXISTENT/pdf')

      expect(res.status).toBe(404)
    })

    it('returns 500 on unknown error', async () => {
      jest.spyOn(economyAdapter, 'getInvoicePdf').mockResolvedValueOnce({
        ok: false,
        err: 'unknown',
      })

      const res = await request(app.callback()).get(
        '/invoices/552606001476999/pdf'
      )

      expect(res.status).toBe(500)
    })
  })

  describe('POST /invoices/notifyBatch', () => {
    const mockInvoice = {
      invoiceId: '552606001476999',
      leaseIds: ['705-024-01-0101/14'],
      expirationDate: '2026-02-28T00:00:00.000Z',
      amount: 5432,
    }

    const mockLease = {
      tenantContactIds: ['P174691'],
      rentalObject: { address: 'Testgatan 1' },
    }

    const mockContact = {
      firstName: 'Anna',
      emailAddress: 'anna@example.com',
    }

    const mockPdf = {
      data: Buffer.from('%PDF-1.4 mock'),
      contentDisposition: 'attachment; filename=Hyresavi.pdf',
    }

    const setupHappyPath = () => {
      jest
        .spyOn(economyAdapter, 'getInvoiceByOcr')
        .mockResolvedValue({ ok: true, data: mockInvoice as any })
      jest
        .spyOn(economyAdapter, 'getInvoicePdf')
        .mockResolvedValue({ ok: true, data: mockPdf })
      jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease as any)
      jest
        .spyOn(leasingAdapter, 'getContactByContactCode')
        .mockResolvedValue({ ok: true, data: mockContact as any })
      jest
        .spyOn(communicationAdapter, 'sendInvoiceNotificationEmail')
        .mockResolvedValue({ ok: true, data: null })
    }

    it('returns 400 when ocrs is missing', async () => {
      const res = await request(app.callback())
        .post('/invoices/notifyBatch')
        .send({})
      expect(res.status).toBe(400)
    })

    it('returns 400 when ocrs is empty array', async () => {
      const res = await request(app.callback())
        .post('/invoices/notifyBatch')
        .send({ ocrs: [] })
      expect(res.status).toBe(400)
    })

    it('returns 400 when ocrs contains non-strings', async () => {
      const res = await request(app.callback())
        .post('/invoices/notifyBatch')
        .send({ ocrs: [123] })
      expect(res.status).toBe(400)
    })

    it('returns 200 with sent list on success', async () => {
      setupHappyPath()

      const res = await request(app.callback())
        .post('/invoices/notifyBatch')
        .send({ ocrs: ['552606001476999'] })

      expect(res.status).toBe(200)
      expect(res.body.content.sent).toEqual(['552606001476999'])
      expect(res.body.content.failed).toEqual([])
      expect(res.body.content.totalSent).toBe(1)
      expect(res.body.content.totalFailed).toBe(0)
    })

    it('adds to failed when invoice not found', async () => {
      jest
        .spyOn(economyAdapter, 'getInvoiceByOcr')
        .mockResolvedValue({ ok: false, err: 'not-found' })
      jest
        .spyOn(economyAdapter, 'getInvoicePdf')
        .mockResolvedValue({ ok: true, data: mockPdf })

      const res = await request(app.callback())
        .post('/invoices/notifyBatch')
        .send({ ocrs: ['MISSING'] })

      expect(res.status).toBe(200)
      expect(res.body.content.sent).toEqual([])
      expect(res.body.content.failed).toEqual([
        { ocr: 'MISSING', error: 'not-found' },
      ])
    })

    it('adds to failed when lease not found', async () => {
      jest
        .spyOn(economyAdapter, 'getInvoiceByOcr')
        .mockResolvedValue({ ok: true, data: mockInvoice as any })
      jest
        .spyOn(economyAdapter, 'getInvoicePdf')
        .mockResolvedValue({ ok: true, data: mockPdf })
      jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(null)

      const res = await request(app.callback())
        .post('/invoices/notifyBatch')
        .send({ ocrs: ['552606001476999'] })

      expect(res.status).toBe(200)
      expect(res.body.content.failed).toEqual([
        { ocr: '552606001476999', error: 'lease-not-found' },
      ])
    })

    it('adds to failed when contact has no email', async () => {
      jest
        .spyOn(economyAdapter, 'getInvoiceByOcr')
        .mockResolvedValue({ ok: true, data: mockInvoice as any })
      jest
        .spyOn(economyAdapter, 'getInvoicePdf')
        .mockResolvedValue({ ok: true, data: mockPdf })
      jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease as any)
      jest.spyOn(leasingAdapter, 'getContactByContactCode').mockResolvedValue({
        ok: true,
        data: { firstName: 'Anna', emailAddress: undefined } as any,
      })

      const res = await request(app.callback())
        .post('/invoices/notifyBatch')
        .send({ ocrs: ['552606001476999'] })

      expect(res.status).toBe(200)
      expect(res.body.content.failed).toEqual([
        { ocr: '552606001476999', error: 'no-email' },
      ])
    })

    it('handles mix of successful and failed invoices', async () => {
      jest
        .spyOn(economyAdapter, 'getInvoiceByOcr')
        .mockResolvedValueOnce({ ok: true, data: mockInvoice as any })
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })
      jest
        .spyOn(economyAdapter, 'getInvoicePdf')
        .mockResolvedValueOnce({ ok: true, data: mockPdf })
        .mockResolvedValueOnce({ ok: true, data: mockPdf })
      jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease as any)
      jest
        .spyOn(leasingAdapter, 'getContactByContactCode')
        .mockResolvedValue({ ok: true, data: mockContact as any })
      jest
        .spyOn(communicationAdapter, 'sendInvoiceNotificationEmail')
        .mockResolvedValue({ ok: true, data: null })

      const res = await request(app.callback())
        .post('/invoices/notifyBatch')
        .send({ ocrs: ['552606001476999', 'MISSING'] })

      expect(res.status).toBe(200)
      expect(res.body.content.sent).toEqual(['552606001476999'])
      expect(res.body.content.failed).toEqual([
        { ocr: 'MISSING', error: 'not-found' },
      ])
      expect(res.body.content.totalSent).toBe(1)
      expect(res.body.content.totalFailed).toBe(1)
    })
  })

  describe('POST /imd/process', () => {
    it('returns 200 with enriched data on success', async () => {
      const mockData = {
        totalRows: 3,
        numEnriched: 2,
        numUnprocessed: 1,
        enrichedCsv: 'header\nrow1',
        unprocessedCsv: 'header\nrow1',
      }

      jest.spyOn(economyAdapter, 'processIMD').mockResolvedValue({
        ok: true,
        data: mockData,
      })

      const csv =
        '306-008-01-0201;2026-01-01;2026-01-31;VV;129;136;7,58;621,68;;82;m3;;;1'

      const res = await request(app.callback())
        .post('/imd/process')
        .send({ csv })

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual(mockData)
      expect(() =>
        economy.ProcessIMDResponseSchema.parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 400 when csv is missing', async () => {
      const res = await request(app.callback()).post('/imd/process').send({})

      expect(res.status).toBe(400)
    })

    it('returns 400 when csv is empty string', async () => {
      const res = await request(app.callback())
        .post('/imd/process')
        .send({ csv: '' })

      expect(res.status).toBe(400)
    })

    it('returns 400 when csv has too few columns', async () => {
      const res = await request(app.callback())
        .post('/imd/process')
        .send({ csv: 'only;three;columns' })

      expect(res.status).toBe(400)
    })

    it('returns 400 with reason when adapter returns invalid-csv', async () => {
      jest.spyOn(economyAdapter, 'processIMD').mockResolvedValue({
        ok: false,
        err: 'invalid-csv',
        statusCode: 400,
      })

      const csv =
        '306-008-01-0201;2026-01-01;2026-01-31;VV;129;136;7,58;621,68;;82;m3;;;1'

      const res = await request(app.callback())
        .post('/imd/process')
        .send({ csv })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid CSV format')
      expect(res.body.reason).toBe('invalid-csv')
    })

    it('returns 500 when adapter returns error', async () => {
      jest.spyOn(economyAdapter, 'processIMD').mockResolvedValue({
        ok: false,
        err: 'unknown',
        statusCode: 500,
      })

      const csv =
        '306-008-01-0201;2026-01-01;2026-01-31;VV;129;136;7,58;621,68;;82;m3;;;1'

      const res = await request(app.callback())
        .post('/imd/process')
        .send({ csv })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Processing failed')
    })
  })
})
