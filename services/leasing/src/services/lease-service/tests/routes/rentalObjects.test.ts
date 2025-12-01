import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import * as rentalObjectAdapter from '../../adapters/xpand/rental-object-adapter'
import { routes } from '../../routes/rental-objects'
import * as factory from '../factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('parking spaces', () => {
  describe('GET /parking-spaces', () => {
    it('Gets and returns a list of parking spaces', async () => {
      const parkingSpace = factory.rentalObject.build({
        rentalObjectCode: '123-456-789',
      })

      const getParkingSpacesSpy = jest
        .spyOn(rentalObjectAdapter, 'getParkingSpaces')
        .mockResolvedValue({ ok: true, data: [parkingSpace] })

      const res = await request(app.callback()).post('/parking-spaces')

      expect(res.status).toBe(200)
      expect(getParkingSpacesSpy).toHaveBeenCalled()
      expect(res.body.content).toStrictEqual(
        JSON.parse(JSON.stringify([parkingSpace]))
      )
    })
    it('Gets and returns a list of parking spaces filtering on includeRentalObjectCodes', async () => {
      const parkingSpace1 = factory.rentalObject.build({
        rentalObjectCode: 'code-1',
      })
      const parkingSpace2 = factory.rentalObject.build({
        rentalObjectCode: 'code-2',
      })

      const getParkingSpacesSpy = jest
        .spyOn(rentalObjectAdapter, 'getParkingSpaces')
        .mockResolvedValue({ ok: true, data: [parkingSpace1, parkingSpace2] })

      const res = await request(app.callback())
        .post('/parking-spaces')
        .send({ includeRentalObjectCodes: ['code-1', 'code-2'] })

      expect(res.status).toBe(200)
      expect(getParkingSpacesSpy).toHaveBeenCalledWith(['code-1', 'code-2'])
      expect(res.body.content).toStrictEqual(
        JSON.parse(JSON.stringify([parkingSpace1, parkingSpace2]))
      )
    })
    it('Handles errors gracefully when fetching parking spaces', async () => {
      jest.spyOn(rentalObjectAdapter, 'getParkingSpaces').mockResolvedValue({
        ok: false,
        err: 'unknown',
      })

      const res = await request(app.callback()).post('/parking-spaces')

      expect(res.status).toBe(500)
      expect(res.body.error).toBe(
        'An error occurred while fetching parking spaces.'
      )
    })
  })

  describe('GET /parking-spaces/by-code/:rentalObjectCode', () => {
    it('Gets and returns a parking space by rental object code', async () => {
      const parkingSpace = factory.rentalObject.build({
        rentalObjectCode: 'code-123',
      })

      const getParkingSpacesSpy = jest
        .spyOn(rentalObjectAdapter, 'getParkingSpace')
        .mockResolvedValue({ ok: true, data: parkingSpace })

      const res = await request(app.callback()).get(
        `/parking-spaces/by-code/code-123`
      )

      expect(res.status).toBe(200)
      expect(getParkingSpacesSpy).toHaveBeenCalledWith('code-123')
      expect(res.body.content).toStrictEqual(
        JSON.parse(JSON.stringify(parkingSpace))
      )
    })
    it('Handles errors gracefully when fetching parking space by rental object code', async () => {
      jest.spyOn(rentalObjectAdapter, 'getParkingSpace').mockResolvedValue({
        ok: false,
        err: 'parking-space-not-found',
      })

      const res = await request(app.callback()).get(
        '/parking-spaces/by-code/code-404'
      )

      expect(res.status).toBe(404)
      expect(res.body.error).toBe(
        'An error occurred while fetching parking space by Rental Object Code: code-404'
      )
    })
  })

  describe('GET /vacant-parkingspaces', () => {
    it('should return a list of vacant parking spaces', async () => {
      const mockedVacantParkingSpaces = [
        {
          rentalObjectCode: '924-004-99-0008',
          address: 'Karl IX:s V 18',
          objectTypeCaption: 'Motorcykelgarage',
          objectTypeCode: 'MCGAR',
          vehicleSpaceCaption: 'KARL IX:S VÄG 18',
          vehicleSpaceCode: '0008',
          districtCaption: 'Distrikt Norr',
          districtCode: '2',
          monthlyRent: 0,
          residentialAreaCaption: 'Centrum',
          residentialAreaCode: 'CTR',
          vacantFrom: new Date('2023-10-01'),
        },
      ]

      const getAllVacantParkingSpacesSpy = jest
        .spyOn(rentalObjectAdapter, 'getAllVacantParkingSpaces')
        .mockResolvedValue({ ok: true, data: mockedVacantParkingSpaces })

      const res = await request(app.callback()).get('/vacant-parkingspaces')

      expect(res.status).toBe(200)
      expect(getAllVacantParkingSpacesSpy).toHaveBeenCalled()

      expect(res.body.content).toStrictEqual(
        JSON.parse(JSON.stringify(mockedVacantParkingSpaces))
      )
    })

    it('should handle errors gracefully', async () => {
      const getAllVacantParkingSpacesSpy = jest
        .spyOn(rentalObjectAdapter, 'getAllVacantParkingSpaces')
        .mockResolvedValue({
          ok: false,
          err: 'get-all-vacant-parking-spaces-failed',
        })

      const res = await request(app.callback()).get('/vacant-parkingspaces')

      expect(res.status).toBe(500)
      expect(getAllVacantParkingSpacesSpy).toHaveBeenCalled()
      expect(res.body.error).toBe(
        'An error occurred while fetching vacant parking spaces.'
      )
    })
  })
})
