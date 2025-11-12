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
import * as factory from '../../../../test/factories'
import * as schemas from '../schemas'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('work-order-service index', () => {
  describe('GET /work-orders/data/:identifier', () => {
    const leaseMock = factory.lease.build()
    const contactMock = factory.contact.build()
    const rentalPropertyInfoMock = factory.rentalPropertyInfo.build()

    it('should handle leaseId case', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue(leaseMock)

      const getRentalPropertyInfoSpy = jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(rentalPropertyInfoMock)

      const res = await request(app.callback()).get(
        '/work-orders/data/123?handler=leaseId'
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
        '/work-orders/data/123-456-789?handler=rentalObjectId'
      )

      expect(res.status).toBe(200)
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('123-456-789')
      expect(getLeasesForPropertyIdSpy).toHaveBeenCalledWith('123-456-789', {
        includeUpcomingLeases: true,
        includeTerminatedLeases: false,
        includeContacts: true,
      })
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
        '/work-orders/data/123?handler=pnr'
      )

      expect(res.status).toBe(200)
      expect(getLeasesForPnrSpy).toHaveBeenCalledWith('123', {
        includeUpcomingLeases: true,
        includeTerminatedLeases: false,
        includeContacts: true,
      })
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
        '/work-orders/data/1234567890?handler=phoneNumber'
      )

      expect(res.status).toBe(200)
      expect(getContactByPhoneNumberSpy).toHaveBeenCalledWith('1234567890')
      expect(getLeasesForContactCodeSpy).toHaveBeenCalledWith('P158770', {
        includeUpcomingLeases: true,
        includeTerminatedLeases: false,
        includeContacts: false,
      })
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
        '/work-orders/data/P965339?handler=contactCode'
      )

      expect(res.status).toBe(200)
      expect(getLeasesForContactCodeSpy).toHaveBeenCalledWith('P965339', {
        includeUpcomingLeases: true,
        includeTerminatedLeases: false,
        includeContacts: true,
      })
      expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('123-456-789')
      expect(res.body.content).toBeDefined()
    })
  })

  describe('GET /work-orders/by-contact-code/:contactCode', () => {
    it('should return work orders by contact code', async () => {
      const getWorkOrdersByContactCodeSpy = jest
        .spyOn(workOrderAdapter, 'getWorkOrdersByContactCode')
        .mockResolvedValue({
          ok: true,
          data: factory.externalOdooWorkOrder.buildList(1),
        })

      const res = await request(app.callback()).get(
        '/work-orders/by-contact-code/P174958'
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
        '/work-orders/by-contact-code/P174958'
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getWorkOrdersByContactCodeSpy).toHaveBeenCalledWith('P174958')
    })
  })

  describe('GET /work-orders/xpand/by-rental-property-id/:rentalPropertyId', () => {
    const rentalPropertyId = '406-028-02-0101'

    it('should return work orders by rentalPropertyId', async () => {
      const getXpandWorkOrdersByRentalPropertyId = jest
        .spyOn(workOrderAdapter, 'getXpandWorkOrdersByRentalPropertyId')
        .mockResolvedValue({
          ok: true,
          data: [
            {
              AccessCaption: 'test',
              Caption: 'test',
              Code: 'test',
              ContactCode: 'test',
              Id: '1',
              LastChanged: new Date().toISOString(),
              Priority: 'test',
              Registered: new Date().toISOString(),
              DueDate: null,
              RentalObjectCode: 'test',
              Status: 'test',
            },
          ],
        })

      const res = await request(app.callback()).get(
        `/work-orders/xpand/by-rental-property-id/${rentalPropertyId}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveProperty('totalCount')
      expect(res.body.content.totalCount).toBe(1)
      expect(res.body.content).toHaveProperty('workOrders')
      expect(res.body.content.workOrders).toHaveLength(1)
      expect(getXpandWorkOrdersByRentalPropertyId).toHaveBeenCalledWith(
        rentalPropertyId,
        { limit: undefined, skip: undefined, sortAscending: undefined }
      )
    })

    it('should return 400 on invalid query params', async () => {
      const res = await request(app.callback()).get(
        `/work-orders/xpand/by-rental-property-id/${rentalPropertyId}?skip=tjena`
      )

      expect(res.status).toBe(400)
    })

    it('should return 500 if error', async () => {
      const getXpandWorkOrdersByRentalPropertyId = jest
        .spyOn(workOrderAdapter, 'getXpandWorkOrdersByRentalPropertyId')
        .mockRejectedValue(new Error('error'))

      const res = await request(app.callback()).get(
        `/work-orders/xpand/by-rental-property-id/${rentalPropertyId}`
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getXpandWorkOrdersByRentalPropertyId).toHaveBeenCalledWith(
        rentalPropertyId,
        { limit: undefined, skip: undefined, sortAscending: undefined }
      )
    })
  })

  describe('GET /work-orders/xpand/:code', () => {
    const workOrderCode = '25-000050'
    const xpandWorkOrderDetailsMock =
      factory.externalXpandWorkOrderDetails.build({
        Code: workOrderCode,
      })

    it('should return work order details', async () => {
      const getXpandWorkOrderDetailsSpy = jest
        .spyOn(workOrderAdapter, 'getXpandWorkOrderDetails')
        .mockResolvedValue({
          ok: true,
          data: xpandWorkOrderDetailsMock,
        })

      const res = await request(app.callback()).get(
        `/work-orders/xpand/${workOrderCode}`
      )

      expect(res.status).toBe(200)
      expect(() =>
        schemas.CoreXpandWorkOrderDetailsSchema.parse(res.body.content)
      ).not.toThrow()

      expect(getXpandWorkOrderDetailsSpy).toHaveBeenCalledWith(workOrderCode)
    })

    it('should return 404 if work order is not found', async () => {
      jest
        .spyOn(workOrderAdapter, 'getXpandWorkOrderDetails')
        .mockResolvedValue({
          ok: false,
          err: 'not-found',
        })

      const res = await request(app.callback()).get(
        `/work-orders/xpand/${workOrderCode}`
      )

      expect(res.status).toBe(404)
    })

    it('should return 500 if error', async () => {
      const getXpandWorkOrderDetailsSpy = jest
        .spyOn(workOrderAdapter, 'getXpandWorkOrderDetails')
        .mockRejectedValue(new Error('error'))

      const res = await request(app.callback()).get(
        `/work-orders/xpand/${workOrderCode}`
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getXpandWorkOrderDetailsSpy).toHaveBeenCalledWith(workOrderCode)
    })
  })

  describe('GET /work-orders/by-rental-property-id/:rentalPropertyId', () => {
    it('should return work orders by rental property id', async () => {
      const getWorkOrdersByRentalPropertyIdSpy = jest
        .spyOn(workOrderAdapter, 'getWorkOrdersByRentalPropertyId')
        .mockResolvedValue({
          ok: true,
          data: [
            {
              AccessCaption: 'accesscaption',
              Caption: 'caption',
              Code: 'code',
              ContactCode: 'contactCode',
              Description: 'description',
              DetailsCaption: 'detailsCaption',
              ExternalResource: false,
              Id: 'id',
              LastChanged: new Date().toISOString(),
              Priority: 'priority',
              Registered: new Date().toISOString(),
              RentalObjectCode: 'rentalObjectCode',
              Status: 'status',
              WorkOrderRows: [
                {
                  Description: 'description',
                  LocationCode: 'locationCode',
                  EquipmentCode: 'equipmentCode',
                },
              ],
              UseMasterKey: false,
              Messages: [],
              DueDate: null,
            },
          ],
        })

      const res = await request(app.callback()).get(
        '/work-orders/by-rental-property-id/406-028-02-0101'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveProperty('totalCount')
      expect(res.body.content.totalCount).toBe(1)
      expect(res.body.content).toHaveProperty('workOrders')
      expect(res.body.content.workOrders).toHaveLength(1)
      expect(getWorkOrdersByRentalPropertyIdSpy).toHaveBeenCalledWith(
        '406-028-02-0101'
      )
    })
    it('should return 500 if error', async () => {
      const getWorkOrdersByRentalPropertyIdSpy = jest
        .spyOn(workOrderAdapter, 'getWorkOrdersByRentalPropertyId')
        .mockRejectedValue(new Error('error'))

      const res = await request(app.callback()).get(
        '/work-orders/by-rental-property-id/406-028-02-0101'
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getWorkOrdersByRentalPropertyIdSpy).toHaveBeenCalledWith(
        '406-028-02-0101'
      )
    })
  })

  describe('GET /work-orders/by-property-id/:propertyId', () => {
    const propertyId = '123'

    it('should return work orders by property id', async () => {
      const getWorkOrdersByPropertyIdSpy = jest
        .spyOn(workOrderAdapter, 'getWorkOrdersByPropertyId')
        .mockResolvedValue({
          ok: true,
          data: [
            {
              AccessCaption: 'accesscaption',
              Caption: 'caption',
              Code: 'code',
              ContactCode: 'contactCode',
              Description: 'description',
              DetailsCaption: 'detailsCaption',
              ExternalResource: false,
              Id: 'id',
              LastChanged: new Date().toISOString(),
              Priority: 'priority',
              Registered: new Date().toISOString(),
              RentalObjectCode: 'rentalObjectCode',
              Status: 'status',
              WorkOrderRows: [
                {
                  Description: 'description',
                  LocationCode: 'locationCode',
                  EquipmentCode: 'equipmentCode',
                },
              ],
              UseMasterKey: false,
              Messages: [],
              DueDate: null,
              Url: 'http://example.com',
            },
          ],
        })

      const res = await request(app.callback()).get(
        `/work-orders/by-property-id/${propertyId}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveProperty('totalCount')
      expect(res.body.content.totalCount).toBe(1)
      expect(res.body.content).toHaveProperty('workOrders')
      expect(res.body.content.workOrders).toHaveLength(1)
      expect(getWorkOrdersByPropertyIdSpy).toHaveBeenCalledWith(propertyId)
    })

    it('should return 500 if error', async () => {
      const getWorkOrdersByPropertyIdSpy = jest
        .spyOn(workOrderAdapter, 'getWorkOrdersByPropertyId')
        .mockRejectedValue(new Error('error'))

      const res = await request(app.callback()).get(
        `/work-orders/by-property-id/${propertyId}`
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getWorkOrdersByPropertyIdSpy).toHaveBeenCalledWith(propertyId)
    })
  })

  describe('GET /work-orders/xpand/by-property-id/:propertyId', () => {
    const propertyId = '123'

    it('should return work orders by propertyId', async () => {
      const getXpandWorkOrdersByPropertyIdSpy = jest
        .spyOn(workOrderAdapter, 'getXpandWorkOrdersByPropertyId')
        .mockResolvedValue({
          ok: true,
          data: [
            {
              AccessCaption: 'test',
              Caption: 'test',
              Code: 'test',
              ContactCode: 'test',
              Id: '1',
              LastChanged: new Date().toISOString(),
              Priority: 'test',
              Registered: new Date().toISOString(),
              DueDate: null,
              RentalObjectCode: 'test',
              Status: 'test',
            },
          ],
        })

      const res = await request(app.callback()).get(
        `/work-orders/xpand/by-property-id/${propertyId}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveProperty('totalCount')
      expect(res.body.content.totalCount).toBe(1)
      expect(res.body.content).toHaveProperty('workOrders')
      expect(res.body.content.workOrders).toHaveLength(1)
      expect(getXpandWorkOrdersByPropertyIdSpy).toHaveBeenCalledWith(
        propertyId,
        { limit: undefined, skip: undefined, sortAscending: undefined }
      )
    })

    it('should return 400 on invalid query params', async () => {
      const res = await request(app.callback()).get(
        `/work-orders/xpand/by-property-id/${propertyId}?skip=invalid`
      )

      expect(res.status).toBe(400)
    })

    it('should return 500 if error', async () => {
      const getXpandWorkOrdersByPropertyIdSpy = jest
        .spyOn(workOrderAdapter, 'getXpandWorkOrdersByPropertyId')
        .mockRejectedValue(new Error('error'))

      const res = await request(app.callback()).get(
        `/work-orders/xpand/by-property-id/${propertyId}`
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getXpandWorkOrdersByPropertyIdSpy).toHaveBeenCalledWith(
        propertyId,
        { limit: undefined, skip: undefined, sortAscending: undefined }
      )
    })
  })

  describe('POST /work-orders', () => {
    const rentalPropertyInfoMock = factory.rentalPropertyInfo.build()
    const tenantMock = factory.tenant.build()
    const createWorkOrderDetailsMock = factory.createWorkOrderDetails.build()

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
        .post('/work-orders')
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
        .post('/work-orders')
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
        .post('/work-orders')
        .send(workOrderDetailsWithoutRentalObjectCode)

      expect(res.status).toBe(400)
      expect(res.body.reason).toBe('RentalObjectCode is missing')
    })

    it('should return 400 if no work orders found in request', async () => {
      const res = await request(app.callback())
        .post('/work-orders')
        .send({ ...createWorkOrderDetailsMock, Rows: [] })

      expect(res.status).toBe(400)
      expect(res.body.reason).toBe('No work orders found in request')
    })

    it('should return 404 if rental property not found', async () => {
      jest
        .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
        .mockResolvedValue(null)

      const res = await request(app.callback())
        .post('/work-orders')
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
        .post('/work-orders')
        .send(createWorkOrderDetailsMock)

      expect(res.status).toBe(404)
      expect(res.body.reason).toBe(
        'Cannot find active lease for rental property'
      )
    })
  })

  describe('POST /work-orders/:workOrderId/close', () => {
    it('should close work order', async () => {
      const closeWorkOrderSpy = jest
        .spyOn(workOrderAdapter, 'closeWorkOrder')
        .mockResolvedValue({ ok: true, data: 'Work order closed successfully' })

      const res = await request(app.callback()).post('/work-orders/13/close')

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(closeWorkOrderSpy).toHaveBeenCalled()
    })
  })

  describe('POST /work-orders/:workOrderId/update', () => {
    const workOrderId = '13'
    const message = 'test'
    const updateWorkOrderSpy = jest
      .spyOn(workOrderAdapter, 'updateWorkOrder')
      .mockResolvedValue({ ok: true, data: 'Work order updated successfully' })

    beforeEach(() => {
      updateWorkOrderSpy.mockClear()
    })

    it('should update work order', async () => {
      const res = await request(app.callback())
        .post(`/work-orders/${workOrderId}/update`)
        .send({ message })

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(updateWorkOrderSpy).toHaveBeenCalledWith(workOrderId, message)
    })

    it('should return 400 if message body is missing', async () => {
      const res = await request(app.callback())
        .post(`/work-orders/${workOrderId}/update`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.reason).toBe('Message is missing from the request body')
      expect(updateWorkOrderSpy).not.toHaveBeenCalled()
    })
  })

  describe('POST /work-orders/send-sms', () => {
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
        .post('/work-orders/send-sms')
        .send({
          phoneNumber: '1234567890',
          text: 'test',
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
        .post('/work-orders/send-sms')
        .send({
          message: 'test',
        })

      expect(resMissingPhoneNumber.status).toBe(400)
      expect(resMissingPhoneNumber.body.reason).toBeDefined()
      expect(sendWorkOrderSmsSpy).not.toHaveBeenCalled()

      const resMissingMessage = await request(app.callback())
        .post('/work-orders/send-sms')
        .send({
          phoneNumber: '1234567890',
        })

      expect(resMissingMessage.status).toBe(400)
      expect(resMissingMessage.body.reason).toBeDefined()
      expect(sendWorkOrderSmsSpy).not.toHaveBeenCalled()
    })
  })

  describe('POST /work-orders/send-email', () => {
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
        .post('/work-orders/send-email')
        .send({
          to: 'hello@example.com',
          subject: 'subject',
          text: 'hello',
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
        .post('/work-orders/send-email')
        .send({
          subject: 'subject',
          message: 'hello',
        })

      expect(resMissingTo.status).toBe(400)
      expect(resMissingTo.body.reason).toBeDefined()
      expect(sendWorkOrderEmailSpy).not.toHaveBeenCalled()

      const resMissingMessage = await request(app.callback())
        .post('/work-orders/send-email')
        .send({
          to: 'hello@example.com',
          subject: 'subject',
        })

      expect(resMissingMessage.status).toBe(400)
      expect(resMissingMessage.body.reason).toBeDefined()
      expect(sendWorkOrderEmailSpy).not.toHaveBeenCalled()

      const resMissingSubject = await request(app.callback())
        .post('/work-orders/send-email')
        .send({
          to: 'hello@example.com',
          message: 'hello',
        })

      expect(resMissingSubject.status).toBe(400)
      expect(resMissingSubject.body.reason).toBeDefined()
      expect(sendWorkOrderEmailSpy).not.toHaveBeenCalled()
    })
  })

  describe('GET /work-orders/by-building-id/:buildingId', () => {
    const buildingId = '789-012'

    it('should return work orders by building id', async () => {
      const getWorkOrdersByBuildingIdSpy = jest
        .spyOn(workOrderAdapter, 'getWorkOrdersByBuildingId')
        .mockResolvedValue({
          ok: true,
          data: [
            {
              AccessCaption: 'accesscaption',
              Caption: 'caption',
              Code: 'code',
              ContactCode: 'contactCode',
              Description: 'description',
              DetailsCaption: 'detailsCaption',
              ExternalResource: false,
              Id: 'id',
              LastChanged: new Date().toISOString(),
              Priority: 'priority',
              Registered: new Date().toISOString(),
              RentalObjectCode: 'rentalObjectCode',
              Status: 'status',
              WorkOrderRows: [
                {
                  Description: 'description',
                  LocationCode: 'locationCode',
                  EquipmentCode: 'equipmentCode',
                },
              ],
              UseMasterKey: false,
              Messages: [],
              DueDate: null,
              Url: 'http://example.com',
            },
          ],
        })

      const res = await request(app.callback()).get(
        `/work-orders/by-building-id/${buildingId}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveProperty('totalCount')
      expect(res.body.content.totalCount).toBe(1)
      expect(res.body.content).toHaveProperty('workOrders')
      expect(res.body.content.workOrders).toHaveLength(1)
      expect(getWorkOrdersByBuildingIdSpy).toHaveBeenCalledWith(buildingId)
    })

    it('should return 500 if error', async () => {
      const getWorkOrdersByBuildingIdSpy = jest
        .spyOn(workOrderAdapter, 'getWorkOrdersByBuildingId')
        .mockRejectedValue(new Error('error'))

      const res = await request(app.callback()).get(
        `/work-orders/by-building-id/${buildingId}`
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getWorkOrdersByBuildingIdSpy).toHaveBeenCalledWith(buildingId)
    })
  })

  describe('GET /work-orders/xpand/by-building-id/:buildingId', () => {
    const buildingId = '789-012'

    it('should return work orders by buildingId', async () => {
      const getXpandWorkOrdersByBuildingIdSpy = jest
        .spyOn(workOrderAdapter, 'getXpandWorkOrdersByBuildingId')
        .mockResolvedValue({
          ok: true,
          data: [
            {
              AccessCaption: 'test',
              Caption: 'test',
              Code: 'test',
              ContactCode: 'test',
              Id: '1',
              LastChanged: new Date().toISOString(),
              Priority: 'test',
              Registered: new Date().toISOString(),
              DueDate: null,
              RentalObjectCode: 'test',
              Status: 'test',
            },
          ],
        })

      const res = await request(app.callback()).get(
        `/work-orders/xpand/by-building-id/${buildingId}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveProperty('totalCount')
      expect(res.body.content.totalCount).toBe(1)
      expect(res.body.content).toHaveProperty('workOrders')
      expect(res.body.content.workOrders).toHaveLength(1)
      expect(getXpandWorkOrdersByBuildingIdSpy).toHaveBeenCalledWith(
        buildingId,
        { limit: undefined, skip: undefined, sortAscending: undefined }
      )
    })

    it('should return 400 on invalid query params', async () => {
      const res = await request(app.callback()).get(
        `/work-orders/xpand/by-building-id/${buildingId}?limit=invalid`
      )

      expect(res.status).toBe(400)
    })

    it('should return 500 if error', async () => {
      const getXpandWorkOrdersByBuildingIdSpy = jest
        .spyOn(workOrderAdapter, 'getXpandWorkOrdersByBuildingId')
        .mockRejectedValue(new Error('error'))

      const res = await request(app.callback()).get(
        `/work-orders/xpand/by-building-id/${buildingId}`
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getXpandWorkOrdersByBuildingIdSpy).toHaveBeenCalledWith(
        buildingId,
        { limit: undefined, skip: undefined, sortAscending: undefined }
      )
    })
  })
})
