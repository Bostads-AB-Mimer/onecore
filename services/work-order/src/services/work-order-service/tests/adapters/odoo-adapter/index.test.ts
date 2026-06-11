import * as factory from '../../factories'

const odooMock = {
  connect: jest.fn(),
  create: jest.fn(),
  search: jest.fn(),
  searchRead: jest.fn(),
  update: jest.fn(),
}

jest.mock('odoo-await', () => {
  return jest.fn().mockImplementation(() => odooMock)
})

const loggerWarnMock = jest.fn()

jest.mock('@onecore/utilities', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: (...args: unknown[]) => loggerWarnMock(...args),
  },
  generateRouteMetadata: jest.fn(() => ({})),
}))

import { createWorkOrder } from '../../../adapters/odoo-adapter'

describe('odoo-adapter createWorkOrder', () => {
  const setupCreateMocks = () => {
    odooMock.create
      .mockResolvedValueOnce(101) // rental property
      .mockResolvedValueOnce(102) // lease
      .mockResolvedValueOnce(103) // tenant
  }

  beforeEach(() => {
    jest.clearAllMocks()
    odooMock.connect.mockResolvedValue(undefined)
    odooMock.search.mockImplementation(async (model: string) => {
      if (model === 'maintenance.team') return [1]
      if (model === 'maintenance.request.category') return [42]
      return []
    })
  })

  it('creates a maintenance unit record when MaintenanceUnitCode matches one on the rental property', async () => {
    setupCreateMocks()
    odooMock.create
      .mockResolvedValueOnce(104) // maintenance unit
      .mockResolvedValueOnce(999) // work order

    const rentalProperty = factory.rentalProperty.build()
    const details = factory.CreateWorkOrderDetails.build({
      Rows: [
        {
          LocationCode: 'TV',
          PartOfBuildingCode: 'TM',
          Description: 'Trasig tvättmaskin',
          MaintenanceUnitCode: '705T15',
          MaintenanceUnitCaption: 'TVÄTTSTUGA Stentorpsgatan 7 C',
        },
      ],
    })

    const result = await createWorkOrder(
      rentalProperty,
      factory.tenant.build(),
      factory.lease.build(),
      details
    )

    expect(result).toEqual({ ok: true, data: 999 })

    const maintenanceUnitCall = odooMock.create.mock.calls.find(
      ([model]) => model === 'maintenance.maintenance.unit'
    )
    expect(maintenanceUnitCall).toBeDefined()
    expect(maintenanceUnitCall?.[1]).toMatchObject({ code: '705T15' })

    const requestCall = odooMock.create.mock.calls.find(
      ([model]) => model === 'maintenance.request'
    )
    expect(requestCall?.[1]).toMatchObject({ maintenance_unit_id: '104' })

    expect(loggerWarnMock).not.toHaveBeenCalled()
  })

  it('does not create a maintenance unit record when MaintenanceUnitCode is missing', async () => {
    setupCreateMocks()
    odooMock.create.mockResolvedValueOnce(999) // work order

    const rentalProperty = factory.rentalProperty.build()
    const details = factory.CreateWorkOrderDetails.build()

    const result = await createWorkOrder(
      rentalProperty,
      factory.tenant.build(),
      factory.lease.build(),
      details
    )

    expect(result).toEqual({ ok: true, data: 999 })

    const maintenanceUnitCall = odooMock.create.mock.calls.find(
      ([model]) => model === 'maintenance.maintenance.unit'
    )
    expect(maintenanceUnitCall).toBeUndefined()

    const requestCall = odooMock.create.mock.calls.find(
      ([model]) => model === 'maintenance.request'
    )
    expect(requestCall?.[1]).toMatchObject({ maintenance_unit_id: false })

    expect(loggerWarnMock).not.toHaveBeenCalled()
  })

  it('logs a warning and skips creating the maintenance unit when the code does not match any unit on the rental property', async () => {
    setupCreateMocks()
    odooMock.create.mockResolvedValueOnce(999) // work order

    const rentalProperty = factory.rentalProperty.build()
    const details = factory.CreateWorkOrderDetails.build({
      Rows: [
        {
          LocationCode: 'TV',
          PartOfBuildingCode: 'TM',
          Description: 'Trasig tvättmaskin',
          MaintenanceUnitCode: 'UNKNOWN-CODE',
          MaintenanceUnitCaption: 'Okänd enhet',
        },
      ],
    })

    const result = await createWorkOrder(
      rentalProperty,
      factory.tenant.build(),
      factory.lease.build(),
      details
    )

    expect(result).toEqual({ ok: true, data: 999 })

    const maintenanceUnitCall = odooMock.create.mock.calls.find(
      ([model]) => model === 'maintenance.maintenance.unit'
    )
    expect(maintenanceUnitCall).toBeUndefined()

    expect(loggerWarnMock).toHaveBeenCalledTimes(1)
    const [context, message] = loggerWarnMock.mock.calls[0]
    expect(context).toMatchObject({
      rowMaintenanceUnitCode: 'UNKNOWN-CODE',
      rentalPropertyId: rentalProperty.id,
      availableMaintenanceUnitCodes: rentalProperty.maintenanceUnits?.map(
        (mu) => mu.code
      ),
    })
    expect(message).toMatch(/maintenance unit code provided but not found/i)
  })
})
