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

import {
  createInspectionWorkOrders,
  createWorkOrder,
  getMaintenanceTeams,
  getWorkOrderById,
  getWorkOrdersByContactCode,
} from '../../../adapters/odoo-adapter'

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

describe('odoo-adapter getWorkOrderById', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    odooMock.connect.mockResolvedValue(undefined)
  })

  it('returns the transformed work order with url and messages when found', async () => {
    const odooWorkOrder = factory.odooWorkOrder.build({ id: 12345 })
    const odooMessage = factory.odooWorkOrderMessage.build({ res_id: 12345 })

    odooMock.searchRead
      .mockResolvedValueOnce([odooWorkOrder]) // maintenance.request
      .mockResolvedValueOnce([odooMessage]) // mail.message

    const result = await getWorkOrderById(12345)

    // maintenance.request queried by id
    expect(odooMock.searchRead.mock.calls[0][0]).toBe('maintenance.request')
    expect(odooMock.searchRead.mock.calls[0][1]).toEqual([['id', '=', 12345]])

    expect(result).toMatchObject({
      Code: 'od-12345',
      Url: expect.stringContaining('id=12345'),
    })
    expect(result?.Messages).toHaveLength(1)
  })

  it('returns undefined when no work order matches the id', async () => {
    odooMock.searchRead.mockResolvedValueOnce([]) // maintenance.request

    const result = await getWorkOrderById(999)

    expect(result).toBeUndefined()
    // Should not query messages when there is no work order
    expect(odooMock.searchRead).toHaveBeenCalledTimes(1)
  })

  it('includes receipt_to_tenant in the message_type allowlist so Mina sidor sees handler/contractor acknowledgement receipts (MIM-1960)', async () => {
    const odooWorkOrder = factory.odooWorkOrder.build({ id: 12345 })
    const odooMessage = factory.odooWorkOrderMessage.build({ res_id: 12345 })

    odooMock.searchRead
      .mockResolvedValueOnce([odooWorkOrder]) // maintenance.request
      .mockResolvedValueOnce([odooMessage]) // mail.message

    await getWorkOrderById(12345)

    // mail.message queried with the tenant-visible message_type allowlist
    expect(odooMock.searchRead.mock.calls[1][0]).toBe('mail.message')
    const messageDomain = odooMock.searchRead.mock.calls[1][1]
    const messageTypeFilter = messageDomain.find(
      (clause: unknown[]) => clause[0] === 'message_type'
    )
    expect(messageTypeFilter[2]).toContain('receipt_to_tenant')
  })
})

describe('odoo-adapter getMaintenanceTeams', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    odooMock.connect.mockResolvedValue(undefined)
  })

  it('returns the teams from maintenance.team', async () => {
    const teams = [
      { id: 1, name: 'Snickare' },
      { id: 2, name: 'VVS' },
    ]
    odooMock.searchRead.mockResolvedValueOnce(teams)

    const result = await getMaintenanceTeams()

    expect(result).toEqual({ ok: true, data: teams })
    expect(odooMock.searchRead).toHaveBeenCalledWith(
      'maintenance.team',
      [],
      ['id', 'name']
    )
  })

  it('returns ok: false when Odoo is unreachable', async () => {
    odooMock.searchRead.mockRejectedValueOnce(new Error('connection refused'))

    const result = await getMaintenanceTeams()

    expect(result.ok).toBe(false)
  })
})

