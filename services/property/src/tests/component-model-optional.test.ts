jest.mock('../adapters/db', () => ({
  prisma: {
    components: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    componentSubtypes: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    componentModels: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    componentInstallations: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
      fn(jest.requireMock('../adapters/db').prisma)
    ),
  },
}))

import {
  ComponentSchema,
  CreateComponentSchema,
  UpdateComponentSchema,
  componentsQueryParamsSchema,
} from '../types/component'
import { prisma } from '../adapters/db'
import {
  findComponentModelProblem,
  getComponentById,
  getComponentsByRoomId,
} from '../adapters/component-instance-adapter'
import {
  getComponentInstallationById,
  getComponentInstallations,
} from '../adapters/component-installation-adapter'
import { findModelByExactName } from '../adapters/component-model-adapter'
import {
  getComponentSubtypeById,
  getComponentSubtypes,
} from '../adapters/component-subtype-adapter'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import request from 'supertest'
import { routes as componentRoutes } from '../routes/component-instances'
import { routes as modelRoutes } from '../routes/component-models'
import { routes as subtypeRoutes } from '../routes/component-subtypes'
import { routes as installationRoutes } from '../routes/component-installations'

const timestamps = {
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
}
const subtypeId = '00000000-0000-0000-0002-000000000001'
const modelId = '00000000-0000-0000-0003-000000000001'

