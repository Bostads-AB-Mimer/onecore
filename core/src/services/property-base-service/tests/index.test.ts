import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'

import * as factory from '../../../../test/factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)
describe('property-base-service', () => {
  describe('GET /propertyBase/residence/:residenceId', () => {
    it('returns 200 and a residence', async () => {
      const residence = factory.residence.build()
      const getResidenceDetailsSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceDetails')
        .mockResolvedValueOnce({ ok: true, data: residence })

      const res = await request(app.callback()).get(
        `/propertyBase/residence/${residence.id}`
      )

      expect(res.status).toBe(200)
      expect(getResidenceDetailsSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(residence)
      )
    })

    it('returns 404 if no residence is found', async () => {
      const residence = factory.residence.build()
      const getResidenceDetailsSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceDetails')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        `/propertyBase/residence/${residence.id}`
      )

      expect(res.status).toBe(404)
      expect(getResidenceDetailsSpy).toHaveBeenCalled()
    })
  })
})
