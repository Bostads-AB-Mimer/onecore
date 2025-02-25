import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'
import * as propertyManagementAdapter from '../../../adapters/property-management-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as communicationAdapter from '../../../adapters/communication-adapter'
import * as workOrderAdapter from '../../../adapters/work-order-adapter'
import { routes } from '../index'
import bodyParser from 'koa-bodyparser'
import {
  Lease,
  Contact,
  Tenant,
  RentalPropertyInfo,
  WorkOrder,
  CreateWorkOrderDetails,
} from 'onecore-types'
import * as factory from '../../../../test/factories'

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

describe('work-order-service index', () => {
  describe('GET /workOrderData/:identifier', () => {
    const leaseMock: Lease = factory.lease.build()
    const contactMock: Contact = factory.contact.build()
    const rentalPropertyInfoMock: RentalPropertyInfo =
      factory.rentalPropertyInfo.build()

    it('should handle leaseId case', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue(leaseMock)

      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      const res = await request(app.callback()).get(
        '/workOrderData/123?handler=leaseId'
      )

      expect(res.status).toBe(200)
      expect(getLeaseSpy).toHaveBeenCalledWith('123', 'true')
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('123-456-789')
      expect(res.body.content).toBeDefined()
    })

    it('should handle rentalObjectId case', async () => {
      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      const getLeasesForPropertyIdSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForPropertyId')
        .mockResolvedValue([leaseMock])

      const res = await request(app.callback()).get(
        '/workOrderData/123-456-789?handler=rentalObjectId'
      )

      expect(res.status).toBe(200)
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('123-456-789')
      expect(getLeasesForPropertyIdSpy).toHaveBeenCalledWith(
        '123-456-789',
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
        '/workOrderData/123?handler=pnr'
      )

      expect(res.status).toBe(200)
      expect(getLeasesForPnrSpy).toHaveBeenCalledWith('123', false, true)
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('123-456-789')
      expect(res.body.content).toBeDefined()
    })

    it('should handle phoneNumber case', async () => {
      const getContactByPhoneNumberSpy = jest
        .spyOn(tenantLeaseAdapter, 'getContactByPhoneNumber')
        .mockResolvedValue(contactMock)
      const getLeasesForContactCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForContactCode')
        .mockResolvedValue([leaseMock])

      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      const res = await request(app.callback()).get(
        '/workOrderData/1234567890?handler=phoneNumber'
      )

      expect(res.status).toBe(200)
      expect(getContactByPhoneNumberSpy).toHaveBeenCalledWith('1234567890')
      expect(getLeasesForContactCodeSpy).toHaveBeenCalledWith(
        'P158770',
        false,
        false
      )
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('123-456-789')
      expect(res.body.content).toBeDefined()
    })

    it('should handle contactCode case', async () => {
      const getLeasesForContactCodeSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeasesForContactCode')
        .mockResolvedValue([leaseMock])

      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      const res = await request(app.callback()).get(
        '/workOrderData/P965339?handler=contactCode'
      )

      expect(res.status).toBe(200)
      expect(getLeasesForContactCodeSpy).toHaveBeenCalledWith(
        'P965339',
        false,
        true
      )
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('123-456-789')
      expect(res.body.content).toBeDefined()
    })
  })

  describe('GET /workOrders/contactCode/:contactCode', () => {
    const workOrderMock: WorkOrder = factory.workOrder.build()

    it('should return work orders by contact code', async () => {
      const getWorkOrdersByContactCodeSpy = jest
        .spyOn(workOrderAdapter, 'getWorkOrdersByContactCode')
        .mockResolvedValue({ ok: true, data: [workOrderMock] })

      const res = await request(app.callback()).get(
        '/api/workOrders/contactCode/P174958'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveProperty('totalCount')
      expect(res.body.content.totalCount).toBe(1)
      expect(res.body.content).toHaveProperty('workOrders')
      expect(res.body.content.workOrders).toHaveLength(1)
      expect(getWorkOrdersByContactCodeSpy).toHaveBeenCalledWith('P174958')
    })
    it('should return 500 if error', async () => {
      const getWorkOrdersByContactCodeSpy = jest
        .spyOn(workOrderAdapter, 'getWorkOrdersByContactCode')
        .mockRejectedValue(new Error('error'))

      const res = await request(app.callback()).get(
        '/api/workOrders/contactCode/P174958'
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getWorkOrdersByContactCodeSpy).toHaveBeenCalledWith('P174958')
    })
  })

  describe('POST /workOrders', () => {
    let rentalPropertyInfoMock: RentalPropertyInfo
    let tenantMock: Tenant
    let createWorkOrderDetailsMock: CreateWorkOrderDetails

    beforeEach(() => {
      rentalPropertyInfoMock = factory.rentalPropertyInfo.build()
      tenantMock = factory.tenant.build()
      createWorkOrderDetailsMock = factory.createWorkOrderDetails.build()
    })

    it('should create work order', async () => {
      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      const getTenantByContactCodeSpy = jest
        .spyOn(leasingAdapter, 'getTenantByContactCode')
        .mockResolvedValue({ ok: true, data: tenantMock })

      const createWorkOrderSpy = jest
        .spyOn(workOrderAdapter, 'createWorkOrder')
        .mockResolvedValue({ ok: true, data: { newWorkOrderId: 1 } })

      const res = await request(app.callback())
        .post('/api/workOrders')
        .send(createWorkOrderDetailsMock)

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(createWorkOrderSpy).toHaveBeenCalled()
      expect(getRentalPropertyInfoSpy).toHaveBeenCalled()
      expect(getTenantByContactCodeSpy).toHaveBeenCalled()
    })

    it('should return 400 if ContactCode is missing', async () => {
      const {
        ContactCode: _ContactCode,
        ...workOrderDetailsWithoutContactCode
      } = createWorkOrderDetailsMock
      const res = await request(app.callback())
        .post('/api/workOrders')
        .send(workOrderDetailsWithoutContactCode)

      expect(res.status).toBe(400)
      expect(res.body.reason).toBe('ContactCode is missing')
    })

    it('should return 400 if RentalObjectCode is missing', async () => {
      const {
        RentalObjectCode: _RentalObjectCode,
        ...workOrderDetailsWithoutRentalObjectCode
      } = createWorkOrderDetailsMock
      const res = await request(app.callback())
        .post('/api/workOrders')
        .send(workOrderDetailsWithoutRentalObjectCode)

      expect(res.status).toBe(400)
      expect(res.body.reason).toBe('RentalObjectCode is missing')
    })

    it('should return 400 if no work orders found in request', async () => {
      createWorkOrderDetailsMock.Rows = []
      const res = await request(app.callback())
        .post('/api/workOrders')
        .send(createWorkOrderDetailsMock)

      expect(res.status).toBe(400)
      expect(res.body.reason).toBe('No work orders found in request')
    })

    it('should return 404 if rental property not found', async () => {
      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(null as unknown as RentalPropertyInfo)

      const res = await request(app.callback())
        .post('/api/workOrders')
        .send(createWorkOrderDetailsMock)

      expect(res.status).toBe(404)
      expect(res.body.reason).toBe('Rental property not found')
    })

    it('should return 404 if no active lease found for rental property', async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      tenantMock.housingContracts[0].leaseEndDate = yesterday

      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      jest
        .spyOn(leasingAdapter, 'getTenantByContactCode')
        .mockResolvedValue({ ok: true, data: tenantMock })

      const res = await request(app.callback())
        .post('/api/workOrders')
        .send(createWorkOrderDetailsMock)

      expect(res.status).toBe(404)
      expect(res.body.reason).toBe(
        'Cannot find active lease for rental property'
      )
    })
  })

  describe('POST /workOrders/:workOrderId/close', () => {
    it('should close work order', async () => {
      const closeWorkOrderSpy = jest
        .spyOn(workOrderAdapter, 'closeWorkOrder')
        .mockResolvedValue({ ok: true, data: 'Work order closed successfully' })

      const res = await request(app.callback()).post('/api/workOrders/13/close')

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(closeWorkOrderSpy).toHaveBeenCalled()
    })
  })

  describe('POST /workOrders/:workOrderId/update', () => {
    const workOrderId = 13
    const message = 'test'
    const updateWorkOrderSpy = jest
      .spyOn(workOrderAdapter, 'updateWorkOrder')
      .mockResolvedValue({ ok: true, data: 'Work order updated successfully' })

    beforeEach(() => {
      updateWorkOrderSpy.mockClear()
    })

    it('should update work order', async () => {
      const res = await request(app.callback())
        .post(`/api/workOrders/${workOrderId}/update`)
        .send({ message })

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(updateWorkOrderSpy).toHaveBeenCalledWith(workOrderId, message)
    })

    it('should return 400 if message body is missing', async () => {
      const res = await request(app.callback())
        .post(`/api/workOrders/${workOrderId}/update`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.reason).toBe('Message is missing from the request body')
      expect(updateWorkOrderSpy).not.toHaveBeenCalled()
    })
  })

  describe('POST /workOrders/sendSms', () => {
    const sendWorkOrderSmsSpy = jest.spyOn(
      communicationAdapter,
      'sendWorkOrderSms'
    )

    beforeEach(() => {
      sendWorkOrderSmsSpy.mockReset()
    })

    it('should return 200', async () => {
      sendWorkOrderSmsSpy.mockResolvedValue(
        Promise.resolve({ ok: true, data: {} })
      )
      const res = await request(app.callback())
        .post('/api/workOrders/sendSms')
        .send({
          phoneNumber: '1234567890',
          message: 'test',
        })

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(sendWorkOrderSmsSpy).toHaveBeenCalled()
    })

    it('should return 400 if phoneNumber or message are missing', async () => {
      sendWorkOrderSmsSpy.mockResolvedValue(
        Promise.resolve({ ok: true, data: {} })
      )

      const resMissingPhoneNumber = await request(app.callback())
        .post('/api/workOrders/sendSms')
        .send({
          message: 'test',
        })

      expect(resMissingPhoneNumber.status).toBe(400)
      expect(resMissingPhoneNumber.body.reason).toBeDefined()
      expect(sendWorkOrderSmsSpy).not.toHaveBeenCalled()

      const resMissingMessage = await request(app.callback())
        .post('/api/workOrders/sendSms')
        .send({
          phoneNumber: '1234567890',
        })

      expect(resMissingMessage.status).toBe(400)
      expect(resMissingMessage.body.reason).toBeDefined()
      expect(sendWorkOrderSmsSpy).not.toHaveBeenCalled()
    })
  })

  describe('POST /workOrders/sendEmail', () => {
    const sendWorkOrderEmailSpy = jest.spyOn(
      communicationAdapter,
      'sendWorkOrderEmail'
    )

    beforeEach(() => {
      sendWorkOrderEmailSpy.mockReset()
    })

    it('should return 200', async () => {
      sendWorkOrderEmailSpy.mockResolvedValue(
        Promise.resolve({ ok: true, data: {} })
      )
      const res = await request(app.callback())
        .post('/api/workOrders/sendEmail')
        .send({
          to: 'hello@example.com',
          subject: 'subject',
          message: 'hello',
        })

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(sendWorkOrderEmailSpy).toHaveBeenCalled()
    })

    it('should return 400 if to, subject or message are missing', async () => {
      sendWorkOrderEmailSpy.mockResolvedValue(
        Promise.resolve({ ok: true, data: {} })
      )

      const resMissingTo = await request(app.callback())
        .post('/api/workOrders/sendEmail')
        .send({
          subject: 'subject',
          message: 'hello',
        })

      expect(resMissingTo.status).toBe(400)
      expect(resMissingTo.body.reason).toBeDefined()
      expect(sendWorkOrderEmailSpy).not.toHaveBeenCalled()

      const resMissingMessage = await request(app.callback())
        .post('/api/workOrders/sendEmail')
        .send({
          to: 'hello@example.com',
          subject: 'subject',
        })

      expect(resMissingMessage.status).toBe(400)
      expect(resMissingMessage.body.reason).toBeDefined()
      expect(sendWorkOrderEmailSpy).not.toHaveBeenCalled()

      const resMissingSubject = await request(app.callback())
        .post('/api/workOrders/sendEmail')
        .send({
          to: 'hello@example.com',
          message: 'hello',
        })

      expect(resMissingSubject.status).toBe(400)
      expect(resMissingSubject.body.reason).toBeDefined()
      expect(sendWorkOrderEmailSpy).not.toHaveBeenCalled()
    })
  })
})
