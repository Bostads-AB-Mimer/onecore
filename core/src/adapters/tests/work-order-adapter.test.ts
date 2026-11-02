import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { logger } from '@onecore/utilities'

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

  describe(workOrderAdapter.getXpandWorkOrdersByContactCode, () => {
    const contactCode = 'P174958'
    const xpandWorkOrderMock = factory.externalXpandWorkOrder.buildList(3)

    it('returns err if request fails', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/contactCode/${contactCode}`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result =
        await workOrderAdapter.getXpandWorkOrdersByContactCode(contactCode)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns work order data', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/contactCode/${contactCode}`,
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
        await workOrderAdapter.getXpandWorkOrdersByContactCode(contactCode)

      expect(result).toMatchObject({
        ok: true,
        data: xpandWorkOrderMock,
      })
    })

    it('returns work order data with query params', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/contactCode/${contactCode}`,
          () =>
            HttpResponse.json(
              {
                content: { workOrders: xpandWorkOrderMock },
              },
              { status: 200 }
            )
        )
      )

      const result = await workOrderAdapter.getXpandWorkOrdersByContactCode(
        contactCode,
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
    it('returns the message when the work order is closed', async () => {
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

      expect(result).toEqual({
        ok: true,
        data: 'Work order with ID 1 updated successfully',
      })
    })

    it('treats any 2xx as closed, also a service still answering a top-level message', async () => {
      mockServer.use(
        http.post(`${config.workOrderService.url}/workOrders/1/close`, () =>
          HttpResponse.json(
            { message: 'Work order with ID 1 updated successfully' },
            { status: 200 }
          )
        )
      )

      const result = await workOrderAdapter.closeWorkOrder('1')

      expect(result.ok).toBe(true)
    })

    it('returns refused with the reason when the service answers 409', async () => {
      mockServer.use(
        http.post(`${config.workOrderService.url}/workOrders/1/close`, () =>
          HttpResponse.json(
            { error: 'refused', reason: 'Vägrad' },
            { status: 409 }
          )
        )
      )

      const result = await workOrderAdapter.closeWorkOrder('1')

      expect(result).toEqual({ ok: false, err: 'refused', message: 'Vägrad' })
    })

    it('returns request-failed when the service answers 500', async () => {
      mockServer.use(
        http.post(
          `${config.workOrderService.url}/workOrders/1/close`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result = await workOrderAdapter.closeWorkOrder('1')

      expect(result).toEqual({ ok: false, err: 'request-failed' })
    })

    it('logs a failure the work-order service has not logged', async () => {
      const loggerErrorSpy = jest.spyOn(logger, 'error')
      mockServer.use(
        http.post(
          `${config.workOrderService.url}/workOrders/1/close`,
          () => new HttpResponse(null, { status: 503 })
        )
      )

      const result = await workOrderAdapter.closeWorkOrder('1')

      expect(result).toEqual({ ok: false, err: 'request-failed' })
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        { status: 503 },
        'work-order-adapter.closeWorkOrder'
      )
      loggerErrorSpy.mockRestore()
    })

    it('does not log the service own 500 a second time', async () => {
      const loggerErrorSpy = jest.spyOn(logger, 'error')
      mockServer.use(
        http.post(`${config.workOrderService.url}/workOrders/1/close`, () =>
          HttpResponse.json({ error: 'odoo-error' }, { status: 500 })
        )
      )

      await workOrderAdapter.closeWorkOrder('1')

      expect(loggerErrorSpy).not.toHaveBeenCalled()
      loggerErrorSpy.mockRestore()
    })

    it('returns request-error when the service cannot be reached', async () => {
      mockServer.use(
        http.post(`${config.workOrderService.url}/workOrders/1/close`, () =>
          HttpResponse.error()
        )
      )

      const result = await workOrderAdapter.closeWorkOrder('1')

      expect(result).toEqual({ ok: false, err: 'request-error' })
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

  describe(workOrderAdapter.getWorkOrdersByMaintenanceUnitCode, () => {
    const maintenanceUnitCode = 'UNIT-123'
    const workOrderMock = factory.externalOdooWorkOrder.buildList(2)

    it('returns err if request fails', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/maintenanceUnitCode/${maintenanceUnitCode}`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result =
        await workOrderAdapter.getWorkOrdersByMaintenanceUnitCode(
          maintenanceUnitCode
        )

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns work order data', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/maintenanceUnitCode/${maintenanceUnitCode}`,
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
        await workOrderAdapter.getWorkOrdersByMaintenanceUnitCode(
          maintenanceUnitCode
        )

      expect(result).toMatchObject({
        ok: true,
        data: workOrderMock,
      })
    })
  })

  describe(workOrderAdapter.getXpandWorkOrdersByMaintenanceUnitCode, () => {
    const maintenanceUnitCode = 'UNIT-456'
    const xpandWorkOrderMock = factory.externalXpandWorkOrder.buildList(3)

    it('returns err if request fails', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/maintenanceUnitCode/${maintenanceUnitCode}`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result =
        await workOrderAdapter.getXpandWorkOrdersByMaintenanceUnitCode(
          maintenanceUnitCode
        )

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns work order data', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/maintenanceUnitCode/${maintenanceUnitCode}`,
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
        await workOrderAdapter.getXpandWorkOrdersByMaintenanceUnitCode(
          maintenanceUnitCode
        )

      expect(result).toMatchObject({
        ok: true,
        data: xpandWorkOrderMock,
      })
    })

    it('returns work order data with query params', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/maintenanceUnitCode/${maintenanceUnitCode}`,
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
        await workOrderAdapter.getXpandWorkOrdersByMaintenanceUnitCode(
          maintenanceUnitCode,
          {
            skip: 5,
            limit: 25,
            sortAscending: false,
          }
        )

      expect(result).toMatchObject({
        ok: true,
        data: xpandWorkOrderMock,
      })
    })
  })

  describe(workOrderAdapter.getWorkOrdersByBuildingId, () => {
    const buildingId = '789-012'
    const workOrderMock = factory.externalOdooWorkOrder.buildList(2)

    it('returns err if request fails', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/buildingId/${buildingId}`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result =
        await workOrderAdapter.getWorkOrdersByBuildingId(buildingId)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns work order data', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/buildingId/${buildingId}`,
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
        await workOrderAdapter.getWorkOrdersByBuildingId(buildingId)

      expect(result).toMatchObject({
        ok: true,
        data: workOrderMock,
      })
    })
  })

  describe(workOrderAdapter.getXpandWorkOrdersByBuildingId, () => {
    const buildingId = '789-012'
    const xpandWorkOrderMock = factory.externalXpandWorkOrder.buildList(3)

    it('returns err if request fails', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/buildingId/${buildingId}`,
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result =
        await workOrderAdapter.getXpandWorkOrdersByBuildingId(buildingId)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.err).toBe('unknown')
    })

    it('returns work order data', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/buildingId/${buildingId}`,
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
        await workOrderAdapter.getXpandWorkOrdersByBuildingId(buildingId)

      expect(result).toMatchObject({
        ok: true,
        data: xpandWorkOrderMock,
      })
    })

    it('returns work order data with query params', async () => {
      mockServer.use(
        http.get(
          `${config.workOrderService.url}/workOrders/xpand/buildingId/${buildingId}`,
          () =>
            HttpResponse.json(
              {
                content: { workOrders: xpandWorkOrderMock },
              },
              { status: 200 }
            )
        )
      )

      const result = await workOrderAdapter.getXpandWorkOrdersByBuildingId(
        buildingId,
        {
          skip: 0,
          limit: 100,
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
