jest.mock('../../adapters/db', () => ({
  prisma: {
    onecorePropertyKvvArea: { findUnique: jest.fn() },
    onecoreKvvArea: { findMany: jest.fn() },
    onecoreKvvAreaException: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
  },
}))

import { prisma } from '../../adapters/db'
import {
  getKvvAreaByPropertyCode,
  getKvvAreaByRentalId,
  listKvvAreas,
} from '../../adapters/kvv-area-adapter'

type MockedPrisma = {
  onecorePropertyKvvArea: { findUnique: jest.Mock }
  onecoreKvvArea: { findMany: jest.Mock }
  onecoreKvvAreaException: { findUnique: jest.Mock }
  $queryRaw: jest.Mock
}
const mockPrisma = prisma as unknown as MockedPrisma

const KVV_AREA_ID = '11111111-1111-1111-1111-111111111111'
const COST_CENTER_ID = '33333333-3333-3333-3333-333333333333'

describe('kvv-area-adapter.listKvvAreas', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const row = {
    id: KVV_AREA_ID,
    code: '61141',
    name: null,
    responsibleKeycloakUserId: 'kc-user-1',
    costCenter: { id: COST_CENTER_ID, code: '61140', name: 'Distrikt Väst ' },
  }

  it('returns every kvv-area with its cost center when no filter is given', async () => {
    mockPrisma.onecoreKvvArea.findMany.mockResolvedValue([row])

    const result = await listKvvAreas()

    expect(result).toEqual([
      {
        id: KVV_AREA_ID,
        code: '61141',
        name: null,
        costCenter: {
          id: COST_CENTER_ID,
          code: '61140',
          name: 'Distrikt Väst',
        },
        responsibleKeycloakUserId: 'kc-user-1',
      },
    ])
    const args = mockPrisma.onecoreKvvArea.findMany.mock.calls[0][0]
    expect(args.where).toBeUndefined()
  })

  it('filters by responsible user ids when given', async () => {
    mockPrisma.onecoreKvvArea.findMany.mockResolvedValue([row])

    await listKvvAreas({ responsibleUserIds: ['kc-user-1', 'kc-user-2'] })

    expect(mockPrisma.onecoreKvvArea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          responsibleKeycloakUserId: { in: ['kc-user-1', 'kc-user-2'] },
        },
      })
    )
  })
})

describe('kvv-area-adapter.getKvvAreaByPropertyCode', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the kvv-area, its cost center and responsible for a linked property', async () => {
    mockPrisma.onecorePropertyKvvArea.findUnique.mockResolvedValue({
      propertyCode: '01801',
      kvvAreaId: KVV_AREA_ID,
      kvvArea: {
        id: KVV_AREA_ID,
        code: '61141',
        name: 'Distrikt Väst: SKÄLBY ',
        responsibleKeycloakUserId: 'kc-user-1',
        costCenter: {
          id: COST_CENTER_ID,
          code: '61140',
          name: 'Distrikt Väst',
        },
      },
    })

    const result = await getKvvAreaByPropertyCode('01801')

    expect(result).toEqual({
      kvvArea: {
        id: KVV_AREA_ID,
        code: '61141',
        name: 'Distrikt Väst: SKÄLBY',
      },
      costCenter: { id: COST_CENTER_ID, code: '61140', name: 'Distrikt Väst' },
      responsibleKeycloakUserId: 'kc-user-1',
    })
    expect(mockPrisma.onecorePropertyKvvArea.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { propertyCode: '01801' } })
    )
  })

  it('returns null when the property has no kvv-area link', async () => {
    mockPrisma.onecorePropertyKvvArea.findUnique.mockResolvedValue(null)

    await expect(getKvvAreaByPropertyCode('unlinked')).resolves.toBeNull()
  })

  it('trims a padded property code before looking it up', async () => {
    mockPrisma.onecorePropertyKvvArea.findUnique.mockResolvedValue(null)

    await getKvvAreaByPropertyCode('  01801  ')

    expect(mockPrisma.onecorePropertyKvvArea.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { propertyCode: '01801' } })
    )
  })

  it('maps a missing responsible to null', async () => {
    mockPrisma.onecorePropertyKvvArea.findUnique.mockResolvedValue({
      propertyCode: '01801',
      kvvAreaId: KVV_AREA_ID,
      kvvArea: {
        id: KVV_AREA_ID,
        code: '61141',
        name: null,
        responsibleKeycloakUserId: null,
        costCenter: {
          id: COST_CENTER_ID,
          code: '61140',
          name: 'Distrikt Väst',
        },
      },
    })

    const result = await getKvvAreaByPropertyCode('01801')

    expect(result?.kvvArea.name).toBeNull()
    expect(result?.responsibleKeycloakUserId).toBeNull()
  })
})

