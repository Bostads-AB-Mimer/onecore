import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'
import * as propertyManagementAdapter from '../../../adapters/property-management-adapter'
import * as communicationAdapter from '../../../adapters/communication-adapter'
import * as odooAdapter from '../adapters/odoo-adapter'
import { routes } from '../index'
import bodyParser from 'koa-bodyparser'
import {
  Lease,
  Contact,
  RentalPropertyInfo,
  MaintenanceUnitInfo,
} from 'onecore-types'
import { OdooGetTicket } from '../adapters/odoo-adapter'
import {
  contactMockData,
  leaseMockData,
  rentalPropertyInfoMockData,
  ticketRequestMockData,
  ticketsMockData,
} from './mockData'

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
    loggedAxios: {
      defaults: {},
    },
    generateRouteMetadata: jest.fn(() => ({})),
  }
})

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
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('705-022-04-0201')
      expect(res.body.content).toBeDefined()
    })

    it('should handle rentalPropertyId case', async () => {
      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      const getLeasesForPropertyIdSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForPropertyId')
        .mockResolvedValue([leaseMock])

      const res = await request(app.callback()).get(
        '/propertyInfo/705-022-04-0201?typeOfNumber=rentalPropertyId'
      )

      expect(res.status).toBe(200)
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('705-022-04-0201')
      expect(getLeasesForPropertyIdSpy).toHaveBeenCalledWith(
        '705-022-04-0201',
        undefined,
        'true'
      )
      expect(res.body.content).toBeDefined()
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
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('705-022-04-0201')
      expect(res.body.content).toBeDefined()
    })

    it('should handle phoneNumber case', async () => {
      const getContactByPhoneNumberSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactByPhoneNumber')
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
      expect(getContactByPhoneNumberSpy).toHaveBeenCalledWith('1234567890')
      expect(getLeaseSpy).toHaveBeenCalledWith('123', 'true')
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('705-022-04-0201')
      expect(res.body.content).toBeDefined()
    })

    it('should handle contactCode case', async () => {
      const getContactByContactCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValue({ ok: true, data: contactMock })
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue(leaseMock)

      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      const res = await request(app.callback()).get(
        '/propertyInfo/P965339?typeOfNumber=contactCode'
      )

      expect(res.status).toBe(200)
      expect(getContactByContactCodeSpy).toHaveBeenCalledWith('P965339')
      expect(getLeaseSpy).toHaveBeenCalledWith('123', 'true')
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('705-022-04-0201')
      expect(res.body.content).toBeDefined()
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
      expect(res.body.content).toHaveProperty('totalCount')
      expect(res.body.content.totalCount).toBe(2)
      expect(res.body.content).toHaveProperty('workOrders')
      expect(res.body.content.workOrders).toHaveLength(2)
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
    let ticketRequestMock: any
    beforeEach(() => {
      ticketRequestMock = ticketRequestMockData
    })

    it('should create ticket', async () => {
      const getMaintenanceTeamIdSpy = jest
        .spyOn(odooAdapter, 'getMaintenanceTeamId')
        .mockResolvedValue(1)

      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMockData)

      const getLeasesForPropertyIdSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForPropertyId')
        .mockResolvedValue([leaseMockData])

      const createLeaseRecordSpy = jest
        .spyOn(odooAdapter, 'createLeaseRecord')
        .mockResolvedValue(1)

      const createRentalPropertyRecordSpy = jest
        .spyOn(odooAdapter, 'createRentalPropertyRecord')
        .mockResolvedValue(1)

      const createTenantRecordSpy = jest
        .spyOn(odooAdapter, 'createTenantRecord')
        .mockResolvedValue(1)

      const createMaintenanceUnitRecordSpy = jest
        .spyOn(odooAdapter, 'createMaintenanceUnitRecord')
        .mockResolvedValue(1)

      const createTicketSpy = jest
        .spyOn(odooAdapter, 'createTicket')
        .mockResolvedValue(Promise.resolve(13))
      const res = await request(app.callback())
        .post('/api/createTicket/P174958')
        .send(ticketRequestMock)

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(createTicketSpy).toHaveBeenCalled()
      expect(getRentalPropertyInfoSpy).toHaveBeenCalled()
      expect(getLeasesForPropertyIdSpy).toHaveBeenCalled()
      expect(getMaintenanceTeamIdSpy).toHaveBeenCalled()
      expect(createLeaseRecordSpy).toHaveBeenCalled()
      expect(createRentalPropertyRecordSpy).toHaveBeenCalled()
      expect(createTenantRecordSpy).toHaveBeenCalled()
      expect(createMaintenanceUnitRecordSpy).toHaveBeenCalled()
    })
  })

  describe('POST /closeTicket/:ticketId', () => {
    it('should close ticket', async () => {
      const closeTicketSpy = jest
        .spyOn(odooAdapter, 'closeTicket')
        .mockResolvedValue(Promise.resolve(true))
      const res = await request(app.callback()).post('/api/closeTicket/13')

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(closeTicketSpy).toHaveBeenCalled()
    })
  })

  describe('POST /updateTicket/:ticketId', () => {
    const ticketId = 13
    const message = 'test'
    const addMessageToTicketSpy = jest
      .spyOn(odooAdapter, 'addMessageToTicket')
      .mockResolvedValue(Promise.resolve(ticketId))

    beforeEach(() => {
      addMessageToTicketSpy.mockClear()
    })

    it('should update ticket', async () => {
      const res = await request(app.callback())
        .post(`/api/updateTicket/${ticketId}`)
        .send({ message })

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(addMessageToTicketSpy).toHaveBeenCalledWith(ticketId, {
        body: message,
      })
    })

    it('should return 400 if message body is missing', async () => {
      const res = await request(app.callback())
        .post(`/api/updateTicket/${ticketId}`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.reason).toBe('message is missing from the request body')
      expect(addMessageToTicketSpy).not.toHaveBeenCalled()
    })
  })

  describe('POST /sendTicketMessageSms', () => {
    const sendTicketMessageSmsSpy = jest.spyOn(
      communicationAdapter,
      'sendTicketMessageSms'
    )

    beforeEach(() => {
      sendTicketMessageSmsSpy.mockReset()
    })

    it('should return 200', async () => {
      sendTicketMessageSmsSpy.mockResolvedValue(
        Promise.resolve({ ok: true, data: {} })
      )
      const res = await request(app.callback())
        .post('/api/sendTicketMessageSms')
        .send({
          phoneNumber: '1234567890',
          message: 'test',
        })

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(sendTicketMessageSmsSpy).toHaveBeenCalled()
    })

    it('should return 400 if phoneNumber or message are missing', async () => {
      sendTicketMessageSmsSpy.mockResolvedValue(
        Promise.resolve({ ok: true, data: {} })
      )

      const resMissingPhoneNumber = await request(app.callback())
        .post('/api/sendTicketMessageSms')
        .send({
          message: 'test',
        })

      expect(resMissingPhoneNumber.status).toBe(400)
      expect(resMissingPhoneNumber.body.reason).toBeDefined()
      expect(sendTicketMessageSmsSpy).not.toHaveBeenCalled()

      const resMissingMessage = await request(app.callback())
        .post('/api/sendTicketMessageSms')
        .send({
          phoneNumber: '1234567890',
        })

      expect(resMissingMessage.status).toBe(400)
      expect(resMissingMessage.body.reason).toBeDefined()
      expect(sendTicketMessageSmsSpy).not.toHaveBeenCalled()
    })
  })

  describe('POST /sendTicketMessageEmail', () => {
    const sendTicketMessageEmailSpy = jest.spyOn(
      communicationAdapter,
      'sendTicketMessageEmail'
    )

    beforeEach(() => {
      sendTicketMessageEmailSpy.mockReset()
    })

    it('should return 200', async () => {
      sendTicketMessageEmailSpy.mockResolvedValue(
        Promise.resolve({ ok: true, data: {} })
      )
      const res = await request(app.callback())
        .post('/api/sendTicketMessageEmail')
        .send({
          to: 'hello@example.com',
          subject: 'subject',
          message: 'hello',
        })

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(sendTicketMessageEmailSpy).toHaveBeenCalled()
    })

    it('should return 400 if to, subject or message are missing', async () => {
      sendTicketMessageEmailSpy.mockResolvedValue(
        Promise.resolve({ ok: true, data: {} })
      )

      const resMissingTo = await request(app.callback())
        .post('/api/sendTicketMessageEmail')
        .send({
          subject: 'subject',
          message: 'hello',
        })

      expect(resMissingTo.status).toBe(400)
      expect(resMissingTo.body.reason).toBeDefined()
      expect(sendTicketMessageEmailSpy).not.toHaveBeenCalled()

      const resMissingMessage = await request(app.callback())
        .post('/api/sendTicketMessageEmail')
        .send({
          to: 'hello@example.com',
          subject: 'subject',
        })

      expect(resMissingMessage.status).toBe(400)
      expect(resMissingMessage.body.reason).toBeDefined()
      expect(sendTicketMessageEmailSpy).not.toHaveBeenCalled()

      const resMissingSubject = await request(app.callback())
        .post('/api/sendTicketMessageEmail')
        .send({
          to: 'hello@example.com',
          message: 'hello',
        })

      expect(resMissingSubject.status).toBe(400)
      expect(resMissingSubject.body.reason).toBeDefined()
      expect(sendTicketMessageEmailSpy).not.toHaveBeenCalled()
    })
  })

  describe('GET /maintenanceUnitsByRentalPropertyId/:rentalPropertyId/:type?', () => {
    let maintenanceUnitsMock: MaintenanceUnitInfo[]
    beforeEach(() => {
      maintenanceUnitsMock =
        rentalPropertyInfoMockData.maintenanceUnits as MaintenanceUnitInfo[]
    })

    it('should return all maintenance units', async () => {
      const getMaintenanceUnitsForRentalPropertySpy = jest
        .spyOn(
          propertyManagementAdapter,
          'getMaintenanceUnitsForRentalProperty'
        )
        .mockResolvedValue(maintenanceUnitsMock)

      const res = await request(app.callback()).get(
        '/api/maintenanceUnitsByRentalPropertyId/705-022-04-0201'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual(maintenanceUnitsMock)
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
        .mockResolvedValue(maintenanceUnitsMock)

      const res = await request(app.callback()).get(
        '/api/maintenanceUnitsByRentalPropertyId/705-022-04-0201/Miljöbod'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([
        maintenanceUnitsMock[0],
        maintenanceUnitsMock[1],
      ])
      expect(getMaintenanceUnitsForRentalPropertySpy).toHaveBeenCalledWith(
        '705-022-04-0201'
      )
    })
  })

  describe('GET /maintenanceUnitsByContactCode/:contactCode', () => {
    let maintenanceUnitsMock: MaintenanceUnitInfo[]
    beforeEach(() => {
      maintenanceUnitsMock =
        rentalPropertyInfoMockData.maintenanceUnits as MaintenanceUnitInfo[]
    })

    it('should return all maintenance units', async () => {
      const getContactSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
        .mockResolvedValue({ ok: true, data: contactMockData })
      const getLeasesForPnrSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForPnr')
        .mockResolvedValue([leaseMockData])
      const getMaintenanceUnitsForRentalPropertySpy = jest
        .spyOn(
          propertyManagementAdapter,
          'getMaintenanceUnitsForRentalProperty'
        )
        .mockResolvedValue(maintenanceUnitsMock)

      const res = await request(app.callback()).get(
        '/api/maintenanceUnitsByContactCode/P965339'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual(maintenanceUnitsMock)
      expect(getContactSpy).toHaveBeenCalledWith('P965339')
      expect(getLeasesForPnrSpy).toHaveBeenCalledWith(
        '194512121122',
        'false',
        'false'
      )
      expect(getMaintenanceUnitsForRentalPropertySpy).toHaveBeenCalledWith(
        '705-022-04-0201'
      )
    })
  })
})