describe('Component schema', () => {
  it('requires subtypeId and allows a null model', () => {
    const component = ComponentSchema.parse({
      id: '00000000-0000-0000-0004-000000000001',
      subtypeId,
      modelId: null,
      serialNumber: null,
      warrantyStartDate: null,
      warrantyMonths: null,
      priceAtPurchase: null,
      depreciationPriceAtPurchase: null,
      economicLifespan: null,
      quantity: 14.5,
      ncsCode: 'S 0502-Y',
      status: 'ACTIVE',
      model: null,
      ...timestamps,
    })

    expect(component).toMatchObject({ subtypeId, modelId: null, model: null })
    expect(component.warrantyMonths).toBeNull()
  })

  it('rejects a component without subtypeId', () => {
    const result = ComponentSchema.safeParse({
      id: '00000000-0000-0000-0004-000000000001',
      modelId,
      serialNumber: null,
      warrantyStartDate: null,
      warrantyMonths: 0,
      priceAtPurchase: 0,
      depreciationPriceAtPurchase: 0,
      economicLifespan: 0,
      quantity: 1,
      status: 'ACTIVE',
      ...timestamps,
    })

    expect(result.success).toBe(false)
  })

  it('parses a nested subtype and a Date warrantyStartDate from a Prisma row', () => {
    const component = ComponentSchema.parse({
      id: '00000000-0000-0000-0004-000000000001',
      subtypeId,
      modelId: null,
      serialNumber: null,
      warrantyStartDate: new Date('2026-01-01T00:00:00.000Z'),
      warrantyMonths: null,
      priceAtPurchase: null,
      depreciationPriceAtPurchase: null,
      economicLifespan: null,
      quantity: 1,
      status: 'ACTIVE',
      subtype: {
        id: subtypeId,
        subTypeName: 'Målning väggar',
        typeId: '00000000-0000-0000-0001-000000000001',
        xpandCode: null,
        depreciationPrice: 0,
        technicalLifespan: 0,
        economicLifespan: 0,
        replacementIntervalMonths: 0,
        quantityType: 'SQUARE_METER',
        ...timestamps,
      },
      ...timestamps,
    })

    expect(component.subtype?.subTypeName).toBe('Målning väggar')
    expect(component.warrantyStartDate).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('Create and update component schemas', () => {
  it('requires subtypeId and leaves the numerics undefined when not given', () => {
    const data = CreateComponentSchema.parse({ subtypeId })

    expect(data).toMatchObject({ subtypeId, status: 'ACTIVE', quantity: 1 })
    expect(data.modelId).toBeUndefined()
    expect(data.warrantyMonths).toBeUndefined()
    expect(data.priceAtPurchase).toBeUndefined()
  })

  it('accepts an explicit null modelId on create', () => {
    const data = CreateComponentSchema.parse({ subtypeId, modelId: null })

    expect(data.modelId).toBeNull()
  })

  it('rejects create without subtypeId', () => {
    expect(CreateComponentSchema.safeParse({ modelId }).success).toBe(false)
  })

  it('accepts null to clear a model on update', () => {
    const data = UpdateComponentSchema.parse({ modelId: null })

    expect(data.modelId).toBeNull()
  })

  it('caps ncsCode at 15 characters', () => {
    expect(
      CreateComponentSchema.safeParse({ subtypeId, ncsCode: 'S 1050-Y90R' })
        .success
    ).toBe(true)
    expect(
      CreateComponentSchema.safeParse({
        subtypeId,
        ncsCode: 'NCS S 1050-Y90R x',
      }).success
    ).toBe(false)
  })

  it('lets an update move a component to another subtype', () => {
    const other = '00000000-0000-0000-0002-000000000002'

    expect(UpdateComponentSchema.parse({ subtypeId: other }).subtypeId).toBe(
      other
    )
    expect(UpdateComponentSchema.parse({}).subtypeId).toBeUndefined()
  })

  it('trims ncsCode before applying the 15-character cap', () => {
    const data = CreateComponentSchema.parse({
      subtypeId,
      ncsCode: '   S 1050-Y90R   ',
    })

    expect(data.ncsCode).toBe('S 1050-Y90R')
  })
})

describe('componentsQueryParamsSchema', () => {
  it('accepts a subtypeId filter', () => {
    const params = componentsQueryParamsSchema.parse({ subtypeId })

    expect(params.subtypeId).toBe(subtypeId)
  })
})

describe('findComponentModelProblem', () => {
  const findSubtype = prisma.componentSubtypes.findUnique as jest.Mock
  const findModel = prisma.componentModels.findUnique as jest.Mock

  const surfaceSubtype = {
    id: subtypeId,
    componentType: { category: { type: 'SURFACE' } },
  }
  const equipmentSubtype = {
    id: subtypeId,
    componentType: { category: { type: 'EQUIPMENT' } },
  }

  beforeEach(() => {
    findSubtype.mockReset()
    findModel.mockReset()
  })

  it('rejects an unknown subtype', async () => {
    findSubtype.mockResolvedValueOnce(null)

    await expect(
      findComponentModelProblem({ subtypeId, modelId: null })
    ).resolves.toBe('subtype_not_found')
  })

  it('accepts a surface without a model', async () => {
    findSubtype.mockResolvedValueOnce(surfaceSubtype)

    await expect(
      findComponentModelProblem({ subtypeId, modelId: null })
    ).resolves.toBeNull()
    expect(findModel).not.toHaveBeenCalled()
  })

  it('rejects a model on a surface', async () => {
    findSubtype.mockResolvedValueOnce(surfaceSubtype)

    await expect(
      findComponentModelProblem({ subtypeId, modelId })
    ).resolves.toBe('surface_has_model')
    expect(findModel).not.toHaveBeenCalled()
  })

  it('rejects an unknown model', async () => {
    findSubtype.mockResolvedValueOnce(equipmentSubtype)
    findModel.mockResolvedValueOnce(null)

    await expect(
      findComponentModelProblem({ subtypeId, modelId })
    ).resolves.toBe('model_not_found')
  })

  it('rejects a model that belongs to another subtype', async () => {
    findSubtype.mockResolvedValueOnce(equipmentSubtype)
    findModel.mockResolvedValueOnce({
      id: modelId,
      componentSubtypeId: '00000000-0000-0000-0002-000000000099',
    })

    await expect(
      findComponentModelProblem({ subtypeId, modelId })
    ).resolves.toBe('model_subtype_mismatch')
  })

  it('accepts an appliance whose model matches the subtype', async () => {
    findSubtype.mockResolvedValueOnce(equipmentSubtype)
    findModel.mockResolvedValueOnce({
      id: modelId,
      componentSubtypeId: subtypeId,
    })

    await expect(
      findComponentModelProblem({ subtypeId, modelId })
    ).resolves.toBeNull()
  })

  it('accepts an appliance without a model', async () => {
    findSubtype.mockResolvedValueOnce(equipmentSubtype)

    await expect(
      findComponentModelProblem({ subtypeId, modelId: undefined })
    ).resolves.toBeNull()
    expect(findModel).not.toHaveBeenCalled()
  })
})

describe('POST and PUT /components', () => {
  const componentId = '00000000-0000-0000-0004-000000000001'
  const app = new Koa()
  const router = new KoaRouter()
  componentRoutes(router)
  app.use(bodyParser())
  app.use(router.routes())

  const findSubtype = prisma.componentSubtypes.findUnique as jest.Mock
  const findModel = prisma.componentModels.findUnique as jest.Mock
  const findComponent = prisma.components.findUnique as jest.Mock
  const createComponent = prisma.components.create as jest.Mock
  const updateComponent = prisma.components.update as jest.Mock

  const surfaceSubtype = {
    id: subtypeId,
    componentType: { category: { type: 'SURFACE' } },
  }
  const equipmentSubtype = {
    id: subtypeId,
    componentType: { category: { type: 'EQUIPMENT' } },
  }
  const storedWall = {
    id: componentId,
    subtypeId,
    modelId: null,
    serialNumber: null,
    warrantyStartDate: null,
    warrantyMonths: null,
    priceAtPurchase: null,
    depreciationPriceAtPurchase: null,
    economicLifespan: null,
    quantity: 14.5,
    ncsCode: 'S 0502-Y',
    status: 'ACTIVE',
    condition: null,
    lastInspectionDate: null,
    ...timestamps,
  }

  beforeEach(() => {
    findSubtype.mockReset()
    findModel.mockReset()
    findComponent.mockReset()
    createComponent.mockReset()
    updateComponent.mockReset()
  })

  it('creates a surface component with no model and null numerics', async () => {
    findSubtype.mockResolvedValueOnce(surfaceSubtype)
    createComponent.mockResolvedValueOnce(storedWall)

    const res = await request(app.callback())
      .post('/components')
      .send({ subtypeId, quantity: 14.5, ncsCode: 'S 0502-Y' })

    expect(res.status).toBe(201)
    expect(res.body.content).toMatchObject({
      subtypeId,
      modelId: null,
    })
    expect(createComponent).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subtypeId }) })
    )
    const [{ data }] = createComponent.mock.calls[0]
    expect(data).not.toHaveProperty('warrantyMonths')
  })

  it('returns 400 for a model on a surface', async () => {
    findSubtype.mockResolvedValueOnce(surfaceSubtype)

    const res = await request(app.callback())
      .post('/components')
      .send({ subtypeId, modelId })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/SURFACE/)
    expect(createComponent).not.toHaveBeenCalled()
  })

  it('returns 400 when the model belongs to another subtype', async () => {
    findSubtype.mockResolvedValueOnce(equipmentSubtype)
    findModel.mockResolvedValueOnce({
      id: modelId,
      componentSubtypeId: '00000000-0000-0000-0002-000000000099',
    })

    const res = await request(app.callback())
      .post('/components')
      .send({ subtypeId, modelId })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/subtype/)
  })

  it('returns 400 when subtypeId is missing', async () => {
    const res = await request(app.callback())
      .post('/components')
      .send({ modelId })

    expect(res.status).toBe(400)
    expect(findSubtype).not.toHaveBeenCalled()
  })

  it('re-checks on update when modelId changes', async () => {
    findComponent.mockResolvedValueOnce(storedWall)
    findSubtype.mockResolvedValueOnce(surfaceSubtype)

    const res = await request(app.callback())
      .put(`/components/${componentId}`)
      .send({ modelId })

    expect(res.status).toBe(400)
    expect(updateComponent).not.toHaveBeenCalled()
  })

  it('does not re-check on update when only the condition changes', async () => {
    findComponent.mockResolvedValueOnce(storedWall)
    updateComponent.mockResolvedValueOnce({ ...storedWall, condition: 'GOOD' })

    const res = await request(app.callback())
      .put(`/components/${componentId}`)
      .send({ condition: 'GOOD' })

    expect(res.status).toBe(200)
    expect(findSubtype).not.toHaveBeenCalled()
  })

  it('clears a model with null on update', async () => {
    findComponent.mockResolvedValueOnce({ ...storedWall, modelId })
    findSubtype.mockResolvedValueOnce(equipmentSubtype)
    updateComponent.mockResolvedValueOnce(storedWall)

    const res = await request(app.callback())
      .put(`/components/${componentId}`)
      .send({ modelId: null })

    expect(res.status).toBe(200)
    expect(res.body.content.modelId).toBeNull()
    expect(findModel).not.toHaveBeenCalled()
  })

  it('rejects moving a component with a model to another subtype', async () => {
    const otherSubtypeId = '00000000-0000-0000-0002-000000000002'
    findComponent.mockResolvedValueOnce({ ...storedWall, modelId })
    findSubtype.mockResolvedValueOnce({
      id: otherSubtypeId,
      componentType: { category: { type: 'EQUIPMENT' } },
    })
    findModel.mockResolvedValueOnce({
      id: modelId,
      componentSubtypeId: subtypeId,
    })

    const res = await request(app.callback())
      .put(`/components/${componentId}`)
      .send({ subtypeId: otherSubtypeId })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/subtype/)
    expect(updateComponent).not.toHaveBeenCalled()
  })

  it('maps a foreign key failure on write to 400', async () => {
    findSubtype.mockResolvedValueOnce(equipmentSubtype)
    createComponent.mockRejectedValueOnce(
      Object.assign(new Error('FK_components_subtype'), { code: 'P2003' })
    )

    const res = await request(app.callback())
      .post('/components')
      .send({ subtypeId })

    expect(res.status).toBe(400)
    expect(res.body.error).not.toMatch(/FK_/)
  })
})

