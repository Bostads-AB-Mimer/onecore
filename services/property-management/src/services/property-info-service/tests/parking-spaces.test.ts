import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { routes } from '../index'
import * as xpandAdapter from '../adapters/xpand-adapter'
import {
  ParkingSpace,
  ParkingSpaceApplicationCategory,
  ParkingSpaceType,
} from 'onecore-types'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('parking spaces', () => {
  describe('GET /parkingspaces/:id', () => {
    it('Gets and returns a parking space', async () => {
      const mockedParkingSpace: ParkingSpace = {
        address: {
          street: 'Parkeringsgatan',
          number: '1',
          city: 'Västerås',
          postalCode: '12345',
        },
        applicationCategory: ParkingSpaceApplicationCategory.internal,
        parkingSpaceId: '123-456-789',
        rent: {
          currentRent: {
            currentRent: 123,
            vat: 3,
            additionalChargeAmount: undefined,
            additionalChargeDescription: undefined,
            rentEndDate: undefined,
            rentStartDate: undefined,
          },
          futureRents: undefined,
        },
        vacantFrom: new Date(),
        type: ParkingSpaceType.Garage,
      }
      const getParkingPaceSpy = jest
        .spyOn(xpandAdapter, 'getParkingSpaceOld')
        .mockResolvedValue(mockedParkingSpace)

      const res = await request(app.callback()).get(
        `/parkingspaces/${mockedParkingSpace.parkingSpaceId}`
      )

      expect(res.status).toBe(200)
      expect(getParkingPaceSpy).toHaveBeenCalledWith(
        mockedParkingSpace.parkingSpaceId
      )
      expect(res.body.content).toStrictEqual(
        JSON.parse(JSON.stringify(mockedParkingSpace))
      )
    })
  })
})