describe('kvv-area-adapter.getKvvAreaByRentalId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const STUDENT_AREA_ID = '22222222-2222-2222-2222-222222222222'
  const STUDENT_CC_ID = '44444444-4444-4444-4444-444444444444'

  const propertyLinkRow = () => ({
    propertyCode: '06601',
    kvvAreaId: KVV_AREA_ID,
    kvvArea: {
      id: KVV_AREA_ID,
      code: '61121',
      name: 'Distrikt Norr: VALLBY 1',
      responsibleKeycloakUserId: 'kc-norr',
      costCenter: { id: COST_CENTER_ID, code: '61120', name: 'Distrikt Norr' },
    },
  })

  const exceptionRow = () => ({
    objectType: 'building',
    code: '307-048',
    kvvAreaId: STUDENT_AREA_ID,
    propertyCode: '06601',
    kvvArea: {
      id: STUDENT_AREA_ID,
      code: '61150',
      name: 'Mimer Student: STUDENT TEAM',
      responsibleKeycloakUserId: 'kc-student',
      costCenter: {
        id: STUDENT_CC_ID,
        code: '61151',
        name: 'Mimer Student',
      },
    },
  })

  it('resolves via the building exception when the object sits in an excepted building', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { propertyCode: '06601', buildingCode: '307-048' },
    ])
    mockPrisma.onecoreKvvAreaException.findUnique.mockResolvedValue(
      exceptionRow()
    )

    const result = await getKvvAreaByRentalId('307-048-01-0201')

    expect(result).toEqual({
      kvvArea: {
        id: STUDENT_AREA_ID,
        code: '61150',
        name: 'Mimer Student: STUDENT TEAM',
      },
      costCenter: { id: STUDENT_CC_ID, code: '61151', name: 'Mimer Student' },
      responsibleKeycloakUserId: 'kc-student',
    })
    expect(mockPrisma.onecoreKvvAreaException.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          objectType_code: { objectType: 'building', code: '307-048' },
        },
      })
    )
    expect(mockPrisma.onecorePropertyKvvArea.findUnique).not.toHaveBeenCalled()
  })

  it('falls back to the property default when the building has no exception', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { propertyCode: '06601', buildingCode: '307-046' },
    ])
    mockPrisma.onecoreKvvAreaException.findUnique.mockResolvedValue(null)
    mockPrisma.onecorePropertyKvvArea.findUnique.mockResolvedValue(
      propertyLinkRow()
    )

    const result = await getKvvAreaByRentalId('307-046-01-0101')

    expect(result).toEqual({
      kvvArea: {
        id: KVV_AREA_ID,
        code: '61121',
        name: 'Distrikt Norr: VALLBY 1',
      },
      costCenter: { id: COST_CENTER_ID, code: '61120', name: 'Distrikt Norr' },
      responsibleKeycloakUserId: 'kc-norr',
    })
  })

  it('skips the exception lookup for objects without a building', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { propertyCode: '21401', buildingCode: null },
    ])
    mockPrisma.onecorePropertyKvvArea.findUnique.mockResolvedValue(
      propertyLinkRow()
    )

    const result = await getKvvAreaByRentalId('SÄLEN')

    expect(result).not.toBeNull()
    expect(mockPrisma.onecoreKvvAreaException.findUnique).not.toHaveBeenCalled()
  })

  it('returns null for an unknown rental id', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])

    await expect(getKvvAreaByRentalId('nope')).resolves.toBeNull()

    expect(mockPrisma.onecoreKvvAreaException.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.onecorePropertyKvvArea.findUnique).not.toHaveBeenCalled()
  })

  it('returns null when the object resolves but its property has no link', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { propertyCode: '06601', buildingCode: '307-046' },
    ])
    mockPrisma.onecoreKvvAreaException.findUnique.mockResolvedValue(null)
    mockPrisma.onecorePropertyKvvArea.findUnique.mockResolvedValue(null)

    await expect(getKvvAreaByRentalId('307-046-01-0101')).resolves.toBeNull()
  })

  it('trims the rental id before querying', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])

    await getKvvAreaByRentalId('  307-048-01-0201  ')

    expect(mockPrisma.$queryRaw.mock.calls[0]).toContain('307-048-01-0201')
  })
})

describe('kvv-area-adapter.getKvvAreaByPropertyCode (responsible mapping)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('maps a missing responsible to null', async () => {
    mockPrisma.onecorePropertyKvvArea.findUnique.mockResolvedValue({
      propertyCode: '01801',
      kvvAreaId: KVV_AREA_ID,
      kvvArea: {
        id: KVV_AREA_ID,
        code: '61141',
        name: null,
        responsibleKeycloakUserId: null,
        costCenter: {
          id: COST_CENTER_ID,
          code: '61140',
          name: 'Distrikt Väst',
        },
      },
    })

    const result = await getKvvAreaByPropertyCode('01801')

    expect(result?.kvvArea.name).toBeNull()
    expect(result?.responsibleKeycloakUserId).toBeNull()
  })
})
