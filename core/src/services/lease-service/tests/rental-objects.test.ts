import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as leasingAdapter from '../../../adapters/leasing-adapter'

import * as factory from '../../../../test/factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)

describe('GET /vacant-parkingspaces', () => {
  it('responds with 500 if adapter fails', async () => {
    jest
      .spyOn(leasingAdapter, 'getAllVacantParkingSpaces')
      .mockResolvedValueOnce({
        ok: false,
        err: 'get-all-vacant-parking-spaces-failed',
      })

    const res = await request(app.callback()).get('/vacant-parkingspaces')

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })

  it('responds with 200 and an empty list if no parking spaces are vacant', async () => {
    jest
      .spyOn(leasingAdapter, 'getAllVacantParkingSpaces')
      .mockResolvedValueOnce({ ok: true, data: [] })

    const res = await request(app.callback()).get('/vacant-parkingspaces')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([])
  })

  it('responds with 200 and a list of vacant parking spaces', async () => {
    const vacantParkingSpaces = factory.parkingSpace.buildList(2)

    jest
      .spyOn(leasingAdapter, 'getAllVacantParkingSpaces')
      .mockResolvedValueOnce({ ok: true, data: vacantParkingSpaces })

    const res = await request(app.callback()).get('/vacant-parkingspaces')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rentalObjectCode: expect.any(String),
          address: expect.any(String),
          rent: expect.objectContaining({
            amount: expect.any(Number),
          }),
          districtCaption: expect.any(String),
          districtCode: expect.any(String),
          propertyCaption: expect.any(String),
          propertyCode: expect.any(String),
          objectTypeCaption: expect.any(String),
          objectTypeCode: expect.any(String),
          residentialAreaCaption: expect.any(String),
          residentialAreaCode: expect.any(String),
          vacantFrom: expect.any(String),
        }),
      ])
    )
  })
})

