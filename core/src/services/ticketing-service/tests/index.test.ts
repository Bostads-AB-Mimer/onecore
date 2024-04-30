import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'
import * as propertyManagementAdapter from '../../../adapters/property-management-adapter'
import * as odooAdapter from '../adapters/odoo-adapter'
import { routes } from '../index'
import bodyParser from 'koa-bodyparser'
import { Lease, Contact, RentalPropertyInfo } from 'onecore-types'
import { OdooGetTicket, TicketOdoo } from '../adapters/odoo-adapter'
import {
  contactMockData,
  leaseMockData,
  rentalPropertyInfoMockData,
  ticketRequestMockData,
  ticketsMockData,
} from './mockData'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('ticketing-service index', () => {
  describe('GET /propertyInfo/:number', () => {
    let leaseMock: Lease,
      contactMock: Contact,
      rentalPropertyInfoMock: RentalPropertyInfo
    beforeEach(() => {
      leaseMock = leaseMockData
      contactMock = contactMockData
      rentalPropertyInfoMock = rentalPropertyInfoMockData
    })

    it('should handle leaseId case', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue(leaseMock)

      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      const res = await request(app.callback()).get(
        '/propertyInfo/123?typeOfNumber=leaseId'
      )

      expect(res.status).toBe(200)
      expect(getLeaseSpy).toHaveBeenCalledWith('123', 'true')
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('456')
    })

    it('should handle rentalPropertyId case', async () => {
      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      const getLeasesForPropertyIdSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForPropertyId')
        .mockResolvedValue([leaseMock])

      const res = await request(app.callback()).get(
        '/propertyInfo/456?typeOfNumber=rentalPropertyId'
      )

      expect(res.status).toBe(200)
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('456')
      expect(getLeasesForPropertyIdSpy).toHaveBeenCalledWith(
        '456',
        undefined,
        'true'
      )
    })

    it('should handle pnr case', async () => {
      const getLeasesForPnrSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForPnr')
        .mockResolvedValue([leaseMock])

      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      const res = await request(app.callback()).get(
        '/propertyInfo/123?typeOfNumber=pnr'
      )

      expect(res.status).toBe(200)
      expect(getLeasesForPnrSpy).toHaveBeenCalledWith('123', undefined, 'true')
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('456')
    })

    it('should handle phoneNumber case', async () => {
      const getContactForPhoneNumberSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactForPhoneNumber')
        .mockResolvedValue(contactMock)
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue(leaseMock)

      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      const res = await request(app.callback()).get(
        '/propertyInfo/1234567890?typeOfNumber=phoneNumber'
      )

      expect(res.status).toBe(200)
      expect(getContactForPhoneNumberSpy).toHaveBeenCalledWith('1234567890')
      expect(getLeaseSpy).toHaveBeenCalledWith('123', 'true')
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('456')
    })
  })

  describe('GET /ticketsByContactCode/:code', () => {
    let ticketsMock: OdooGetTicket[]
    beforeEach(() => {
      ticketsMock = ticketsMockData
    })
    it('should return tickets by contact code', async () => {
      const getTicketByContactCodeSpy = jest
        .spyOn(odooAdapter, 'getTicketByContactCode')
        .mockResolvedValue(ticketsMock)

      const res = await request(app.callback()).get(
        '/api/ticketsByContactCode/P174958'
      )

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('totalCount')
      expect(res.body.totalCount).toBe(2)
      expect(res.body).toHaveProperty('workOrders')
      expect(res.body.workOrders).toHaveLength(2)
      expect(getTicketByContactCodeSpy).toHaveBeenCalledWith('P174958')
    })
    it('should return 404 if no tickets found', async () => {
      const getTicketByContactCodeSpy = jest
        .spyOn(odooAdapter, 'getTicketByContactCode')
        .mockResolvedValue([])

      const res = await request(app.callback()).get(
        '/api/ticketsByContactCode/P174958'
      )

      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('No tickets found')
      expect(getTicketByContactCodeSpy).toHaveBeenCalledWith('P174958')
    })
    it('should return 500 if error', async () => {
      const getTicketByContactCodeSpy = jest
        .spyOn(odooAdapter, 'getTicketByContactCode')
        .mockRejectedValue(new Error('error'))

      const res = await request(app.callback()).get(
        '/api/ticketsByContactCode/P174958'
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getTicketByContactCodeSpy).toHaveBeenCalledWith('P174958')
    })
  })

  describe('POST /createTicket/:contactCode', () => {
    let ticketRequest: any
    beforeEach(() => {
      ticketRequest = ticketRequestMockData
    })

    it('should create ticket', async () => {
      const createNewTicketSpy = jest
        .spyOn(odooAdapter, 'createNewTicket')
        .mockResolvedValue(Promise.resolve(13))

      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMockData)

      const res = await request(app.callback())
        .post('/api/createTicket/P174958')
        .send(ticketRequest)

      expect(res.status).toBe(200)
      expect(res.body.data).toBeDefined()
      expect(createNewTicketSpy).toHaveBeenCalled()
      expect(getRentalPropertyInfoSpy).toHaveBeenCalled()
    })
  })
})
