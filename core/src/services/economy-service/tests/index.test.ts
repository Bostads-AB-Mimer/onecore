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

  describe('POST /invoice-channels', () => {
    it('returns 200 with channel data on success', async () => {
      const mockData = [
        { channel: 'Kivra', matchedCandidates: ['P000111'], error: null },
        { channel: 'eInvoiceB2C', matchedCandidates: ['P000222'], error: null },
      ]

      jest.spyOn(economyAdapter, 'getInvoiceChannels').mockResolvedValue({
        ok: true,
        data: mockData as any,
      })

      const res = await request(app.callback())
        .post('/invoice-channels')
        .send({ nationalRegistrationNumbers: ['P000111', 'P000222'] })

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual(mockData)
      expect(economyAdapter.getInvoiceChannels).toHaveBeenCalledWith([
        'P000111',
        'P000222',
      ])
    })

    it('returns 400 when nationalRegistrationNumbers is missing', async () => {
      const res = await request(app.callback())
        .post('/invoice-channels')
        .send({})

      expect(res.status).toBe(400)
    })

    it('returns 500 when adapter returns error', async () => {
      jest.spyOn(economyAdapter, 'getInvoiceChannels').mockResolvedValue({
        ok: false,
        err: 'unknown',
      })

      const res = await request(app.callback())
        .post('/invoice-channels')
        .send({ nationalRegistrationNumbers: ['P000111'] })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('unknown')
    })
  })
})