describe('GET /parking-spaces/by-code/:rentalObjectCode', () => {
  it('should respond with 200 and the parking space when found', async () => {
    //Arrange
    const rentalObject = factory.parkingSpace.build()
    jest
      .spyOn(leasingAdapter, 'getParkingSpaceByCode')
      .mockResolvedValueOnce({ ok: true, data: rentalObject })

    //Act
    const res = await request(app.callback()).get(
      `/parking-spaces/by-code/${rentalObject.rentalObjectCode}`
    )

    //Assert
    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(
      expect.objectContaining({
        ...rentalObject,
        vacantFrom: rentalObject.vacantFrom?.toISOString(),
      })
    )
  })

  it('should respond with 500 if adapter returns not ok', async () => {
    // Arrange
    jest
      .spyOn(leasingAdapter, 'getParkingSpaceByCode')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    // Act
    const res = await request(app.callback()).get(
      '/parking-spaces/by-code/ANYCODE'
    )

    // Assert
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ error: 'Unknown error' })
  })

  it('should call leasingAdapter.getParkingSpaceByCode with the correct rentalObjectCode', async () => {
    // Arrange
    const rentalObject = factory.parkingSpace.build()
    const spy = jest
      .spyOn(leasingAdapter, 'getParkingSpaceByCode')
      .mockResolvedValueOnce({ ok: true, data: rentalObject })

    // Act
    await request(app.callback()).get(
      `/parking-spaces/by-code/${rentalObject.rentalObjectCode}`
    )

    // Assert
    expect(spy).toHaveBeenCalledWith(rentalObject.rentalObjectCode)
  })
})
describe('GET /rental-objects/by-code/:rentalObjectCode/rent', () => {
  describe('GET /rental-objects/by-code/:rentalObjectCode/rent', () => {
    it('should respond with 200 and the rent when found', async () => {
      // Arrange
      const rentalObjectCode = 'R1003'
      const rent = 1234
      jest
        .spyOn(leasingAdapter, 'getRentalObjectRentByCode')
        .mockResolvedValueOnce({ ok: true, data: rent })

      // Act
      const res = await request(app.callback()).get(
        `/rental-objects/by-code/${rentalObjectCode}/rent`
      )

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content).toBe(rent)
    })

    it('should respond with 404 if adapter returns rent-not-found', async () => {
      // Arrange
      const rentalObjectCode = 'NOTFOUND'
      jest
        .spyOn(leasingAdapter, 'getRentalObjectRentByCode')
        .mockResolvedValueOnce({ ok: false, err: 'rent-not-found' })

      // Act
      const res = await request(app.callback()).get(
        `/rental-objects/by-code/${rentalObjectCode}/rent`
      )

      // Assert
      expect(res.status).toBe(404)
      expect(res.body).toMatchObject({ error: 'Rent not found' })
    })

    it('should respond with 500 if adapter returns unknown', async () => {
      // Arrange
      const rentalObjectCode = 'ERROR'
      jest
        .spyOn(leasingAdapter, 'getRentalObjectRentByCode')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      // Act
      const res = await request(app.callback()).get(
        `/rental-objects/by-code/${rentalObjectCode}/rent`
      )

      // Assert
      expect(res.status).toBe(500)
      expect(res.body).toMatchObject({
        error: `Unexpected error when getting rent for ${rentalObjectCode}`,
      })
    })

    it('should call leasingAdapter.getRentalObjectRentByCode with the correct rentalObjectCode', async () => {
      // Arrange
      const rentalObjectCode = 'R1003'
      const spy = jest
        .spyOn(leasingAdapter, 'getRentalObjectRentByCode')
        .mockResolvedValueOnce({ ok: true, data: 1234 })

      // Act
      await request(app.callback()).get(
        `/rental-objects/by-code/${rentalObjectCode}/rent`
      )

      // Assert
      expect(spy).toHaveBeenCalledWith(rentalObjectCode)
    })
  })

  describe('POST /rental-objects/rent', () => {
    it('should respond with 200 and the rents when found', async () => {
      // Arrange
      const rentalObjectCodes = ['R1001', 'R1002']
      const rents = [1000, 2000]
      jest
        .spyOn(leasingAdapter, 'getRentalObjectRents')
        .mockResolvedValueOnce({ ok: true, data: rents })

      // Act
      const res = await request(app.callback())
        .post('/rental-objects/rent')
        .send({ rentalObjectCodes })

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content).toEqual(rents)
    })

    it('should respond with 404 if adapter returns rents-not-found', async () => {
      // Arrange
      const rentalObjectCodes = ['NOTFOUND1', 'NOTFOUND2']
      jest
        .spyOn(leasingAdapter, 'getRentalObjectRents')
        .mockResolvedValueOnce({ ok: false, err: 'rents-not-found' })

      // Act
      const res = await request(app.callback())
        .post('/rental-objects/rent')
        .send({ rentalObjectCodes })

      // Assert
      expect(res.status).toBe(404)
      expect(res.body).toMatchObject({ error: 'Rents not found' })
    })

    it('should respond with 500 if adapter returns unknown', async () => {
      // Arrange
      const rentalObjectCodes = ['ERROR1', 'ERROR2']
      jest
        .spyOn(leasingAdapter, 'getRentalObjectRents')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      // Act
      const res = await request(app.callback())
        .post('/rental-objects/rent')
        .send({ rentalObjectCodes })

      // Assert
      expect(res.status).toBe(500)
      expect(res.body).toMatchObject({
        error: `Unexpected error when getting rent for ${rentalObjectCodes.join(', ')}`,
      })
    })

    it('should call leasingAdapter.getRentalObjectRents with the correct rentalObjectCodes', async () => {
      // Arrange
      const rentalObjectCodes = ['R1001', 'R1002']
      const spy = jest
        .spyOn(leasingAdapter, 'getRentalObjectRents')
        .mockResolvedValueOnce({ ok: true, data: [1000, 2000] })

      // Act
      await request(app.callback())
        .post('/rental-objects/rent')
        .send({ rentalObjectCodes })

      // Assert
      expect(spy).toHaveBeenCalledWith(rentalObjectCodes)
    })

    it('should handle missing rentalObjectCodes as empty array', async () => {
      // Arrange
      jest
        .spyOn(leasingAdapter, 'getRentalObjectRents')
        .mockResolvedValueOnce({ ok: true, data: [] })

      // Act
      const res = await request(app.callback())
        .post('/rental-objects/rent')
        .send({})

      // Assert
      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })
  })
})