const subtypeInclude = {
  subtype: {
    include: { componentType: { include: { category: true } } },
  },
}

describe('component reads include the subtype directly', () => {
  const findMany = prisma.components.findMany as jest.Mock
  const findUnique = prisma.components.findUnique as jest.Mock

  beforeEach(() => {
    findMany.mockReset()
    findUnique.mockReset()
  })

  it('getComponentsByRoomId includes subtype -> type -> category and the model', async () => {
    findMany.mockResolvedValueOnce([])

    await getComponentsByRoomId('ROOM-1')

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          ...subtypeInclude,
          model: true,
        }),
      })
    )
  })

  it('getComponentById includes subtype -> type -> category and the model', async () => {
    findUnique.mockResolvedValueOnce(null)

    await getComponentById('00000000-0000-0000-0004-000000000001')

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          ...subtypeInclude,
          model: true,
        }),
      })
    )
  })
})

describe('installation reads include the component subtype directly', () => {
  const findMany = prisma.componentInstallations.findMany as jest.Mock
  const findUnique = prisma.componentInstallations.findUnique as jest.Mock
  const count = prisma.componentInstallations.count as jest.Mock

  beforeEach(() => {
    findMany.mockReset()
    findUnique.mockReset()
    count.mockReset()
  })

  it('getComponentInstallations includes the component with subtype and model', async () => {
    findMany.mockResolvedValueOnce([])
    count.mockResolvedValueOnce(0)

    await getComponentInstallations({})

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { component: { include: { subtype: true, model: true } } },
      })
    )
  })

  it('getComponentInstallationById includes the component with subtype and model', async () => {
    findUnique.mockResolvedValueOnce(null)

    await getComponentInstallationById('00000000-0000-0000-0005-000000000001')

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { component: { include: { subtype: true, model: true } } },
      })
    )
  })
})

