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
  BuildingSchema,
  CompanySchema,
  PropertySchema,
  ResidenceSchema,
  RoomSchema,
  StaircaseSchema,
  MaintenanceUnitSchema,
  FacilityDetailsSchema,
  ResidenceSummarySchema,
} from '../schemas'
import { LeaseStatus } from '@onecore/types'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)
describe('@onecore/property-service', () => {
  describe('GET /property/buildings', () => {
    it('returns 200 and a list of buildings', async () => {
      const buildingsMock = factory.building.buildList(3)
      const getBuildingsSpy = jest
        .spyOn(propertyBaseAdapter, 'getBuildings')
        .mockResolvedValueOnce({ ok: true, data: buildingsMock })

      const res = await request(app.callback()).get(
        '/property/buildings?propertyCode=001-001'
      )

      expect(res.status).toBe(200)
      expect(getBuildingsSpy).toHaveBeenCalledWith('001-001')
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(buildingsMock)
      )
      expect(() =>
        z.array(BuildingSchema).parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 400 if property code is missing', async () => {
      const res = await request(app.callback()).get('/property/buildings')

      expect(res.status).toBe(400)
    })

    it('returns 500 if an error occurs', async () => {
      const getBuildingsSpy = jest
        .spyOn(propertyBaseAdapter, 'getBuildings')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/property/buildings?propertyCode=001-001'
      )

      expect(res.status).toBe(500)
      expect(getBuildingsSpy).toHaveBeenCalledWith('001-001')
    })
  })

  describe('GET /property/buildings/:id', () => {
    it('returns 200 and a building by id', async () => {
      const buildingMock = factory.building.build()
      const getBuildingSpy = jest
        .spyOn(propertyBaseAdapter, 'getBuildingById')
        .mockResolvedValueOnce({ ok: true, data: buildingMock })

      const res = await request(app.callback()).get(
        `/property/buildings/${buildingMock.id}`
      )

      expect(res.status).toBe(200)
      expect(getBuildingSpy).toHaveBeenCalledWith(buildingMock.id)
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(buildingMock)
      )
      expect(() => BuildingSchema.parse(res.body.content)).not.toThrow()
    })

    it('returns 404 if no building is found', async () => {
      const getBuildingSpy = jest
        .spyOn(propertyBaseAdapter, 'getBuildingById')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/property/buildings/building-id-123'
      )

      expect(res.status).toBe(404)
      expect(getBuildingSpy).toHaveBeenCalledWith('building-id-123')
    })

    it('returns 500 if an error occurs', async () => {
      const getBuildingSpy = jest
        .spyOn(propertyBaseAdapter, 'getBuildingById')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/property/buildings/building-id-123'
      )

      expect(res.status).toBe(500)
      expect(getBuildingSpy).toHaveBeenCalledWith('building-id-123')
    })
  })

  describe('GET /property/buildings/by-building-code/:buildingCode', () => {
    it('returns 200 and a building by code', async () => {
      const buildingMock = factory.building.build()
      const getBuildingSpy = jest
        .spyOn(propertyBaseAdapter, 'getBuildingByCode')
        .mockResolvedValueOnce({ ok: true, data: buildingMock })

      const res = await request(app.callback()).get(
        `/property/buildings/by-building-code/${buildingMock.code}`
      )

      expect(res.status).toBe(200)
      expect(getBuildingSpy).toHaveBeenCalledWith(buildingMock.code)
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(buildingMock)
      )
    })

    it('returns 404 if no building is found', async () => {
      const getBuildingSpy = jest
        .spyOn(propertyBaseAdapter, 'getBuildingByCode')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/property/buildings/by-building-code/123-456'
      )

      expect(res.status).toBe(404)
      expect(getBuildingSpy).toHaveBeenCalledWith('123-456')
    })

    it('returns 500 if an error occurs', async () => {
      const getBuildingSpy = jest
        .spyOn(propertyBaseAdapter, 'getBuildingByCode')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/property/buildings/by-building-code/123-456'
      )

      expect(res.status).toBe(500)
      expect(getBuildingSpy).toHaveBeenCalledWith('123-456')
    })
  })

  describe('GET /property/companies', () => {
    it('returns 200 and a list of companies', async () => {
      const companiesMock = factory.company.buildList(3)
      const getCompaniesSpy = jest
        .spyOn(propertyBaseAdapter, 'getCompanies')
        .mockResolvedValueOnce({ ok: true, data: companiesMock })
      const res = await request(app.callback()).get('/property/companies')
      expect(res.status).toBe(200)
      expect(getCompaniesSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(companiesMock)
      )
      expect(() => z.array(CompanySchema).parse(res.body.content)).not.toThrow()
    })
  })

  describe('GET /property/properties', () => {
    it('returns 200 and a list of properties', async () => {
      const propertiesMock = factory.property.buildList(3)
      const getPropertiesSpy = jest
        .spyOn(propertyBaseAdapter, 'getProperties')
        .mockResolvedValueOnce({ ok: true, data: propertiesMock })

      const res = await request(app.callback()).get(
        `/property/properties?companyCode=123`
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
      const res = await request(app.callback()).get(`/property/properties`)

      expect(res.status).toBe(400)
    })
  })

  describe('GET /property/properties/:propertyId', () => {
    it('returns 200 and a property', async () => {
      const propertyDetails = factory.propertyDetails.build()
      const getPropertyDetailsSpy = jest
        .spyOn(propertyBaseAdapter, 'getPropertyDetails')
        .mockResolvedValueOnce({ ok: true, data: propertyDetails })

      const res = await request(app.callback()).get(
        `/property/properties/${propertyDetails.id}`
      )

      expect(res.status).toBe(200)
      expect(getPropertyDetailsSpy).toHaveBeenCalledWith(propertyDetails.id)
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
        '/property/properties/1234567890'
      )

      expect(res.status).toBe(404)
      expect(getPropertyDetailsSpy).toHaveBeenCalled()
    })
  })

  describe('GET /property/properties/search', () => {
    it('returns 200 and a list of properties', async () => {
      const propertiesMock = factory.property.buildList(3)
      const getPropertiesSpy = jest
        .spyOn(propertyBaseAdapter, 'searchProperties')
        .mockResolvedValueOnce({ ok: true, data: propertiesMock })

      const res = await request(app.callback()).get(
        `/property/properties/search?q=KVARTER%201`
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

    it('returns 400 if query parameter is missing', async () => {
      const res = await request(app.callback()).get(
        `/property/properties/search`
      )

      expect(res.status).toBe(400)
    })

    it('returns 500 if an error occurs', async () => {
      const getPropertiesSpy = jest
        .spyOn(propertyBaseAdapter, 'searchProperties')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        `/property/properties/search?q=KVARTER%201`
      )

      expect(res.status).toBe(500)
      expect(getPropertiesSpy).toHaveBeenCalled()
    })
  })

  describe('GET /property/residences', () => {
    it('returns 200 and a list of residences', async () => {
      const residences = factory.residence.buildList(3)
      const getResidencesSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidences')
        .mockResolvedValueOnce({ ok: true, data: residences })
      const res = await request(app.callback()).get(
        `/property/residences?buildingCode=202-002`
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
      const res = await request(app.callback()).get(`/property/residences`)

      expect(res.status).toBe(400)
    })
  })

  describe('GET /property/residences/by-rental-id/:rentalId', () => {
    it('returns 200 and a residence', async () => {
      const residenceDetails = factory.residenceDetails.build()
      const getResidenceByRentalIdSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValueOnce({
          ok: true,
          data: residenceDetails,
        })

      const res = await request(app.callback()).get(
        `/property/residences/by-rental-id/1234`
      )

      expect(res.status).toBe(200)
      expect(getResidenceByRentalIdSpy).toHaveBeenCalled()
      expect(() => ResidenceSchema.parse(res.body.content)).not.toThrow()
    })

    it('returns 200 and a residence with status', async () => {
      const residenceDetails = factory.residenceDetails.build({
        propertyObject: { rentalId: '1234' },
      })
      const getResidenceByRentalIdSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValueOnce({
          ok: true,
          data: residenceDetails,
        })

      const lease = factory.lease.build({ status: LeaseStatus.Current })
      const getLeasesSpy = jest
        .spyOn(leasingAdapter, 'getLeasesForPropertyId')
        .mockResolvedValueOnce([lease])

      const res = await request(app.callback()).get(
        `/property/residences/by-rental-id/1234`
      )

      expect(res.status).toBe(200)
      expect(() => ResidenceSchema.parse(res.body.content)).not.toThrow()
      expect(res.body.content.status).toBe('LEASED')

      expect(getResidenceByRentalIdSpy).toHaveBeenCalled()
      expect(getLeasesSpy).toHaveBeenCalled()
    })

    it('returns 404 if no residence is found', async () => {
      const getResidenceByRentalIdSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        `/property/residences/by-rental-id/1234`
      )

      expect(res.status).toBe(404)
      expect(getResidenceByRentalIdSpy).toHaveBeenCalled()
    })
  })

  describe('GET /property/residences/:residenceId', () => {
    it('returns 200 and a residence', async () => {
      const residenceDetails = factory.residenceDetails.build()
      const getResidenceDetailsSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceDetails')
        .mockResolvedValueOnce({ ok: true, data: residenceDetails })

      const res = await request(app.callback()).get(
        `/property/residences/${residenceDetails.id}`
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
        `/property/residences/${residenceDetails.id}`
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
        `/property/residences/${residence.id}`
      )

      expect(res.status).toBe(404)
      expect(getResidenceDetailsSpy).toHaveBeenCalled()
    })
  })

  describe('GET /property/staircases', () => {
    it('returns 200 and a list of staircases', async () => {
      const staircasesMock = factory.staircase.buildList(3)
      const getStaircasesSpy = jest
        .spyOn(propertyBaseAdapter, 'getStaircases')
        .mockResolvedValueOnce({ ok: true, data: staircasesMock })

      const res = await request(app.callback()).get(
        '/property/staircases?buildingCode=002-002'
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
      const res = await request(app.callback()).get('/property/staircases')

      expect(res.status).toBe(400)
    })
  })

  describe('GET /property/rooms', () => {
    it('returns 400 if residenceId query parameter is missing', async () => {
      const res = await request(app.callback()).get('/property/rooms')

      expect(res.status).toBe(400)
    })

    it('returns 200 and a list of rooms', async () => {
      const roomsMock = factory.room.buildList(3)
      const getRoomsSpy = jest
        .spyOn(propertyBaseAdapter, 'getRooms')
        .mockResolvedValueOnce({ ok: true, data: roomsMock })

      const res = await request(app.callback()).get(
        '/property/rooms?residenceId=foo'
      )

      expect(res.status).toBe(200)
      expect(getRoomsSpy).toHaveBeenCalled()
      expect(() => z.array(RoomSchema).parse(res.body.content)).not.toThrow()
    })
  })

  describe('GET /property/maintenance-units/by-rental-id/:id', () => {
    it('returns 200 and a list of maintenance units for a rental property', async () => {
      const maintenanceUnitsMock =
        factory.propertyBaseMaintenanceUnit.buildList(3)

      const getMaintenanceUnitsSpy = jest
        .spyOn(propertyBaseAdapter, 'getMaintenanceUnitsForRentalProperty')
        .mockResolvedValueOnce({ ok: true, data: maintenanceUnitsMock })

      const res = await request(app.callback()).get(
        '/property/maintenance-units/by-rental-id/1234'
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
        '/property/maintenance-units/by-rental-id/1234'
      )

      expect(res.status).toBe(500)
      expect(getMaintenanceUnitsSpy).toHaveBeenCalledWith('1234')
    })
  })

  describe('GET /property/maintenance-units/by-building-code/:buildingCode', () => {
    it('returns 200 and a list of maintenance units for a building', async () => {
      const maintenanceUnitsMock =
        factory.propertyBaseMaintenanceUnit.buildList(3)

      const getMaintenanceUnitsSpy = jest
        .spyOn(propertyBaseAdapter, 'getMaintenanceUnitsByBuildingCode')
        .mockResolvedValueOnce({ ok: true, data: maintenanceUnitsMock })

      const res = await request(app.callback()).get(
        '/propertyBase/maintenance-units/by-building-code/123-456'
      )

      expect(res.status).toBe(200)
      expect(getMaintenanceUnitsSpy).toHaveBeenCalledWith('123-456')
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(maintenanceUnitsMock)
      )
      expect(() =>
        z.array(MaintenanceUnitSchema).parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 404 if building code is not found', async () => {
      const getMaintenanceUnitsSpy = jest
        .spyOn(propertyBaseAdapter, 'getMaintenanceUnitsByBuildingCode')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/propertyBase/maintenance-units/by-building-code/123-456'
      )

      expect(res.status).toBe(404)
      expect(getMaintenanceUnitsSpy).toHaveBeenCalledWith('123-456')
    })

    it('returns 500 if no maintenance units can be retrieved', async () => {
      const getMaintenanceUnitsSpy = jest
        .spyOn(propertyBaseAdapter, 'getMaintenanceUnitsByBuildingCode')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/propertyBase/maintenance-units/by-building-code/123-456'
      )

      expect(res.status).toBe(500)
      expect(getMaintenanceUnitsSpy).toHaveBeenCalledWith('123-456')
    })
  })

  describe('GET /property/facilities/by-rental-id/:rentalId', () => {
    it('returns 200 and a facility', async () => {
      const facilityMock = factory.facilityDetails.build()
      const getFacilitySpy = jest
        .spyOn(propertyBaseAdapter, 'getFacilityByRentalId')
        .mockResolvedValueOnce({ ok: true, data: facilityMock })

      const res = await request(app.callback()).get(
        '/property/facilities/by-rental-id/1234'
      )

      expect(res.status).toBe(200)
      expect(getFacilitySpy).toHaveBeenCalledWith('1234')
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(facilityMock)
      )
      expect(() => FacilityDetailsSchema.parse(res.body.content)).not.toThrow()
    })

    it('returns 404 if no facility is found', async () => {
      const getFacilitySpy = jest
        .spyOn(propertyBaseAdapter, 'getFacilityByRentalId')
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        '/property/facilities/by-rental-id/1234'
      )

      expect(res.status).toBe(404)
      expect(getFacilitySpy).toHaveBeenCalledWith('1234')
    })

    it('returns 500 if an error occurs', async () => {
      const getFacilitySpy = jest
        .spyOn(propertyBaseAdapter, 'getFacilityByRentalId')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/property/facilities/by-rental-id/1234'
      )

      expect(res.status).toBe(500)
      expect(getFacilitySpy).toHaveBeenCalledWith('1234')
    })
  })

  describe('GET /property/maintenance-units/by-property-code/:code', () => {
    it('returns 200 and a list of maintenance units for a property', async () => {
      const maintenanceUnitsMock =
        factory.propertyBaseMaintenanceUnit.buildList(3)

      const getMaintenanceUnitsSpy = jest
        .spyOn(propertyBaseAdapter, 'getMaintenanceUnitsByPropertyCode')
        .mockResolvedValueOnce({ ok: true, data: maintenanceUnitsMock })

      const res = await request(app.callback()).get(
        '/property/maintenance-units/by-property-code/1234'
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
        .spyOn(propertyBaseAdapter, 'getMaintenanceUnitsByPropertyCode')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/property/maintenance-units/by-property-code/1234'
      )

      expect(res.status).toBe(500)
      expect(getMaintenanceUnitsSpy).toHaveBeenCalledWith('1234')
    })
  })

  describe('GET /property/residences/summary/by-building-code/:buildingCode', () => {
    it('returns 200 and a list of residence summaries', async () => {
      const residenceSummariesMock = factory.residenceSummary.buildList(3)
      const getResidenceSummariesSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceSummariesByBuildingCode')
        .mockResolvedValueOnce({ ok: true, data: residenceSummariesMock })

      const res = await request(app.callback()).get(
        '/property/residences/summary/by-building-code/202-002'
      )

      expect(res.status).toBe(200)
      expect(getResidenceSummariesSpy).toHaveBeenCalledWith(
        '202-002',
        undefined
      )
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(residenceSummariesMock)
      )
      expect(() =>
        z.array(ResidenceSummarySchema).parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 200 and a list of residence summaries filtered by staircase code', async () => {
      const residenceSummariesMock = factory.residenceSummary.buildList(2)
      const getResidenceSummariesSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceSummariesByBuildingCode')
        .mockResolvedValueOnce({ ok: true, data: residenceSummariesMock })

      const res = await request(app.callback()).get(
        '/property/residences/summary/by-building-code/202-002?staircaseCode=A1'
      )

      expect(res.status).toBe(200)
      expect(getResidenceSummariesSpy).toHaveBeenCalledWith('202-002', 'A1')
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(residenceSummariesMock)
      )
      expect(() =>
        z.array(ResidenceSummarySchema).parse(res.body.content)
      ).not.toThrow()
    })

    it('returns 500 if an error occurs', async () => {
      const getResidenceSummariesSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceSummariesByBuildingCode')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/property/residences/summary/by-building-code/202-002'
      )

      expect(res.status).toBe(500)
      expect(getResidenceSummariesSpy).toHaveBeenCalledWith(
        '202-002',
        undefined
      )
    })
  })
})
