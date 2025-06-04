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
    generateRouteMetadata: jest.fn(() => ({})),
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { routes } from '../index'
import * as propertyManagementAdapter from '../../../adapters/property-management-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as factory from '../../../../test/factories'
import { MaintenanceUnitInfo } from 'onecore-types'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('rental-property-service index', () => {
  describe('GET /rentalproperties/:id/rooms-with-material-choices', () => {
    it('responds', async () => {
      const materialChoicesSpy = jest
        .spyOn(propertyManagementAdapter, 'getRoomsWithMaterialChoices')
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
      expect(res.body.content.roomTypes).toBeDefined()
    })
  })
  describe('GET /maintenanceUnits/rentalPropertyId/:rentalPropertyId/:type?', () => {
    const maintenanceUnitInfoMock: MaintenanceUnitInfo[] =
      factory.maintenanceUnitInfo
        .buildList(4)
        .map((maintenanceUnitInfo, index) => ({
          ...maintenanceUnitInfo,
          type: index % 2 === 0 ? 'Tvättstuga' : 'Miljöbod',
        }))

    it('should return all maintenance units', async () => {
      const getMaintenanceUnitsForRentalPropertySpy = jest
        .spyOn(
          propertyManagementAdapter,
          'getMaintenanceUnitsForRentalProperty'
        )
        .mockResolvedValue(maintenanceUnitInfoMock)

      const res = await request(app.callback()).get(
        '/api/maintenanceUnits/rentalPropertyId/705-022-04-0201'
      )
      expect(res.status).toBe(200)
      expect(res.body.content).toEqual(maintenanceUnitInfoMock)
      expect(getMaintenanceUnitsForRentalPropertySpy).toHaveBeenCalledWith(
        '705-022-04-0201'
      )
    })

    it('should return maintenance units by type', async () => {
      const getMaintenanceUnitsForRentalPropertySpy = jest
        .spyOn(
          propertyManagementAdapter,
          'getMaintenanceUnitsForRentalProperty'
        )
        .mockResolvedValue(maintenanceUnitInfoMock)

      const res = await request(app.callback()).get(
        '/api/maintenanceUnits/rentalPropertyId/705-022-04-0201/Miljöbod'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([
        maintenanceUnitInfoMock[1],
        maintenanceUnitInfoMock[3],
      ])
      expect(getMaintenanceUnitsForRentalPropertySpy).toHaveBeenCalledWith(
        '705-022-04-0201'
      )
    })
  })

  describe('GET /maintenanceUnits/contactCode/:contactCode', () => {
    const maintenanceUnitInfoMock: MaintenanceUnitInfo[] =
      factory.maintenanceUnitInfo
        .buildList(4)
        .map((maintenanceUnitInfo, index) => ({
          ...maintenanceUnitInfo,
          type: index % 2 === 0 ? 'Tvättstuga' : 'Miljöbod',
        }))
    const leaseMock = factory.lease.build()

    it('should return all maintenance units', async () => {
      const getLeasesForContactCodeSpy = jest
        .spyOn(leasingAdapter, 'getLeasesForContactCode')
        .mockResolvedValue([leaseMock])
      const getMaintenanceUnitsForRentalPropertySpy = jest
        .spyOn(
          propertyManagementAdapter,
          'getMaintenanceUnitsForRentalProperty'
        )
        .mockResolvedValue(maintenanceUnitInfoMock)

      const res = await request(app.callback()).get(
        '/api/maintenanceUnits/contactCode/P965339'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual(maintenanceUnitInfoMock)
      expect(getLeasesForContactCodeSpy).toHaveBeenCalledWith('P965339', {
        includeUpcomingLeases: true,
        includeTerminatedLeases: false,
        includeContacts: false,
      })
      expect(getMaintenanceUnitsForRentalPropertySpy).toHaveBeenCalledWith(
        leaseMock.rentalPropertyId
      )
    })

    it('should return an empty list if there are no leases', async () => {
      const getLeasesForContactCodeSpy = jest
        .spyOn(leasingAdapter, 'getLeasesForContactCode')
        .mockResolvedValue([])

      const res = await request(app.callback()).get(
        '/api/maintenanceUnits/contactCode/P965339'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
      expect(res.body.reason).toBe('No maintenance units found')
      expect(getLeasesForContactCodeSpy).toHaveBeenCalledWith('P965339', {
        includeUpcomingLeases: true,
        includeTerminatedLeases: false,
        includeContacts: false,
      })
    })
  })

  describe('GET /vacant-parkingspaces', () => {
    it('responds with 500 if adapter fails', async () => {
      jest
        .spyOn(propertyManagementAdapter, 'getAllVacantParkingSpaces')
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
        .spyOn(propertyManagementAdapter, 'getAllVacantParkingSpaces')
        .mockResolvedValueOnce({ ok: true, data: [] })

      const res = await request(app.callback()).get('/vacant-parkingspaces')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
    })

    it('responds with 200 and a list of vacant parking spaces', async () => {
      const vacantParkingSpaces = factory.parkingSpace.buildList(2)

      jest
        .spyOn(propertyManagementAdapter, 'getAllVacantParkingSpaces')
        .mockResolvedValueOnce({ ok: true, data: vacantParkingSpaces })

      const res = await request(app.callback()).get('/vacant-parkingspaces')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rentalObjectCode: expect.any(String),
            address: expect.any(String),
            monthlyRent: expect.any(Number),
            districtCaption: expect.any(String),
            districtCode: expect.any(String),
            blockCaption: expect.any(String),
            blockCode: expect.any(String),
            objectTypeCaption: expect.any(String),
            objectTypeCode: expect.any(String),
            rentalObjectTypeCaption: expect.any(String),
            rentalObjectTypeCode: expect.any(String),
            vehicleSpaceCode: expect.any(String),
            vehicleSpaceCaption: expect.any(String),
            restidentalAreaCaption: expect.any(String),
            restidentalAreaCode: expect.any(String),
            vacantFrom: expect.any(String),
          }),
        ])
      )
    })
  })
})