describe('findModelByExactName', () => {
  beforeEach(() => {
    ;(prisma.componentModels.findFirst as jest.Mock).mockReset()
  })

  it('scopes the lookup to the subtype when one is given', async () => {
    ;(prisma.componentModels.findFirst as jest.Mock).mockResolvedValueOnce(null)

    await findModelByExactName('Electrolux ESF5555', 'sub-1')

    expect(prisma.componentModels.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          modelName: { equals: 'Electrolux ESF5555' },
          componentSubtypeId: 'sub-1',
        }),
      })
    )
  })

  it('matches on name alone when no subtype is given', async () => {
    ;(prisma.componentModels.findFirst as jest.Mock).mockResolvedValueOnce(null)

    await findModelByExactName('Electrolux ESF5555')

    const [{ where }] = (prisma.componentModels.findFirst as jest.Mock).mock
      .calls[0]
    expect(where).not.toHaveProperty('componentSubtypeId')
  })
})

describe('getComponentSubtypeById', () => {
  it('includes the type and its category so callers can read category.type', async () => {
    ;(prisma.componentSubtypes.findUnique as jest.Mock).mockResolvedValueOnce(
      null
    )

    await getComponentSubtypeById('sub-1')

    expect(prisma.componentSubtypes.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          componentType: { include: { category: true } },
        }),
      })
    )
  })
})

