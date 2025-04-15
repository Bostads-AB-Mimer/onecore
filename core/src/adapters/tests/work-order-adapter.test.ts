import nock from 'nock'

import config from '../../common/config'
import * as workOrderAdapter from '../work-order-adapter'
import * as factory from '../../../test/factories'

describe('work-order-adapter', () => {
  describe(workOrderAdapter.getWorkOrdersByContactCode, () => {
    const workOrderMock = factory.workOrder.build()
    it('returns err if request fails', async () => {
      nock(config.workOrderService.url)
        .get('/workOrders/contactCode/CC123')
        .reply(500)

      const result = await workOrderAdapter.getWorkOrdersByContactCode('CC123')

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns work order data', async () => {
      nock(config.workOrderService.url)
        .get('/workOrders/contactCode/CC123')
        .reply(200, {
          content: { workOrders: [workOrderMock] },
        })

      const result = await workOrderAdapter.getWorkOrdersByContactCode('CC123')

      expect(result).toMatchObject({
        ok: true,
        data: [workOrderMock],
      })
    })
  })

  describe(workOrderAdapter.createWorkOrder, () => {
    const createWorkOrderMock = factory.createWorkOrder.build()
    it('returns err if request fails', async () => {
      nock(config.workOrderService.url).post('/workOrders').reply(500)

      const result = await workOrderAdapter.createWorkOrder(createWorkOrderMock)

      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.err).toBe('Request failed with status code 500')
    })

    it('returns work order data', async () => {
      nock(config.workOrderService.url)
        .post('/workOrders')
        .reply(200, { content: { newWorkOrderId: 1 } })

      const result = await workOrderAdapter.createWorkOrder(createWorkOrderMock)

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data).toEqual({ newWorkOrderId: 1 })
    })
  })

  describe(workOrderAdapter.updateWorkOrder, () => {
    it('returns err if request fails', async () => {
      nock(config.workOrderService.url).post('/workOrders/1/update').reply(500)

      const result = await workOrderAdapter.updateWorkOrder(1, 'Test message')

      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.err).toBe('Request failed with status code 500')
    })

    it('returns updated work order data', async () => {
      nock(config.workOrderService.url)
        .post('/workOrders/1/update')
        .reply(200, {
          content: { message: 'Message added to work order with ID 1' },
        })

      const result = await workOrderAdapter.updateWorkOrder(1, 'Test message')

      expect(result.ok).toBe(true)
      if (result.ok)
        expect(result.data).toEqual({
          message: 'Message added to work order with ID 1',
        })
    })
  })

  describe(workOrderAdapter.closeWorkOrder, () => {
    it('returns err if request fails', async () => {
      nock(config.workOrderService.url).post('/workOrders/1/close').reply(500)

      const result = await workOrderAdapter.closeWorkOrder(1)

      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.err).toBe('Request failed with status code 500')
    })

    it('returns closed work order data', async () => {
      nock(config.workOrderService.url)
        .post('/workOrders/1/close')
        .reply(200, {
          content: { message: 'Work order with ID 1 updated successfully' },
        })

      const result = await workOrderAdapter.closeWorkOrder(1)

      expect(result.ok).toBe(true)
      if (result.ok)
        expect(result.data).toEqual({
          message: 'Work order with ID 1 updated successfully',
        })
    })
  })
})
