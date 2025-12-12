import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { z } from 'zod'

import { routes } from '../index'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'

import * as factory from '../../../../test/factories'
import { SearchResultSchema } from '../schemas'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)
describe('search-service', () => {
  describe('GET /search', () => {
    it('requires query param', async () => {
      const res = await request(app.callback()).get('/search')
      expect(res.status).toBe(400)
    })

    it('returns 200 and a list of search results', async () => {
      const searchResults = factory.residenceSearchResult.buildList(3)
      const searchBuildingsSpy = jest
        .spyOn(propertyBaseAdapter, 'searchBuildings')
        .mockResolvedValueOnce({ ok: true, data: [] })
      const searchPropertiesSpy = jest
        .spyOn(propertyBaseAdapter, 'searchProperties')
        .mockResolvedValueOnce({ ok: true, data: [] })
      const searchResidencesSpy = jest
        .spyOn(propertyBaseAdapter, 'searchResidences')
        .mockResolvedValueOnce({ ok: true, data: searchResults })
      const searchParkingSpacesSpy = jest
        .spyOn(propertyBaseAdapter, 'searchParkingSpaces')
        .mockResolvedValueOnce({ ok: true, data: [] })

      const res = await request(app.callback()).get('/search?q=asdf')

      expect(res.status).toBe(200)
      expect(searchBuildingsSpy).toHaveBeenCalled()
      expect(searchPropertiesSpy).toHaveBeenCalled()
      expect(searchResidencesSpy).toHaveBeenCalled()
      expect(searchParkingSpacesSpy).toHaveBeenCalled()

      expect(() =>
        z.array(SearchResultSchema).parse(res.body.content)
      ).not.toThrow()
    })
  })
})
