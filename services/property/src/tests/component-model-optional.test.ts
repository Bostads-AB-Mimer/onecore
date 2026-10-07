jest.mock('../adapters/db', () => ({
  prisma: {
    components: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    componentSubtypes: { findUnique: jest.fn() },
    componentModels: { findUnique: jest.fn() },
  },
}))

import {
  ComponentSchema,
  CreateComponentSchema,
  UpdateComponentSchema,
  componentsQueryParamsSchema,
} from '../types/component'
import { prisma } from '../adapters/db'
import { findComponentModelProblem } from '../adapters/component-instance-adapter'

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
  })
})
