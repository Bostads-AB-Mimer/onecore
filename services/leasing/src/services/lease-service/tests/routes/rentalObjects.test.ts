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
        .spyOn(tenfastAdapter, 'getRentalObjectRents')
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
        'An error occurred while fetching rents for parking spaces.'
      )
    })

    it('should set rent on parking spaces if rent is found', async () => {
      // Arrange
      const parkingSpace = factory.rentalObject.build({
        rentalObjectCode: 'code-1',
      })
      const rent = factory.rentalObjectRent.build({
        rentalObjectCode: 'code-1',
        amount: 999,
      })
      jest
        .spyOn(rentalObjectAdapter, 'getParkingSpaces')
        .mockResolvedValue({ ok: true, data: [parkingSpace] })
      jest
        .spyOn(tenfastAdapter, 'getRentalObjectRents')
        .mockResolvedValue({ ok: true, data: [rent] })

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

    it('should not set rent if rent is not found for parking space', async () => {
      // Arrange
      const parkingSpace = factory.rentalObject.build({
        rentalObjectCode: 'code-1',
        rent: undefined,
      })
      jest
        .spyOn(rentalObjectAdapter, 'getParkingSpaces')
        .mockResolvedValue({ ok: true, data: [parkingSpace] })
      jest
        .spyOn(tenfastAdapter, 'getRentalObjectRents')
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
      jest
        .spyOn(rentalObjectAdapter, 'getParkingSpace')
        .mockResolvedValue({ ok: true, data: parkingSpace })
      jest
        .spyOn(tenfastAdapter, 'getRentForRentalObject')
        .mockResolvedValue({ ok: true, data: rent })

      // Act
      const res = await request(app.callback()).get(
        '/parking-spaces/by-code/code-1'
      )

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content.rent.amount).toBe(1234)
    })

    it('should respond with 200 and not include rent if rent is not found', async () => {
      // Arrange
      const parkingSpace = factory.rentalObject.build({
        rentalObjectCode: 'code-1',
        rent: undefined,
      })
      jest
        .spyOn(rentalObjectAdapter, 'getParkingSpace')
        .mockResolvedValue({ ok: true, data: parkingSpace })
      jest.spyOn(tenfastAdapter, 'getRentForRentalObject').mockResolvedValue({
        ok: false,
        err: 'could-not-find-rental-object',
      })

      // Act
      const res = await request(app.callback()).get(
        '/parking-spaces/by-code/code-1'
      )

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content.rent).toBeUndefined()
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
    it('should return a list of vacant parking spaces with rent if rent is found', async () => {
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
      const mockedRents = [
        factory.rentalObjectRent.build({
          rentalObjectCode: '924-004-99-0008',
          amount: 1234,
        }),
      ]
      jest
        .spyOn(rentalObjectAdapter, 'getAllVacantParkingSpaces')
        .mockResolvedValue({ ok: true, data: mockedVacantParkingSpaces })
      jest
        .spyOn(tenfastAdapter, 'getRentalObjectRents')
        .mockResolvedValue({ ok: true, data: mockedRents })

      // Act
      const res = await request(app.callback()).get('/vacant-parkingspaces')

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content[0].rent.amount).toBe(1234)
    })

    it('should return a list of vacant parking spaces without rent if rent is not found', async () => {
      // Arrange
      const mockedVacantParkingSpaces = factory.rentalObject.buildList(1, {
        rent: undefined,
      })

      jest
        .spyOn(rentalObjectAdapter, 'getAllVacantParkingSpaces')
        .mockResolvedValue({ ok: true, data: mockedVacantParkingSpaces })
      jest
        .spyOn(tenfastAdapter, 'getRentalObjectRents')
        .mockResolvedValue({ ok: true, data: [] })

      // Act
      const res = await request(app.callback()).get('/vacant-parkingspaces')

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content[0].rent).toBeUndefined()
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
        .spyOn(tenfastAdapter, 'getRentalObjectRents')
        .mockResolvedValue({ ok: false, err: 'could-not-find-rental-objects' })

      // Act
      const res = await request(app.callback()).get('/vacant-parkingspaces')

      // Assert
      expect(res.status).toBe(500)
      expect(res.body.error).toBe(
        'An error occurred while fetching rents for vacant parking spaces.'
      )
    })
  })

  describe('GET /rental-objects/by-code/:rentalObjectCode/rent', () => {
    it('should respond with 200 and the rent when found', async () => {
      // Arrange
      const rentalObjectCode = 'R1003'
      const rent = factory.rentalObjectRent.build({ amount: 1234 })
      jest
        .spyOn(tenfastAdapter, 'getRentForRentalObject')
        .mockResolvedValueOnce({ ok: true, data: rent })

      // Act
      const res = await request(app.callback()).get(
        `/rental-objects/by-code/${rentalObjectCode}/rent`
      )

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content).toEqual(rent)
    })

    it('should respond with 404 if rent is not found', async () => {
      // Arrange
      const rentalObjectCode = 'NOTFOUND'
      jest
        .spyOn(tenfastAdapter, 'getRentForRentalObject')
        .mockResolvedValueOnce({
          ok: false,
          err: 'could-not-find-rental-object',
        })

      // Act
      const res = await request(app.callback()).get(
        `/rental-objects/by-code/${rentalObjectCode}/rent`
      )

      // Assert
      expect(res.status).toBe(404)
      expect(res.body.error).toBe(
        `Rent not found for rental object code: ${rentalObjectCode}`
      )
    })

    it('should respond with 500 if another error occurs', async () => {
      // Arrange
      const rentalObjectCode = 'ERROR'
      jest
        .spyOn(tenfastAdapter, 'getRentForRentalObject')
        .mockResolvedValueOnce({
          ok: false,
          err: 'could-not-parse-rental-object',
        })

      // Act
      const res = await request(app.callback()).get(
        `/rental-objects/by-code/${rentalObjectCode}/rent`
      )

      // Assert
      expect(res.status).toBe(500)
      expect(res.body.error).toBe(
        'An error occurred while fetching rental object rent.'
      )
    })

    it('should call tenfastAdapter.getRentForRentalObject with the correct rentalObjectCode', async () => {
      // Arrange
      const rentalObjectCode = 'R1003'
      const rent = factory.rentalObjectRent.build({ amount: 1234 })
      const spy = jest
        .spyOn(tenfastAdapter, 'getRentForRentalObject')
        .mockResolvedValueOnce({ ok: true, data: rent })

      // Act
      await request(app.callback()).get(
        `/rental-objects/by-code/${rentalObjectCode}/rent`
      )

      // Assert
      expect(spy).toHaveBeenCalledWith(rentalObjectCode, false)
    })
  })
  describe('POST /rental-objects/rent', () => {
    //TODO: skriv tester
  })
})
