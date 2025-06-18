import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { z } from 'zod'

import { routes } from '../index'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'

import * as factory from '../../../../test/factories'
import {
  CompanySchema,
  PropertySchema,
  ResidenceSchema,
  RoomSchema,
  StaircaseSchema,
  MaintenanceUnitSchema,
  ResidenceByRentalIdSchema,
} from '../schemas'
import { LeaseStatus } from 'onecore-types'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)
describe('property-base-service', () => {
  describe('GET /propertyBase/companies', () => {
    it('returns 200 and a list of companies', async () => {
      const companiesMock = factory.company.buildList(3)
      const getCompaniesSpy = jest
        .spyOn(propertyBaseAdapter, 'getCompanies')
        .mockResolvedValueOnce({ ok: true, data: companiesMock })
      const res = await request(app.callback()).get('/propertyBase/companies')
      expect(res.status).toBe(200)
      expect(getCompaniesSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(companiesMock)
      )
      expect(() => z.array(CompanySchema).parse(res.body.content)).not.toThrow()
    })
  })

  describe('GET /propertyBase/properties', () => {
    it('returns 200 and a list of properties', async () => {
      const propertiesMock = factory.property.buildList(3)
      const getPropertiesSpy = jest
        .spyOn(propertyBaseAdapter, 'getProperties')
        .mockResolvedValueOnce({ ok: true, data: propertiesMock })

      const res = await request(app.callback()).get(
        `/propertyBase/properties?companyCode=123`
      )

      expect(res.status).toBe(200)
      expect(getPropertiesSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(propertiesMock)
      )
      expect(() =>
        z.array(PropertySchema).parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 400 if company code is missing', async () => {
      const res = await request(app.callback()).get(`/propertyBase/properties`)

      expect(res.status).toBe(400)
    })
  })

  describe('GET /propertyBase/properties/:propertyId', () => {
    it('returns 200 and a property', async () => {
      const propertyDetails = factory.propertyDetails.build()
      const getPropertyDetailsSpy = jest
        .spyOn(propertyBaseAdapter, 'getPropertyDetails')
        .mockResolvedValueOnce({ ok: true, data: propertyDetails })

      const res = await request(app.callback()).get(
        `/propertyBase/properties/${propertyDetails.id}`
      )

      expect(res.status).toBe(200)
      expect(getPropertyDetailsSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(propertyDetails)
      )
      expect(() => PropertySchema.parse(res.body.content)).not.toThrow()
    })

    it('returns 404 if no property is found', async () => {
      const getPropertyDetailsSpy = jest
        .spyOn(propertyBaseAdapter, 'getPropertyDetails')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/propertyBase/properties/1234567890'
      )

      expect(res.status).toBe(404)
      expect(getPropertyDetailsSpy).toHaveBeenCalled()
    })
  })

  describe('GET /propertyBase/residences', () => {
    it('returns 200 and a list of residences', async () => {
      const residences = factory.residence.buildList(3)
      const getResidencesSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidences')
        .mockResolvedValueOnce({ ok: true, data: residences })
      const res = await request(app.callback()).get(
        `/propertyBase/residences?buildingCode=202-002`
      )

      expect(res.status).toBe(200)
      expect(getResidencesSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(residences)
      )
      expect(() =>
        z.array(ResidenceSchema).parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 400 if building code is missing', async () => {
      const res = await request(app.callback()).get(`/propertyBase/residences`)

      expect(res.status).toBe(400)
    })
  })

  describe('GET /propertyBase/residence/rental-id/:rentalId', () => {
    it('returns 200 and a residence', async () => {
      const residenceDetails = factory.residenceByRentalIdDetails.build()
      const getResidenceDetailsSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValueOnce({ ok: true, data: residenceDetails })

      const res = await request(app.callback()).get(
        `/propertyBase/residence/rental-id/1234`
      )

      expect(res.status).toBe(200)
      expect(getResidenceDetailsSpy).toHaveBeenCalled()
      expect(() =>
        ResidenceByRentalIdSchema.parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 404 if no residence is found', async () => {
      const getResidenceDetailsSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        `/propertyBase/residence/rental-id/1234`
      )

      expect(res.status).toBe(404)
      expect(getResidenceDetailsSpy).toHaveBeenCalled()
    })
  })

  describe('GET /propertyBase/residence/:residenceId', () => {
    it('returns 200 and a residence', async () => {
      const residenceDetails = factory.residenceDetails.build()
      const getResidenceDetailsSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceDetails')
        .mockResolvedValueOnce({ ok: true, data: residenceDetails })

      const res = await request(app.callback()).get(
        `/propertyBase/residence/${residenceDetails.id}`
      )

      expect(res.status).toBe(200)
      expect(getResidenceDetailsSpy).toHaveBeenCalled()
      expect(() => ResidenceSchema.parse(res.body.content)).not.toThrow()
    })

    it('returns 200 and a residence with status', async () => {
      const residenceDetails = factory.residenceDetails.build({
        propertyObject: { rentalId: '1234' },
      })
      const getResidenceDetailsSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceDetails')
        .mockResolvedValueOnce({ ok: true, data: residenceDetails })

      const lease = factory.lease.build({ status: LeaseStatus.Current })
      const getLeasesSpy = jest
        .spyOn(leasingAdapter, 'getLeasesForPropertyId')
        .mockResolvedValueOnce([lease])

      const res = await request(app.callback()).get(
        `/propertyBase/residence/${residenceDetails.id}`
      )

      expect(res.status).toBe(200)
      expect(() => ResidenceSchema.parse(res.body.content)).not.toThrow()
      expect(res.body.content.status).toBe('LEASED')

      expect(getResidenceDetailsSpy).toHaveBeenCalled()
      expect(getLeasesSpy).toHaveBeenCalled()
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

  describe('GET /propertyBase/staircases', () => {
    it('returns 200 and a list of staircases', async () => {
      const staircasesMock = factory.staircase.buildList(3)
      const getStaircasesSpy = jest
        .spyOn(propertyBaseAdapter, 'getStaircases')
        .mockResolvedValueOnce({ ok: true, data: staircasesMock })

      const res = await request(app.callback()).get(
        '/propertyBase/staircases?buildingCode=002-002'
      )

      expect(res.status).toBe(200)
      expect(getStaircasesSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(staircasesMock)
      )
      expect(() =>
        z.array(StaircaseSchema).parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 400 if buildingCode query parameter is missing', async () => {
      const res = await request(app.callback()).get('/propertyBase/staircases')

      expect(res.status).toBe(400)
    })
  })

  describe('GET /propertyBase/rooms', () => {
    it('returns 400 if residenceId query parameter is missing', async () => {
      const res = await request(app.callback()).get('/propertyBase/rooms')

      expect(res.status).toBe(400)
    })

    it('returns 200 and a list of rooms', async () => {
      const roomsMock = factory.room.buildList(3)
      const getRoomsSpy = jest
        .spyOn(propertyBaseAdapter, 'getRooms')
        .mockResolvedValueOnce({ ok: true, data: roomsMock })

      const res = await request(app.callback()).get(
        '/propertyBase/rooms?residenceId=foo'
      )

      expect(res.status).toBe(200)
      expect(getRoomsSpy).toHaveBeenCalled()
      expect(() => z.array(RoomSchema).parse(res.body.content)).not.toThrow()
    })
  })

  describe('GET /propertyBase/maintenance-units/by-rental-property/:id', () => {
    it('returns 200 and a list of maintenance units for a rental property', async () => {
      const maintenanceUnitsMock = factory.maintenanceUnitInfo.buildList(3)

      const getMaintenanceUnitsSpy = jest
        .spyOn(propertyBaseAdapter, 'getMaintenanceUnitsForRentalProperty')
        .mockResolvedValueOnce({ ok: true, data: maintenanceUnitsMock })

      const res = await request(app.callback()).get(
        '/propertyBase/maintenance-units/by-rental-property/1234'
      )

      expect(res.status).toBe(200)
      expect(getMaintenanceUnitsSpy).toHaveBeenCalledWith('1234')
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(maintenanceUnitsMock)
      )
      expect(() =>
        z.array(MaintenanceUnitSchema).parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 500 if no maintenance units can be retrieved', async () => {
      const getMaintenanceUnitsSpy = jest
        .spyOn(propertyBaseAdapter, 'getMaintenanceUnitsForRentalProperty')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/propertyBase/maintenance-units/by-rental-property/1234'
      )

      expect(res.status).toBe(500)
      expect(getMaintenanceUnitsSpy).toHaveBeenCalledWith('1234')
    })
  })
})