describe('GET /component-models/by-name/:modelName', () => {
  const app = new Koa()
  const router = new KoaRouter()
  modelRoutes(router)
  app.use(bodyParser())
  app.use(router.routes())

  beforeEach(() => {
    ;(prisma.componentModels.findFirst as jest.Mock).mockReset()
  })

  it('rejects a malformed subtypeId with 400 before looking up the model', async () => {
    const res = await request(app.callback()).get(
      '/component-models/by-name/Foo?subtypeId=nope'
    )

    expect(res.status).toBe(400)
    expect(prisma.componentModels.findFirst).not.toHaveBeenCalled()
  })

  it('passes a valid subtypeId through to the lookup', async () => {
    ;(prisma.componentModels.findFirst as jest.Mock).mockResolvedValueOnce({
      id: modelId,
      modelName: 'Foo',
      componentSubtypeId: subtypeId,
      currentPrice: 0,
      currentInstallPrice: 0,
      warrantyMonths: 0,
      manufacturer: 'Unknown',
      technicalSpecification: null,
      installationInstructions: null,
      dimensions: null,
      coclassCode: null,
      ...timestamps,
    })

    const res = await request(app.callback()).get(
      `/component-models/by-name/Foo?subtypeId=${subtypeId}`
    )

    expect(res.status).toBe(200)
    expect(prisma.componentModels.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ componentSubtypeId: subtypeId }),
      })
    )
  })
})

describe('getComponentSubtypes by category type', () => {
  const findMany = prisma.componentSubtypes.findMany as jest.Mock
  const count = prisma.componentSubtypes.count as jest.Mock

  beforeEach(() => {
    findMany.mockReset()
    count.mockReset()
    findMany.mockResolvedValue([])
    count.mockResolvedValue(0)
  })

  it('filters on the category type and includes type and category', async () => {
    await getComponentSubtypes({ categoryType: 'SURFACE' })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          componentType: { category: { type: 'SURFACE' } },
        }),
        include: expect.objectContaining({
          componentType: { include: { category: true } },
        }),
      })
    )
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          componentType: { category: { type: 'SURFACE' } },
        }),
      })
    )
  })

  it('leaves the where clause alone without the filter', async () => {
    await getComponentSubtypes({})

    const [{ where }] = findMany.mock.calls[0]
    expect(where).not.toHaveProperty('componentType')
  })
})

