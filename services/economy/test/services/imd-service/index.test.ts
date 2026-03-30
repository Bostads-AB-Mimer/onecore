import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { economy } from '@onecore/types'

import { routes, imdService } from '@src/services/imd-service'

const app = new Koa()
const router = new KoaRouter()

app.use(bodyParser())
routes(router)
app.use(router.routes())

const validCsv =
  '306-008-01-0201;2026-01-01;2026-01-31;VV;129;136;7,58;621,68;;82;m3;;;1'

describe('IMD Service routes', () => {
  afterEach(() => jest.restoreAllMocks())

  describe('POST /imd/process', () => {
    it('returns 200 with mapped response on success', async () => {
      jest.spyOn(imdService, 'processIMD').mockResolvedValue({
        ok: true,
        data: {
          totalRows: 3,
          enriched: 2,
          unprocessed: [
            {
              rentalObjectCode: 'X',
              from: new Date(),
              to: new Date(),
              unit: 'VV',
              volume: 1,
              cost: 10,
              measurementUnit: 'm3',
              reason: 'amount-too-low' as const,
            },
          ],
          enrichedCsv: 'header\nrow1',
          unprocessedCsv: 'header\nrow1',
        },
      })

      const res = await request(app.callback())
        .post('/imd/process')
        .send({ csv: validCsv })

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({
        totalRows: 3,
        numEnriched: 2,
        numUnprocessed: 1,
        enrichedCsv: 'header\nrow1',
        unprocessedCsv: 'header\nrow1',
      })
      expect(() =>
        economy.ProcessIMDResponseSchema.parse(res.body.content)
      ).not.toThrow()
    })

    it('does not expose unprocessed array in response', async () => {
      jest.spyOn(imdService, 'processIMD').mockResolvedValue({
        ok: true,
        data: {
          totalRows: 1,
          enriched: 0,
          unprocessed: [
            {
              rentalObjectCode: 'X',
              from: new Date(),
              to: new Date(),
              unit: 'VV',
              volume: 1,
              cost: 10,
              measurementUnit: 'm3',
              reason: 'no-rental-object' as const,
            },
          ],
          enrichedCsv: '',
          unprocessedCsv: 'header\nrow1',
        },
      })

      const res = await request(app.callback())
        .post('/imd/process')
        .send({ csv: validCsv })

      expect(res.status).toBe(200)
      expect(res.body.content).not.toHaveProperty('unprocessed')
    })

    it('returns 400 when csv is missing', async () => {
      const res = await request(app.callback()).post('/imd/process').send({})

      expect(res.status).toBe(400)
    })

    it('returns 400 when csv has too few columns', async () => {
      const res = await request(app.callback())
        .post('/imd/process')
        .send({ csv: 'only;three;columns' })

      expect(res.status).toBe(400)
    })

    it('returns 400 when processIMD returns invalid-csv', async () => {
      jest.spyOn(imdService, 'processIMD').mockResolvedValue({
        ok: false,
        reason: 'invalid-csv',
      })

      const res = await request(app.callback())
        .post('/imd/process')
        .send({ csv: validCsv })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid CSV format')
    })

    it('returns 500 when processIMD returns processing-failed', async () => {
      jest.spyOn(imdService, 'processIMD').mockResolvedValue({
        ok: false,
        reason: 'processing-failed',
      })

      const res = await request(app.callback())
        .post('/imd/process')
        .send({ csv: validCsv })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Processing failed')
    })
  })
})
