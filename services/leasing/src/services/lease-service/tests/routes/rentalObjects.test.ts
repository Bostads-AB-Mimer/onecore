import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import * as rentalObjectAdapter from '../../adapters/xpand/rental-object-adapter'
import * as tenfastAdapter from '../../adapters/tenfast/tenfast-adapter'
import { routes } from '../../routes/rental-objects'
import * as factory from '../factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('parking spaces', () => {
  describe('POST /parking-spaces', () => {
    it('should respond with 404 if parking spaces are not found', async () => {
      // Arrange
      jest.spyOn(rentalObjectAdapter, 'getParkingSpaces').mockResolvedValue({
        ok: false,
        err: 'parking-spaces-not-found',
      })

      // Act
      const res = await request(app.callback())
        .post('/parking-spaces')
        .send({
          includeRentalObjectCodes: ['notfound-1', 'notfound-2'],
        })

      // Assert
      expect(res.status).toBe(404)
      expect(res.body.error).toBe(
        'No parking spaces found for rental object codes: notfound-1,notfound-2'
      )
    })

    it('should respond with 500 if fetching rents fails', async () => {
      // Arrange
      jest
        .spyOn(rentalObjectAdapter, 'getParkingSpaces')
        .mockResolvedValue({ ok: true, data: [factory.rentalObject.build()] })
      jest
        .spyOn(tenfastAdapter, 'getRentalObjectAvailabilityInfo')
        .mockResolvedValue({ ok: false, err: 'could-not-find-rental-objects' })

      // Act
      const res = await request(app.callback())
        .post('/parking-spaces')
        .send({
          includeRentalObjectCodes: ['code-1'],
        })

      // Assert
      expect(res.status).toBe(500)
      expect(res.body.error).toBe(
        'An error occurred while fetching availability for parking spaces.'
      )
    })

    it('should set availability on parking spaces if availability is found', async () => {
      // Arrange
      const parkingSpace = factory.rentalObject.build({
        rentalObjectCode: 'code-1',
      })
      const rent = factory.rentalObjectRent.build({
        amount: 999,
      })
      const availability = factory.rentalObjectAvailabilityInfo.build({
        rentalObjectCode: 'code-1',
        rent,
      })
      jest
        .spyOn(rentalObjectAdapter, 'getParkingSpaces')
        .mockResolvedValue({ ok: true, data: [parkingSpace] })
      jest
        .spyOn(tenfastAdapter, 'getRentalObjectAvailabilityInfo')
        .mockResolvedValue({ ok: true, data: [availability] })

      // Act
      const res = await request(app.callback())
        .post('/parking-spaces')
        .send({
          includeRentalObjectCodes: ['code-1'],
        })

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content[0].rent.amount).toBe(999)
    })

    it('should not set availability if availability is not found for parking space', async () => {
      // Arrange
      const parkingSpace = factory.rentalObject.build({
        rentalObjectCode: 'code-1',
        availabilityInfo: undefined,
      })
      jest
        .spyOn(rentalObjectAdapter, 'getParkingSpaces')
        .mockResolvedValue({ ok: true, data: [parkingSpace] })
      jest
        .spyOn(tenfastAdapter, 'getRentalObjectAvailabilityInfo')
        .mockResolvedValue({ ok: true, data: [] })

      // Act
      const res = await request(app.callback())
        .post('/parking-spaces')
        .send({
          includeRentalObjectCodes: ['code-1'],
        })

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content[0].rent).toBeUndefined()
    })
  })

  describe('GET /parking-spaces/by-code/:rentalObjectCode', () => {
    it('should respond with 200 and include rent if rent is found', async () => {
      // Arrange
      const parkingSpace = factory.rentalObject.build({
        rentalObjectCode: 'code-1',
      })
      const rent = factory.rentalObjectRent.build({ amount: 1234 })
      const availability = factory.rentalObjectAvailabilityInfo.build({
        rentalObjectCode: 'code-1',
        rent,
      })
      jest
        .spyOn(rentalObjectAdapter, 'getParkingSpace')
        .mockResolvedValue({ ok: true, data: parkingSpace })
      jest
        .spyOn(tenfastAdapter, 'getAvailabilityForRentalObject')
        .mockResolvedValue({ ok: true, data: availability })

      // Act
      const res = await request(app.callback()).get(
        '/parking-spaces/by-code/code-1'
      )

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content.rent.amount).toBe(1234)
    })

    it('should respond with 200 and not include availability if availability is not found', async () => {
      // Arrange
      const parkingSpace = factory.rentalObject.build({
        rentalObjectCode: 'code-1',
        availabilityInfo: undefined,
      })
      jest
        .spyOn(rentalObjectAdapter, 'getParkingSpace')
        .mockResolvedValue({ ok: true, data: parkingSpace })
      jest
        .spyOn(tenfastAdapter, 'getAvailabilityForRentalObject')
        .mockResolvedValue({
          ok: false,
          err: 'could-not-find-rental-object',
        })

      // Act
      const res = await request(app.callback()).get(
        '/parking-spaces/by-code/code-1'
      )

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content.availability).toBeUndefined()
    })

    it('should respond with 404 if parking space is not found', async () => {
      // Arrange
      jest
        .spyOn(rentalObjectAdapter, 'getParkingSpace')
        .mockResolvedValue({ ok: false, err: 'parking-space-not-found' })

      // Act
      const res = await request(app.callback()).get(
        '/parking-spaces/by-code/notfound'
      )

      // Assert
      expect(res.status).toBe(404)
      expect(res.body.error).toBe(
        'An error occurred while fetching parking space by Rental Object Code: notfound'
      )
    })

    it('should respond with 500 if an unknown error occurs', async () => {
      // Arrange
      jest
        .spyOn(rentalObjectAdapter, 'getParkingSpace')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      // Act
      const res = await request(app.callback()).get(
        '/parking-spaces/by-code/err'
      )

      // Assert
      expect(res.status).toBe(500)
      expect(res.body.error).toBe(
        'An error occurred while fetching parking spaces.'
      )
    })
  })

  describe('GET /vacant-parkingspaces', () => {
    it.only('should return a list of vacant parking spaces with availability with rent if found', async () => {
      // Arrange
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
          availabilityInfo: undefined,
          residentialAreaCaption: 'Centrum',
          residentialAreaCode: 'CTR',
          vacantFrom: new Date('2023-10-01'),
        },
      ]
      const mockedAvailabilities = [
        factory.rentalObjectAvailabilityInfo.build({
          rentalObjectCode: '924-004-99-0008',
          rent: factory.rentalObjectRent.build({
            amount: 1234,
          }),
        }),
      ]
      jest.spyOn(tenfastAdapter, 'getLeases').mockResolvedValue({
        ok: true,
        data: [],
      })
      jest
        .spyOn(rentalObjectAdapter, 'getAllVacantParkingSpaces')
        .mockResolvedValue({ ok: true, data: mockedVacantParkingSpaces })
      jest
        .spyOn(tenfastAdapter, 'getRentalObjectAvailabilityInfo')
        .mockResolvedValue({ ok: true, data: mockedAvailabilities })

      // Act
      const res = await request(app.callback()).get('/vacant-parkingspaces')

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content[0].availabilityInfo.rent.amount).toBe(1234)
    })

    it('should return a list of vacant parking spaces without availability if availability is not found', async () => {
      // Arrange
      const mockedVacantParkingSpaces = factory.rentalObject.buildList(1, {
        availabilityInfo: undefined,
      })

      jest.spyOn(tenfastAdapter, 'getLeases').mockResolvedValue({
        ok: true,
        data: [],
      })
      jest
        .spyOn(rentalObjectAdapter, 'getAllVacantParkingSpaces')
        .mockResolvedValue({ ok: true, data: mockedVacantParkingSpaces })
      jest
        .spyOn(tenfastAdapter, 'getRentalObjectAvailabilityInfo')
        .mockResolvedValue({ ok: true, data: [] })

      // Act
      const res = await request(app.callback()).get('/vacant-parkingspaces')

      // console.log('res', res.body)
      // Assert
      // expect(res.body).toBe('hej')
      expect(res.status).toBe(200)

      expect(res.body.content[0].availabilityInfo).toBeUndefined()
    })

    it('should respond with 500 if fetching rents for vacant parking spaces fails', async () => {
      // Arrange
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
          rent: undefined,
          residentialAreaCaption: 'Centrum',
          residentialAreaCode: 'CTR',
          vacantFrom: new Date('2023-10-01'),
        },
      ]

      jest
        .spyOn(rentalObjectAdapter, 'getAllVacantParkingSpaces')
        .mockResolvedValue({ ok: true, data: mockedVacantParkingSpaces })
      jest
        .spyOn(tenfastAdapter, 'getRentalObjectAvailabilityInfo')
        .mockResolvedValue({ ok: false, err: 'could-not-find-rental-objects' })

      // Act
      const res = await request(app.callback()).get('/vacant-parkingspaces')

      // Assert
      expect(res.status).toBe(500)
      expect(res.body.error).toBe(
        'An error occurred while fetching availability for vacant parking spaces.'
      )
    })
  })

  describe('GET /rental-objects/by-code/:rentalObjectCode/availability', () => {
    it('should respond with 200 and the availability when found', async () => {
      // Arrange
      const rentalObjectCode = 'R1003'
      const rent = factory.rentalObjectRent.build({ amount: 1234 })
      const availability = factory.rentalObjectAvailabilityInfo.build({
        rentalObjectCode,
        rent,
      })
      jest
        .spyOn(tenfastAdapter, 'getAvailabilityForRentalObject')
        .mockResolvedValueOnce({ ok: true, data: availability })

      // Act
      const res = await request(app.callback()).get(
        `/rental-objects/by-code/${rentalObjectCode}/availability`
      )

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content.rent).toEqual(rent)
    })

    it('should respond with 404 if rent is not found', async () => {
      // Arrange
      const rentalObjectCode = 'NOTFOUND'
      jest
        .spyOn(tenfastAdapter, 'getAvailabilityForRentalObject')
        .mockResolvedValueOnce({
          ok: false,
          err: 'could-not-find-rental-object',
        })

      // Act
      const res = await request(app.callback()).get(
        `/rental-objects/by-code/${rentalObjectCode}/availability`
      )

      // Assert
      expect(res.status).toBe(404)
      expect(res.body.error).toBe(
        `Availability not found for rental object code: ${rentalObjectCode}`
      )
    })

    it('should respond with 500 if another error occurs', async () => {
      // Arrange
      const rentalObjectCode = 'ERROR'
      jest
        .spyOn(tenfastAdapter, 'getAvailabilityForRentalObject')
        .mockResolvedValueOnce({
          ok: false,
          err: 'could-not-parse-rental-object',
        })

      // Act
      const res = await request(app.callback()).get(
        `/rental-objects/by-code/${rentalObjectCode}/availability`
      )

      // Assert
      expect(res.status).toBe(500)
      expect(res.body.error).toBe(
        'An error occurred while fetching rental object availability.'
      )
    })

    it('should call tenfastAdapter.getAvailabilityForRentalObject with the correct rentalObjectCode', async () => {
      // Arrange
      const rentalObjectCode = 'R1003'
      const rent = factory.rentalObjectRent.build({ amount: 1234 })
      const availability = factory.rentalObjectAvailabilityInfo.build({
        rentalObjectCode,
        rent,
      })
      const spy = jest
        .spyOn(tenfastAdapter, 'getAvailabilityForRentalObject')
        .mockResolvedValueOnce({
          ok: true,
          data: availability,
        })

      // Act
      await request(app.callback()).get(
        `/rental-objects/by-code/${rentalObjectCode}/availability`
      )

      // Assert
      expect(spy).toHaveBeenCalledWith(rentalObjectCode, false)
    })
  })
  describe('POST /rental-objects/availabilities', () => {
    //TODO: skriv tester
  })
})