describe('GET /component-subtypes', () => {
  const app = new Koa()
  const router = new KoaRouter()
  subtypeRoutes(router)
  app.use(bodyParser())
  app.use(router.routes())

  const findMany = prisma.componentSubtypes.findMany as jest.Mock
  const count = prisma.componentSubtypes.count as jest.Mock

  beforeEach(() => {
    findMany.mockReset()
    count.mockReset()
    findMany.mockResolvedValue([])
    count.mockResolvedValue(0)
  })

  it('passes categoryType through', async () => {
    const res = await request(app.callback()).get(
      '/component-subtypes?categoryType=SURFACE'
    )

    expect(res.status).toBe(200)
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          componentType: { category: { type: 'SURFACE' } },
        }),
      })
    )
  })

  it('keeps the type and category in the response', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: subtypeId,
        subTypeName: 'Målning väggar',
        typeId: '00000000-0000-0000-0001-000000000001',
        xpandCode: null,
        depreciationPrice: 0,
        technicalLifespan: 0,
        economicLifespan: 0,
        replacementIntervalMonths: 0,
        quantityType: 'SQUARE_METER',
        ...timestamps,
        componentType: {
          id: '00000000-0000-0000-0001-000000000001',
          typeName: 'Vägg',
          categoryId: '00000000-0000-0000-0000-000000000001',
          description: null,
          code: 'WALL',
          ...timestamps,
          category: {
            id: '00000000-0000-0000-0000-000000000001',
            categoryName: 'Ytskikt',
            description: 'Golv, väggar och tak',
            type: 'SURFACE',
            ...timestamps,
          },
        },
      },
    ])
    count.mockResolvedValueOnce(1)

    const res = await request(app.callback()).get(
      '/component-subtypes?categoryType=SURFACE'
    )

    expect(res.status).toBe(200)
    expect(res.body.content[0].componentType.code).toBe('WALL')
    expect(res.body.content[0].componentType.category.type).toBe('SURFACE')
  })

  it('rejects an unknown categoryType', async () => {
    const res = await request(app.callback()).get(
      '/component-subtypes?categoryType=ROOF'
    )

    expect(res.status).toBe(400)
    expect(findMany).not.toHaveBeenCalled()
  })
})

