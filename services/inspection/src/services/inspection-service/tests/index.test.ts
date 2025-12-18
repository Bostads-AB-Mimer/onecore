import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as xpandAdapter from '../adapters/xpand-adapter'
import { XpandInspectionFactory } from './factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('inspection-service', () => {
  describe('GET /inspections/xpand', () => {
    it('responds with an array of inspections', async () => {
      const getInspectionsSpy = jest
        .spyOn(xpandAdapter, 'getInspections')
        .mockResolvedValueOnce({
          ok: true,
          data: [
            XpandInspectionFactory.build({
              id: 'INS001',
              status: 'Registrerad',
            }),
            XpandInspectionFactory.build({ id: 'INS002', status: 'Genomförd' }),
          ],
        })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(res.status).toBe(200)
      expect(res.body.content.inspections).toBeInstanceOf(Array)
      expect(getInspectionsSpy).toHaveBeenCalled()
      expect(res.body.content.inspections.length).toBe(2)
    })

    it('handles adapter errors', async () => {
      const getInspectionsSpy = jest
        .spyOn(xpandAdapter, 'getInspections')
        .mockResolvedValueOnce({ ok: false, err: 'schema-error' })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(getInspectionsSpy).toHaveBeenCalled()
      expect(res.status).toBe(500)
      expect(res.body.error).toBe(
        'Failed to fetch inspections from Xpand: schema-error'
      )
    })

    it('handles unhandled errors', async () => {
      const getInspectionsSpy = jest
        .spyOn(xpandAdapter, 'getInspections')
        .mockImplementation(() => {
          throw new Error('Database connection failed')
        })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(getInspectionsSpy).toHaveBeenCalled()
      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Database connection failed')
    })
  })
})
