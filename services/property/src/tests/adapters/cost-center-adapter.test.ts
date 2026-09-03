jest.mock('../../adapters/db', () => ({
  prisma: {
    onecoreCostCenter: { findUnique: jest.fn() },
    onecoreKvvAreaException: { findMany: jest.fn() },
    property: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}))

import { prisma } from '../../adapters/db'
import { getCostCenterTreeById } from '../../adapters/cost-center-adapter'

type MockedPrisma = {
  onecoreCostCenter: { findUnique: jest.Mock }
  onecoreKvvAreaException: { findMany: jest.Mock }
  property: { findMany: jest.Mock }
  $queryRaw: jest.Mock
}
const mockPrisma = prisma as unknown as MockedPrisma

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
  objectType: 'building',
  code: '307-048',
  kvvAreaId: AREA_STUDENT,
  propertyCode: '06601',
})

const addressRows = () => [
  {
    propertyCode: '06601',
    buildingCode: '307-046',
    buildingName: 'Hus 46',
    buildingTypeCode: null,
    buildingTypeName: null,
  },
  {
    propertyCode: '06601',
    buildingCode: '307-048',
    buildingName: 'Studenthuset',
    buildingTypeCode: null,
    buildingTypeName: null,
  },
]

// Per (property, building); the NULL-building row is markyta stock.
const countRows = () => [
  {
    propertyCode: '06601',
    buildingCode: '307-046',
    residenceCount: 20,
    parkingCount: 0,
    entranceCount: 2,
  },
  {
    propertyCode: '06601',
    buildingCode: '307-048',
    residenceCount: 76,
    parkingCount: 0,
    entranceCount: 3,
  },
  {
    propertyCode: '06601',
    buildingCode: null,
    residenceCount: 0,
    parkingCount: 5,
    entranceCount: 0,
  },
]

const propertyRows = () => [
  { code: '06601', designation: 'ALLMOGEKULTUREN 7', tract: null },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.property.findMany.mockResolvedValue(propertyRows())
  mockPrisma.$queryRaw
    .mockResolvedValueOnce(addressRows())
    .mockResolvedValueOnce(countRows())
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
    expect(property?.addresses.map((a) => a.buildingCode)).toEqual(['307-046'])
    expect(property?.aggregates).toEqual({
      residenceCount: 20,
      parkingCount: 5,
      entranceCount: 2,
    })
  })

  it('adds the excepted part of the property under the exception area', async () => {
    mockPrisma.onecoreCostCenter.findUnique.mockResolvedValue(
      studentCostCenter()
    )
    mockPrisma.onecoreKvvAreaException.findMany.mockResolvedValue([
      studentException(),
    ])

    const tree = await getCostCenterTreeById(CC_STUDENT)

    expect(tree?.kvvAreas[0].properties).toEqual([
      {
        code: '06601',
        designation: 'ALLMOGEKULTUREN 7',
        tract: null,
        partial: true,
        addresses: [
          {
            buildingCode: '307-048',
            buildingName: 'Studenthuset',
            buildingType: null,
          },
        ],
        aggregates: { residenceCount: 76, parkingCount: 0, entranceCount: 3 },
      },
    ])
  })

  it('leaves properties whole when no exceptions exist', async () => {
    mockPrisma.onecoreCostCenter.findUnique.mockResolvedValue(norrCostCenter())
    mockPrisma.onecoreKvvAreaException.findMany.mockResolvedValue([])

    const tree = await getCostCenterTreeById(CC_NORR)

    const property = tree?.kvvAreas[0].properties[0]
    expect(property?.partial).toBeUndefined()
    expect(property?.addresses).toHaveLength(2)
    expect(property?.aggregates).toEqual({
      residenceCount: 96,
      parkingCount: 5,
      entranceCount: 5,
    })
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
    expect(properties?.[0].addresses).toHaveLength(2)
    expect(properties?.[0].aggregates.residenceCount).toBe(96)
  })
})
