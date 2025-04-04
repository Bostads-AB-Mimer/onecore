import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import * as odooAdapter from '../adapters/odoo-adapter'
import { routes } from '../index'
import { OdooWorkOrder } from 'onecore-types'
import * as factory from './factories'

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
    generateRouteMetadata: jest.fn(() => ({})),
  }
})

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('work-order-service index', () => {
  describe('GET /workOrders/residenceId/{residenceId}', () => {
    const residenceId = '123-123-123'
    const workOrderMock: OdooWorkOrder[] = factory.odooWorkOrder.buildList(4, {
      rental_property_id: residenceId,
    })

    beforeEach(() => {
      jest
        .spyOn(odooAdapter, 'getWorkOrderByResidenceId')
        .mockResolvedValue(workOrderMock)
    })

    it('should return work orders for the given residence id', async () => {
      const res = await request(app.callback()).get(
        `/workOrders/residenceId/${residenceId}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.workOrders).toEqual(workOrderMock)
    })

    it('should return 500 if there is an error', async () => {
      jest
        .spyOn(odooAdapter, 'getWorkOrderByResidenceId')
        .mockRejectedValue(new Error('Internal server error'))

      const res = await request(app.callback()).get(
        `/workOrders/residenceId/${residenceId}`
      )

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Internal server error')
    })
  })

  describe('GET /workOrders/contactCode/{contactCode}', () => {
    const contactCode = 'P174958'
    const workOrderMock: OdooWorkOrder[] = factory.odooWorkOrder.buildList(4, {
      contact_code: contactCode,
    })

    beforeEach(() => {
      jest
        .spyOn(odooAdapter, 'getWorkOrderByContactCode')
        .mockResolvedValue(workOrderMock)
    })

    it('should return work orders for the given contact code', async () => {
      const res = await request(app.callback()).get(
        `/workOrders/contactCode/${contactCode}`
      )

      expect(res.status).toBe(200)
      expect(res.body.content.workOrders).toEqual(workOrderMock)
    })

    it('should return 500 if there is an error', async () => {
      jest
        .spyOn(odooAdapter, 'getWorkOrderByContactCode')
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
      expect(addMessageToWorkOrderSpy).toHaveBeenCalledWith(workOrderId, {
        body: message,
      })
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
