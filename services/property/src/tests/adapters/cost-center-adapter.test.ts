jest.mock('../../adapters/db', () => ({
  prisma: {
    onecoreCostCenter: { findUnique: jest.fn() },
    onecoreKvvAreaException: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}))
jest.mock('../../adapters/property-subtree-adapter', () => ({
  buildPropertySubtrees: jest.fn(),
}))

import { prisma } from '../../adapters/db'
import { getCostCenterTreeById } from '../../adapters/cost-center-adapter'
import { buildPropertySubtrees } from '../../adapters/property-subtree-adapter'
import type { CostCenterTreeProperty } from '../../types/cost-center'

type MockedPrisma = {
  onecoreCostCenter: { findUnique: jest.Mock }
  onecoreKvvAreaException: { findMany: jest.Mock }
  $queryRaw: jest.Mock
}
const mockPrisma = prisma as unknown as MockedPrisma
const mockSubtrees = buildPropertySubtrees as jest.Mock

const CC_NORR = '11111111-1111-1111-1111-111111111111'
const AREA_VALLBY = '22222222-2222-2222-2222-222222222222'
const CC_STUDENT = '33333333-3333-3333-3333-333333333333'
const AREA_STUDENT = '44444444-4444-4444-4444-444444444444'

const norrCostCenter = () => ({
  id: CC_NORR,
  code: '61120',
  name: 'Distrikt Norr',
  leadKeycloakUserId: null,
  deputyKeycloakUserId: null,
  kvvAreas: [
    {
      id: AREA_VALLBY,
      code: '61121',
      name: 'Distrikt Norr: VALLBY 1',
      responsibleKeycloakUserId: null,
      propertyLinks: [{ propertyCode: '06601', kvvAreaId: AREA_VALLBY }],
    },
  ],
})

const studentCostCenter = () => ({
  id: CC_STUDENT,
  code: '61151',
  name: 'Mimer Student',
  leadKeycloakUserId: null,
  deputyKeycloakUserId: null,
  kvvAreas: [
    {
      id: AREA_STUDENT,
      code: '61150',
      name: 'Mimer Student: STUDENT TEAM',
      responsibleKeycloakUserId: null,
      propertyLinks: [],
    },
  ],
})

const studentException = () => ({
  code: '307-048',
  kvvAreaId: AREA_STUDENT,
  propertyCode: '06601',
})

const staircase = (code: string, residenceCount: number) => ({
  code,
  name: null,
  residenceCount,
  parkingCount: 0,
  facilityCount: 0,
  otherCount: 0,
})

const subtree = (): CostCenterTreeProperty => ({
  code: '06601',
  designation: 'ALLMOGEKULTUREN 7',
  tract: null,
  buildings: [
    {
      buildingCode: '307-046',
      buildingName: 'Hus 46',
      buildingType: null,
      staircases: [staircase('01', 10), staircase('02', 10)],
      residenceCount: 20,
      parkingCount: 0,
      facilityCount: 1,
      otherCount: 0,
    },
    {
      buildingCode: '307-048',
      buildingName: 'Studenthuset',
      buildingType: null,
      staircases: [
        staircase('01', 30),
        staircase('02', 30),
        staircase('03', 16),
      ],
      residenceCount: 76,
      parkingCount: 0,
      facilityCount: 0,
      otherCount: 2,
    },
  ],
  parkingAreas: [{ code: '307-700-00', name: 'P-plats', parkingCount: 5 }],
  aggregates: {
    residenceCount: 96,
    parkingCount: 5,
    entranceCount: 5,
    facilityCount: 1,
    otherCount: 2,
  },
})

beforeEach(() => {
  jest.clearAllMocks()
  // filterToOperatingCompanies
  mockPrisma.$queryRaw.mockResolvedValue([{ propertyCode: '06601' }])
  mockSubtrees.mockResolvedValue(new Map([['06601', subtree()]]))
})

describe('cost-center-adapter.getCostCenterTreeById with exceptions', () => {
  it('prunes an excepted building from the default area and marks the property partial', async () => {
    mockPrisma.onecoreCostCenter.findUnique.mockResolvedValue(norrCostCenter())
    mockPrisma.onecoreKvvAreaException.findMany.mockResolvedValue([
      studentException(),
    ])

    const tree = await getCostCenterTreeById(CC_NORR)

    const property = tree?.kvvAreas[0].properties[0]
    expect(property?.code).toBe('06601')
    expect(property?.partial).toBe(true)
    expect(property?.buildings.map((b) => b.buildingCode)).toEqual(['307-046'])
    expect(property?.parkingAreas).toHaveLength(1)
    expect(property?.aggregates).toEqual({
      residenceCount: 20,
      parkingCount: 5,
      entranceCount: 2,
      facilityCount: 1,
      otherCount: 0,
    })
    expect(mockSubtrees).toHaveBeenCalledWith(['06601'])
  })

  it('adds the excepted part of the property under the exception area', async () => {
    mockPrisma.onecoreCostCenter.findUnique.mockResolvedValue(
      studentCostCenter()
    )
    mockPrisma.onecoreKvvAreaException.findMany.mockResolvedValue([
      studentException(),
    ])

    const tree = await getCostCenterTreeById(CC_STUDENT)

    const property = tree?.kvvAreas[0].properties[0]
    expect(tree?.kvvAreas[0].properties).toHaveLength(1)
    expect(property?.partial).toBe(true)
    expect(property?.designation).toBe('ALLMOGEKULTUREN 7')
    expect(property?.buildings.map((b) => b.buildingCode)).toEqual(['307-048'])
    expect(property?.parkingAreas).toEqual([])
    expect(property?.aggregates).toEqual({
      residenceCount: 76,
      parkingCount: 0,
      entranceCount: 3,
      facilityCount: 0,
      otherCount: 2,
    })
  })

  it('leaves properties whole when no exceptions exist', async () => {
    mockPrisma.onecoreCostCenter.findUnique.mockResolvedValue(norrCostCenter())
    mockPrisma.onecoreKvvAreaException.findMany.mockResolvedValue([])

    const tree = await getCostCenterTreeById(CC_NORR)

    const property = tree?.kvvAreas[0].properties[0]
    expect(property?.partial).toBeUndefined()
    expect(property?.buildings).toHaveLength(2)
    expect(property?.aggregates.residenceCount).toBe(96)
  })

  it('ignores an exception pointing at the property default area', async () => {
    mockPrisma.onecoreCostCenter.findUnique.mockResolvedValue(norrCostCenter())
    mockPrisma.onecoreKvvAreaException.findMany.mockResolvedValue([
      { ...studentException(), kvvAreaId: AREA_VALLBY },
    ])

    const tree = await getCostCenterTreeById(CC_NORR)

    const properties = tree?.kvvAreas[0].properties
    expect(properties).toHaveLength(1)
    expect(properties?.[0].partial).toBeUndefined()
    expect(properties?.[0].buildings).toHaveLength(2)
  })

  it('drops an inbound share whose property is not operating stock', async () => {
    mockPrisma.onecoreCostCenter.findUnique.mockResolvedValue(
      studentCostCenter()
    )
    mockPrisma.onecoreKvvAreaException.findMany.mockResolvedValue([
      studentException(),
    ])
    mockPrisma.$queryRaw.mockResolvedValue([])

    const tree = await getCostCenterTreeById(CC_STUDENT)

    expect(tree?.kvvAreas[0].properties).toEqual([])
    expect(mockSubtrees).toHaveBeenCalledWith([])
  })
})