describe('odoo-adapter createInspectionWorkOrders', () => {
  const groups = [
    {
      maintenanceTeamId: 1,
      maintenanceTeamName: 'Snickare',
      descriptionHtml: 'A',
    },
    { maintenanceTeamId: 2, maintenanceTeamName: 'VVS', descriptionHtml: 'B' },
  ]

  // The groups run concurrently, so mocks are keyed by model/values rather
  // than by call order.
  const setupCreateMocks = (opts?: { failTeamId?: number }) => {
    odooMock.create.mockImplementation(
      async (model: string, values: Record<string, unknown>) => {
        if (model === 'maintenance.rental.property') return 101
        if (model === 'maintenance.request') {
          const teamId = values.maintenance_team_id as number
          if (teamId === opts?.failTeamId) {
            throw new Error('odoo create failed')
          }
          return 1000 + teamId
        }
        throw new Error(`unexpected model ${model}`)
      }
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
    odooMock.connect.mockResolvedValue(undefined)
    odooMock.update.mockResolvedValue(true)
    // Category lookup (Besiktning)
    odooMock.search.mockResolvedValue([42])
    // Default: no pre-existing requests
    odooMock.searchRead.mockResolvedValue([])
  })

  it('creates one request per group with back-ref, in input order', async () => {
    setupCreateMocks()
    const rentalProperty = factory.rentalProperty.build()

    const result = await createInspectionWorkOrders(rentalProperty, groups)

    expect(result).toEqual({
      ok: true,
      data: [
        { maintenanceTeamId: 1, ok: true, workOrderId: 1001 },
        { maintenanceTeamId: 2, ok: true, workOrderId: 1002 },
      ],
    })

    const requestCalls = odooMock.create.mock.calls.filter(
      ([model]) => model === 'maintenance.request'
    )
    expect(requestCalls).toHaveLength(2)
    // Without an inspectionId the name falls back to the rental property id.
    expect(requestCalls.map(([, values]) => values.name)).toEqual(
      expect.arrayContaining([
        `Besiktning ${rentalProperty.id} – Snickare`,
        `Besiktning ${rentalProperty.id} – VVS`,
      ])
    )
    expect(
      requestCalls.every(
        ([, values]) => values.maintenance_request_category_id === 42
      )
    ).toBe(true)

    // Each rental-property child is back-referenced to its request.
    const backRefCalls = odooMock.update.mock.calls.filter(
      ([model]) => model === 'maintenance.rental.property'
    )
    expect(backRefCalls).toHaveLength(2)
    expect(backRefCalls[0][1]).toBe(101)
  })

  it('reports per-group failures without aborting the other groups', async () => {
    setupCreateMocks({ failTeamId: 1 })
    const rentalProperty = factory.rentalProperty.build()

    const result = await createInspectionWorkOrders(rentalProperty, groups)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toEqual([
      { maintenanceTeamId: 1, ok: false, err: 'odoo create failed' },
      { maintenanceTeamId: 2, ok: true, workOrderId: 1002 },
    ])
  })

  it('updates the existing open request instead of creating a duplicate when inspectionId matches', async () => {
    setupCreateMocks()
    const rentalProperty = factory.rentalProperty.build()
    odooMock.searchRead.mockImplementation(
      async (model: string, domain: unknown[][]) => {
        if (
          model === 'maintenance.request' &&
          domain?.[0]?.[2] === 'Besiktning INSP-1 – Snickare'
        ) {
          return [{ id: 555 }]
        }
        return []
      }
    )

    const result = await createInspectionWorkOrders(
      rentalProperty,
      groups,
      'INSP-1'
    )

    expect(result).toEqual({
      ok: true,
      data: [
        { maintenanceTeamId: 1, ok: true, workOrderId: 555 },
        { maintenanceTeamId: 2, ok: true, workOrderId: 1002 },
      ],
    })

    // Team 1: existing request refreshed, nothing created.
    expect(odooMock.update).toHaveBeenCalledWith('maintenance.request', 555, {
      description: 'A',
    })
    const requestCalls = odooMock.create.mock.calls.filter(
      ([model]) => model === 'maintenance.request'
    )
    expect(requestCalls).toHaveLength(1)
    // Team 2: created with the inspection-scoped name.
    expect(requestCalls[0][1]).toMatchObject({
      name: 'Besiktning INSP-1 – VVS',
      description: 'B',
    })
    // The dedup search only considers open (not done) requests.
    const dedupCall = odooMock.searchRead.mock.calls.find(
      ([model]) => model === 'maintenance.request'
    )
    expect(dedupCall?.[1]).toEqual(
      expect.arrayContaining([['stage_id.done', '=', false]])
    )
  })

  it('returns ok: false when the Besiktning category cannot be resolved', async () => {
    setupCreateMocks()
    odooMock.search.mockResolvedValue([])
    const rentalProperty = factory.rentalProperty.build()

    const result = await createInspectionWorkOrders(rentalProperty, groups)

    expect(result.ok).toBe(false)
    expect(odooMock.create).not.toHaveBeenCalled()
  })
})

describe('odoo-adapter message domain', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    odooMock.connect.mockResolvedValue(undefined)
  })

  // The Mina sidor feed only returns message types named in MESSAGE_DOMAIN, so a
  // missing type is invisible to the tenant even though the message exists in
  // Odoo. tenant_my_pages is the MIM-1957 "publish without SMS/e-post" type.
  it('includes tenant_my_pages so Mina sidor-only messages reach the tenant', async () => {
    odooMock.searchRead
      .mockResolvedValueOnce([]) // maintenance.request
      .mockResolvedValueOnce([]) // mail.message

    await getWorkOrdersByContactCode('P123456')

    const messageCall = odooMock.searchRead.mock.calls.find(
      (call: unknown[]) => call[0] === 'mail.message'
    )
    expect(messageCall).toBeDefined()
    const domain = messageCall![1] as unknown[][]
    const messageTypeClause = domain.find(
      (clause) => clause[0] === 'message_type'
    )
    expect(messageTypeClause).toBeDefined()
    expect(messageTypeClause![2] as string[]).toContain('tenant_my_pages')
  })
})
