jest.mock('../../adapters/db', () => ({
  prisma: {
    onecorePropertyKvvArea: { findUnique: jest.fn() },
    onecoreKvvArea: { findMany: jest.fn() },
  },
}))

import { prisma } from '../../adapters/db'
import {
  getKvvAreaByPropertyCode,
  listKvvAreas,
} from '../../adapters/kvv-area-adapter'

type MockedPrisma = {
  onecorePropertyKvvArea: { findUnique: jest.Mock }
  onecoreKvvArea: { findMany: jest.Mock }
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
