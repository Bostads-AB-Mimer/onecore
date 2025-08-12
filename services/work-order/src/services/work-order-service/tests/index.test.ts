import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import * as odooAdapter from '../adapters/odoo-adapter'
import * as xpandAdapter from '../adapters/xpand-adapter'
import { routes } from '../index'
import * as factory from './factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('work-order-service index', () => {
  describe('GET /workOrders/residenceId/{residenceId}', () => {
    const residenceId = '123-123-123'
    const workOrderMock = factory.workOrder.buildList(4, {
      RentalObjectCode: residenceId,
    })

    beforeEach(() => {
      jest
        .spyOn(odooAdapter, 'getWorkOrdersByResidenceId')
        .mockResolvedValue(workOrderMock)
    })

    it('should return work orders for the given residence id', async () => {
      const res = await request(app.callback()).get(
        `/workOrders/residenceId/${residenceId}`
      )

      expect(res.status).toBe(200)
      expect(JSON.stringify(res.body.content.workOrders)).toEqual(
        JSON.stringify(workOrderMock)
      )
    })

    it('should return 500 if there is an error', async () => {
      jest
        .spyOn(odooAdapter, 'getWorkOrdersByResidenceId')
        .mockRejectedValue(new Error('Internal server error'))

      const res = await request(app.callback()).get(
        `/workOrders/residenceId/${residenceId}`
      )

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Internal server error')
    })
  })

  describe('GET /workOrders/xpand/residenceId/{residenceId}', () => {
    const residenceId = '123-123-123'
    const xpandWorkOrdersMock = factory.xpandWorkOrder.buildList(4, {
      RentalObjectCode: residenceId,
    })

    it('should return work orders for the given residence id', async () => {
      jest
        .spyOn(xpandAdapter, 'getWorkOrdersByResidenceId')
        .mockResolvedValue({ ok: true, data: xpandWorkOrdersMock })

      const res = await request(app.callback()).get(
        `/workOrders/xpand/residenceId/${residenceId}`
      )

      expect(res.status).toBe(200)
      expect(JSON.stringify(res.body.content.workOrders)).toEqual(
        JSON.stringify(xpandWorkOrdersMock)
      )
    })

    it('should return 400 on invalid query parameters', async () => {
      const res = await request(app.callback()).get(
        `/workOrders/xpand/residenceId/${residenceId}?skip=tjena`
      )

      expect(res.status).toBe(400)
    })

    it('should return 500 if there is an error', async () => {
      jest
        .spyOn(xpandAdapter, 'getWorkOrdersByResidenceId')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        `/workOrders/xpand/residenceId/${residenceId}`
      )

      expect(res.status).toBe(500)
      expect(res.body.error).toBe(
        'Failed to fetch work orders from Xpand: unknown'
      )
    })
  })

  describe('GET /workOrders/xpand/{code}', () => {
    const workOrderCode = '25-000050'
    const xpandWorkOrderDetailsMock = factory.xpandWorkOrderDetails.build({
      Code: workOrderCode,
    })

    it('should return a work order', async () => {
      jest
        .spyOn(xpandAdapter, 'getWorkOrderDetails')
        .mockResolvedValue({ ok: true, data: xpandWorkOrderDetailsMock })

      const res = await request(app.callback()).get(
        `/workOrders/xpand/${workOrderCode}`
      )

      expect(res.status).toBe(200)
      expect(JSON.stringify(res.body.content)).toEqual(
        JSON.stringify(xpandWorkOrderDetailsMock)
      )
    })

    it('should return 404 if work order is not found', async () => {
      jest
        .spyOn(xpandAdapter, 'getWorkOrderDetails')
        .mockResolvedValue({ ok: false, err: 'not-found' })

      const res = await request(app.callback()).get(
        `/workOrders/xpand/${workOrderCode}`
      )

      expect(res.status).toBe(404)
    })

    it('should return 500 if there is an error', async () => {
      jest
        .spyOn(xpandAdapter, 'getWorkOrderDetails')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        `/workOrders/xpand/${workOrderCode}`
      )

      expect(res.status).toBe(500)
      expect(res.body.error).toBe(
        'Failed to fetch work order from Xpand: unknown'
      )
    })
  })

  describe('GET /workOrders/contactCode/{contactCode}', () => {
    const contactCode = 'P174958'
    const workOrderMock = factory.workOrder.buildList(4, {
      ContactCode: contactCode,
    })

    beforeEach(() => {
      jest
        .spyOn(odooAdapter, 'getWorkOrdersByContactCode')
        .mockResolvedValue(workOrderMock)
    })

    it('should return work orders for the given contact code', async () => {
      const res = await request(app.callback()).get(
        `/workOrders/contactCode/${contactCode}`
      )

      expect(res.status).toBe(200)
      expect(JSON.stringify(res.body.content.workOrders)).toEqual(
        JSON.stringify(workOrderMock)
      )
    })

    it('should return 500 if there is an error', async () => {
      jest
        .spyOn(odooAdapter, 'getWorkOrdersByContactCode')
        .mockRejectedValue(new Error('Internal server error'))

      const res = await request(app.callback()).get(
        `/workOrders/contactCode/${contactCode}`
      )

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Internal server error')
    })
  })

  describe('POST /workOrders', () => {
    const CreateWorkOrderMock = factory.CreateWorkOrder.build()

    beforeEach(() => {
      jest
        .spyOn(odooAdapter, 'createWorkOrder')
        .mockResolvedValue({ ok: true, data: 1 })
    })

    it('should create a new work order and return the new work order ID', async () => {
      const res = await request(app.callback())
        .post('/workOrders')
        .send(CreateWorkOrderMock)

      expect(res.status).toBe(200)
      expect(res.body.content.newWorkOrderId).toBe(1)
    })

    it('should return 500 if there is an error', async () => {
      jest
        .spyOn(odooAdapter, 'createWorkOrder')
        .mockRejectedValue(new Error('Internal server error'))

      const res = await request(app.callback())
        .post('/workOrders')
        .send(CreateWorkOrderMock)

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Internal server error')
    })
  })

  describe('POST /workOrders/:workOrderId/update', () => {
    const workOrderId = 13
    const message = 'test'
    const addMessageToWorkOrderSpy = jest
      .spyOn(odooAdapter, 'addMessageToWorkOrder')
      .mockResolvedValue(Promise.resolve(workOrderId))

    beforeEach(() => {
      addMessageToWorkOrderSpy.mockClear()
    })

    it('should update work order', async () => {
      const res = await request(app.callback())
        .post(`/api/workOrders/${workOrderId}/update`)
        .send({ message })

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(addMessageToWorkOrderSpy).toHaveBeenCalledWith(
        workOrderId,
        message
      )
    })

    it('should return 400 if message body is missing', async () => {
      const res = await request(app.callback())
        .post(`/api/workOrders/${workOrderId}/update`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.reason).toBe('Message is missing from the request body')
      expect(addMessageToWorkOrderSpy).not.toHaveBeenCalled()
    })
  })

  describe('POST /workOrders/:workOrderId/close', () => {
    const workOrderId = 13
    it('should close work order', async () => {
      const closeWorkOrderSpy = jest
        .spyOn(odooAdapter, 'closeWorkOrder')
        .mockResolvedValue(Promise.resolve(true))
      const res = await request(app.callback()).post(
        `/api/workOrders/${workOrderId}/close`
      )

      expect(res.status).toBe(200)
      expect(res.body.message).toBeDefined()
      expect(closeWorkOrderSpy).toHaveBeenCalled()
    })
  })
})
