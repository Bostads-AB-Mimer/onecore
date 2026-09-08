jest.mock('../../adapters/db', () => ({
  prisma: {
    building: { findFirst: jest.fn() },
    propertyStructure: { findUnique: jest.fn() },
    property: { findFirst: jest.fn() },
  },
}))

import { prisma } from '../../adapters/db'
import {
  getBuildingByCode,
  getBuildingById,
} from '../../adapters/building-adapter'

type MockedPrisma = {
  building: { findFirst: jest.Mock }
  propertyStructure: { findUnique: jest.Mock }
  property: { findFirst: jest.Mock }
}
const mockPrisma = prisma as unknown as MockedPrisma

const buildingRow = {
  id: 'BYG-1',
  buildingCode: '202-002',
  name: 'Hus A',
  propertyObjectId: 'CMOBJ-BYG-1',
}

describe('building-adapter property resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getBuildingByCode reads the property off the babuf row in a single query', async () => {
    mockPrisma.building.findFirst.mockResolvedValue(buildingRow)
    mockPrisma.propertyStructure.findUnique.mockResolvedValue({
      propertyCode: '01801',
      propertyName: 'Kvarnen 1',
    })

    const result = await getBuildingByCode('202-002')

    expect(result?.property).toEqual({ code: '01801', name: 'Kvarnen 1' })
    expect(mockPrisma.propertyStructure.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { propertyObjectId: 'CMOBJ-BYG-1', deleteMark: 0 },
      })
    )
    // The bafst row is not needed: babuf carries fstcode/fstcaption inline.
    expect(mockPrisma.property.findFirst).not.toHaveBeenCalled()
  })

  it('getBuildingByCode returns property null when no structure row links it', async () => {
    mockPrisma.building.findFirst.mockResolvedValue(buildingRow)
    mockPrisma.propertyStructure.findUnique.mockResolvedValue(null)

    const result = await getBuildingByCode('202-002')

    expect(result?.property).toBeNull()
  })

  it('getBuildingByCode returns property null when the structure row has no property code', async () => {
    mockPrisma.building.findFirst.mockResolvedValue(buildingRow)
    mockPrisma.propertyStructure.findUnique.mockResolvedValue({
      propertyCode: null,
      propertyName: null,
    })

    const result = await getBuildingByCode('202-002')

    expect(result?.property).toBeNull()
  })

  it('getBuildingByCode returns null when the building is missing', async () => {
    mockPrisma.building.findFirst.mockResolvedValue(null)

    await expect(getBuildingByCode('missing')).resolves.toBeNull()
    expect(mockPrisma.propertyStructure.findUnique).not.toHaveBeenCalled()
  })

  it('getBuildingById attaches the resolved property too', async () => {
    mockPrisma.building.findFirst.mockResolvedValue(buildingRow)
    mockPrisma.propertyStructure.findUnique.mockResolvedValue({
      propertyCode: '01801',
      propertyName: 'Kvarnen 1',
    })

    const result = await getBuildingById('BYG-1')

    expect(result?.property).toEqual({ code: '01801', name: 'Kvarnen 1' })
  })
})