describe('POST and PUT /component-models', () => {
  const app = new Koa()
  const router = new KoaRouter()
  modelRoutes(router)
  app.use(bodyParser())
  app.use(router.routes())

  const otherSubtypeId = '00000000-0000-0000-0002-000000000002'
  const modelRow = {
    id: modelId,
    modelName: 'Electrolux ESF5555',
    componentSubtypeId: subtypeId,
    currentPrice: 0,
    currentInstallPrice: 0,
    warrantyMonths: 0,
    manufacturer: 'Electrolux',
    technicalSpecification: null,
    installationInstructions: null,
    dimensions: null,
    coclassCode: null,
    ...timestamps,
  }
  const subtypeOfCategory = (type: 'SURFACE' | 'APPLIANCE') => ({
    componentType: { category: { type } },
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects a model on a SURFACE subtype with 400', async () => {
    ;(prisma.componentSubtypes.findUnique as jest.Mock).mockResolvedValueOnce(
      subtypeOfCategory('SURFACE')
    )

    const res = await request(app.callback())
      .post('/component-models')
      .send({ modelName: 'Vit', componentSubtypeId: subtypeId })

    expect(res.status).toBe(400)
    expect(prisma.componentModels.create).not.toHaveBeenCalled()
  })

  it('rejects an unknown subtype with 400', async () => {
    ;(prisma.componentSubtypes.findUnique as jest.Mock).mockResolvedValueOnce(
      null
    )

    const res = await request(app.callback())
      .post('/component-models')
      .send({ modelName: 'Vit', componentSubtypeId: subtypeId })

    expect(res.status).toBe(400)
    expect(prisma.componentModels.create).not.toHaveBeenCalled()
  })

  it('creates a model on a non-surface subtype', async () => {
    ;(prisma.componentSubtypes.findUnique as jest.Mock).mockResolvedValueOnce(
      subtypeOfCategory('APPLIANCE')
    )
    ;(prisma.componentModels.create as jest.Mock).mockResolvedValueOnce(
      modelRow
    )

    const res = await request(app.callback())
      .post('/component-models')
      .send({ modelName: 'Electrolux ESF5555', componentSubtypeId: subtypeId })

    expect(res.status).toBe(201)
  })

  it('rejects moving a model onto a SURFACE subtype with 400', async () => {
    ;(prisma.componentModels.findUnique as jest.Mock).mockResolvedValueOnce(
      modelRow
    )
    ;(prisma.componentSubtypes.findUnique as jest.Mock).mockResolvedValueOnce(
      subtypeOfCategory('SURFACE')
    )

    const res = await request(app.callback())
      .put(`/component-models/${modelId}`)
      .send({ componentSubtypeId: otherSubtypeId })

    expect(res.status).toBe(400)
    expect(prisma.componentModels.update).not.toHaveBeenCalled()
    expect(prisma.components.updateMany).not.toHaveBeenCalled()
  })

  it('moves the components along with the model', async () => {
    ;(prisma.componentModels.findUnique as jest.Mock).mockResolvedValueOnce(
      modelRow
    )
    ;(prisma.componentSubtypes.findUnique as jest.Mock).mockResolvedValueOnce(
      subtypeOfCategory('APPLIANCE')
    )
    ;(prisma.componentModels.update as jest.Mock).mockResolvedValueOnce({
      ...modelRow,
      componentSubtypeId: otherSubtypeId,
    })

    const res = await request(app.callback())
      .put(`/component-models/${modelId}`)
      .send({ componentSubtypeId: otherSubtypeId })

    expect(res.status).toBe(200)
    expect(prisma.components.updateMany).toHaveBeenCalledWith({
      where: { modelId, subtypeId: { not: otherSubtypeId } },
      data: { subtypeId: otherSubtypeId },
    })
  })

  it('leaves components alone when the subtype does not change', async () => {
    ;(prisma.componentModels.findUnique as jest.Mock).mockResolvedValueOnce(
      modelRow
    )
    ;(prisma.componentModels.update as jest.Mock).mockResolvedValueOnce(
      modelRow
    )

    const res = await request(app.callback())
      .put(`/component-models/${modelId}`)
      .send({ modelName: 'Electrolux ESF5556' })

    expect(res.status).toBe(200)
    expect(prisma.componentSubtypes.findUnique).not.toHaveBeenCalled()
    expect(prisma.components.updateMany).not.toHaveBeenCalled()
  })
})

describe('component installations and the one-active-installation index', () => {
  const app = new Koa()
  const router = new KoaRouter()
  installationRoutes(router)
  app.use(bodyParser())
  app.use(router.routes())

  const installationId = '00000000-0000-0000-0005-000000000001'
  const componentId = '00000000-0000-0000-0004-000000000001'
  const uniqueViolation = Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 409 when the component already has an active installation', async () => {
    ;(prisma.componentInstallations.create as jest.Mock).mockRejectedValueOnce(
      uniqueViolation
    )

    const res = await request(app.callback())
      .post('/component-installations')
      .send({
        componentId,
        spaceId: 'R0001',
        spaceType: 'OBJECT',
        installationDate: '2026-10-07',
        cost: 0,
      })

    expect(res.status).toBe(409)
  })

  it('returns 409 when moving an active installation onto a component that already has one', async () => {
    ;(
      prisma.componentInstallations.findUnique as jest.Mock
    ).mockResolvedValueOnce({
      id: installationId,
      componentId,
      installationDate: new Date('2026-01-01'),
      deinstallationDate: null,
    })
    ;(prisma.componentInstallations.update as jest.Mock).mockRejectedValueOnce(
      uniqueViolation
    )

    const res = await request(app.callback())
      .put(`/component-installations/${installationId}`)
      .send({ componentId: '00000000-0000-0000-0004-000000000002' })

    expect(res.status).toBe(409)
  })
})
