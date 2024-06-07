import axios from 'axios'
jest.mock('onecore-utilities', () => {
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
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { routes } from '../index'
import * as rentalPropertyAdapter from '../../../adapters/property-management-adapter'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('rental-property-service index', () => {
  describe('GET /rentalproperties/:id/rooms-with-material-choices', () => {
    it('responds', async () => {
      const materialChoicesSpy = jest
        .spyOn(rentalPropertyAdapter, 'getRoomsWithMaterialChoices')
        .mockResolvedValue({
          roomTypes: [
            {
              roomTypeId: 'BADRUM',
              name: 'BADRUM',
              materialOptionGroups: [Array],
            },
            { roomTypeId: 'KÖK', name: 'KÖK', materialOptionGroups: [Array] },
            {
              roomTypeId: 'RUM 1',
              name: 'RUM 1',
              materialOptionGroups: [Array],
            },
            {
              roomTypeId: 'VARDAGSRUM',
              name: 'VARDAGSRUM',
              materialOptionGroups: [Array],
            },
          ],
        })

      const res = await request(app.callback()).get(
        '/rentalproperties/406-097-11-0201/rooms-with-material-choices'
      )

      expect(res.status).toBe(200)
      expect(materialChoicesSpy).toHaveBeenCalled()
      expect(res.body.roomTypes).toBeDefined()
    })
  })
})
