import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import config from '../../common/config'
import * as workOrderAdapter from '../work-order-adapter'
import * as factory from '../../../test/factories'

const mockServer = setupServer()

describe('work-order-adapter', () => {
  beforeAll(() => {
    mockServer.listen()
  })

  afterEach(() => {
    mockServer.resetHandlers()
  })

  afterAll(() => {
    mockServer.close()
  })

  describe(workOrderAdapter.getWorkOrdersByContactCode, () => {
    const workOrderMock = factory.externalXpandWorkOrder.build()

    it('returns err if request fails', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/contactCode/CC123`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result = await workOrderAdapter.getWorkOrdersByContactCode('CC123')

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns work order data', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/contactCode/CC123`,
          () =>
            HttpResponse.json(
              {
                content: { workOrders: [workOrderMock] },
              },
              { status: 200 }
            )
        )
      )

      const result = await workOrderAdapter.getWorkOrdersByContactCode('CC123')

      expect(result).toMatchObject({
        ok: true,
        data: [workOrderMock],
      })
    })
  })

  describe(workOrderAdapter.getXpandWorkOrdersByRentalPropertyId, () => {
    const rentalPropertyId = '406-028-02-0101'
    const xpandWorkOrderMock = factory.externalXpandWorkOrder.buildList(3)

    it('returns err if request fails', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/residenceId/${rentalPropertyId}`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result =
        await workOrderAdapter.getXpandWorkOrdersByRentalPropertyId(
          rentalPropertyId
        )

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns work order data', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/residenceId/${rentalPropertyId}`,
          () =>
            HttpResponse.json(
              {
                content: { workOrders: xpandWorkOrderMock },
              },
              { status: 200 }
            )
        )
      )

      const result =
        await workOrderAdapter.getXpandWorkOrdersByRentalPropertyId(
          rentalPropertyId
        )

      expect(result).toMatchObject({
        ok: true,
        data: xpandWorkOrderMock,
      })
    })
  })

  describe(workOrderAdapter.getXpandWorkOrderDetails, () => {
    const workOrderCode = '25-000050'
    const xpandWorkOrderDetailsMock =
      factory.externalXpandWorkOrderDetails.build({
        Code: workOrderCode,
      })

    it('returns err if request fails', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/${workOrderCode}`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result =
        await workOrderAdapter.getXpandWorkOrderDetails(workOrderCode)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns not-found if work order is not found', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/${workOrderCode}`,
          () => new HttpResponse(null, { status: 404 })
        )
      )

      const result =
        await workOrderAdapter.getXpandWorkOrderDetails(workOrderCode)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('not-found')
    })

    it('returns work order data', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/${workOrderCode}`,
          () =>
            HttpResponse.json(
              {
                content: xpandWorkOrderDetailsMock,
              },
              { status: 200 }
            )
        )
      )

      const result =
        await workOrderAdapter.getXpandWorkOrderDetails(workOrderCode)

      expect(result).toMatchObject({
        ok: true,
        data: xpandWorkOrderDetailsMock,
      })
    })
  })

  describe(workOrderAdapter.createWorkOrder, () => {
    const createWorkOrderMock = factory.createWorkOrder.build()
    it('returns err if request fails', async () => {
      mockServer.use(
        http.post(
          `${config.workOrderService.url}/workOrders`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result = await workOrderAdapter.createWorkOrder(createWorkOrderMock)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns work order data', async () => {
      mockServer.use(
        http.post(`${config.workOrderService.url}/workOrders`, () =>
          HttpResponse.json(
            {
              content: { newWorkOrderId: 1 },
            },
            { status: 200 }
          )
        )
      )

      const result = await workOrderAdapter.createWorkOrder(createWorkOrderMock)

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data).toEqual({ newWorkOrderId: 1 })
    })
  })

  describe(workOrderAdapter.updateWorkOrder, () => {
    it('returns err if request fails', async () => {
      mockServer.use(
        http.post(
          `${config.workOrderService.url}/workOrders/1/update`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result = await workOrderAdapter.updateWorkOrder('1', 'Test message')

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns updated work order data', async () => {
      mockServer.use(
        http.post(`${config.workOrderService.url}/workOrders/1/update`, () =>
          HttpResponse.json(
            {
              content: { message: 'Message added to work order with ID 1' },
            },
            { status: 200 }
          )
        )
      )

      const result = await workOrderAdapter.updateWorkOrder('1', 'Test message')

      expect(result.ok).toBe(true)
      if (result.ok)
        expect(result.data).toEqual('Message added to work order with ID 1')
    })
  })

  describe(workOrderAdapter.closeWorkOrder, () => {
    it('returns err if request fails', async () => {
      mockServer.use(
        http.post(
          `${config.workOrderService.url}/workOrders/1/close`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result = await workOrderAdapter.closeWorkOrder('1')

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns closed work order data', async () => {
      mockServer.use(
        http.post(`${config.workOrderService.url}/workOrders/1/close`, () =>
          HttpResponse.json(
            {
              content: { message: 'Work order with ID 1 updated successfully' },
            },
            { status: 200 }
          )
        )
      )

      const result = await workOrderAdapter.closeWorkOrder('1')

      expect(result.ok).toBe(true)
      if (result.ok)
        expect(result.data).toEqual('Work order with ID 1 updated successfully')
    })
  })

  describe(workOrderAdapter.getWorkOrdersByPropertyId, () => {
    const propertyId = '123'
    const workOrderMock = factory.externalOdooWorkOrder.buildList(2)

    it('returns err if request fails', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/propertyId/${propertyId}`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result =
        await workOrderAdapter.getWorkOrdersByPropertyId(propertyId)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns work order data', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/propertyId/${propertyId}`,
          () =>
            HttpResponse.json(
              {
                content: { workOrders: workOrderMock },
              },
              { status: 200 }
            )
        )
      )

      const result =
        await workOrderAdapter.getWorkOrdersByPropertyId(propertyId)

      expect(result).toMatchObject({
        ok: true,
        data: workOrderMock,
      })
    })
  })

  describe(workOrderAdapter.getXpandWorkOrdersByPropertyId, () => {
    const propertyId = '123'
    const xpandWorkOrderMock = factory.externalXpandWorkOrder.buildList(3)

    it('returns err if request fails', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/propertyId/${propertyId}`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result =
        await workOrderAdapter.getXpandWorkOrdersByPropertyId(propertyId)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns work order data', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/propertyId/${propertyId}`,
          () =>
            HttpResponse.json(
              {
                content: { workOrders: xpandWorkOrderMock },
              },
              { status: 200 }
            )
        )
      )

      const result =
        await workOrderAdapter.getXpandWorkOrdersByPropertyId(propertyId)

      expect(result).toMatchObject({
        ok: true,
        data: xpandWorkOrderMock,
      })
    })

    it('returns work order data with query params', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/propertyId/${propertyId}`,
          () =>
            HttpResponse.json(
              {
                content: { workOrders: xpandWorkOrderMock },
              },
              { status: 200 }
            )
        )
      )

      const result = await workOrderAdapter.getXpandWorkOrdersByPropertyId(
        propertyId,
        {
          skip: 10,
          limit: 50,
          sortAscending: true,
        }
      )

      expect(result).toMatchObject({
        ok: true,
        data: xpandWorkOrderMock,
      })
    })
  })
})
