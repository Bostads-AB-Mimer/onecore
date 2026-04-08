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
