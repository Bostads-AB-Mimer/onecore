jest.mock('../../adapters/db', () => ({
  prisma: {
    componentSubtypes: { findMany: jest.fn(), count: jest.fn() },
    componentModels: { findMany: jest.fn(), count: jest.fn() },
  },
}))

import { prisma } from '../../adapters/db'
import { getComponentSubtypes } from '../../adapters/component-subtype-adapter'
import { getComponentModels } from '../../adapters/component-model-adapter'
import { ComponentSubtypeSchema } from '../../types/component-subtype'
import { ComponentModelSchema } from '../../types/component-model'

type Delegate = { findMany: jest.Mock; count: jest.Mock }
const mockPrisma = prisma as unknown as {
  componentSubtypes: Delegate
  componentModels: Delegate
}

describe('component counts', () => {
  beforeEach(() => jest.resetAllMocks())

  it('gives each subtype the number of its components', async () => {
    mockPrisma.componentSubtypes.findMany.mockResolvedValue([
      { id: 'S1', subTypeName: 'Spis ', _count: { components: 639 } },
    ])
    mockPrisma.componentSubtypes.count.mockResolvedValue(1)

    const { subtypes } = await getComponentSubtypes({ typeId: 'T1' })

    expect(
      mockPrisma.componentSubtypes.findMany.mock.calls[0][0].include._count
    ).toEqual({ select: { components: true } })
    expect(subtypes).toEqual([
      { id: 'S1', subTypeName: 'Spis', componentCount: 639 },
    ])
  })

  it('gives each model the number of its components', async () => {
    mockPrisma.componentModels.findMany.mockResolvedValue([
      { id: 'M1', modelName: 'ESF5555', _count: { components: 0 } },
    ])
    mockPrisma.componentModels.count.mockResolvedValue(1)

    const { models } = await getComponentModels({ subtypeId: 'S1' })

    expect(
      mockPrisma.componentModels.findMany.mock.calls[0][0].include._count
    ).toEqual({ select: { components: true } })
    expect(models).toEqual([
      { id: 'M1', modelName: 'ESF5555', componentCount: 0 },
    ])
  })

  it('lets the response schemas carry the count', () => {
    expect(ComponentSubtypeSchema.shape.componentCount.parse(3)).toBe(3)
    expect(ComponentModelSchema.shape.componentCount.parse(undefined)).toBe(
      undefined
    )
  })
})
