jest.mock('../../adapters/db', () => ({
  prisma: {
    components: { findMany: jest.fn(), count: jest.fn() },
    $queryRaw: jest.fn(),
  },
}))

import { prisma } from '../../adapters/db'
import { getComponents } from '../../adapters/component-instance-adapter'

type MockedPrisma = {
  components: { findMany: jest.Mock; count: jest.Mock }
  $queryRaw: jest.Mock
}
const mockPrisma = prisma as unknown as MockedPrisma

const installation = (id: string, spaceId: string | null) => ({
  id,
  componentId: `component-${id}`,
  spaceId,
  deinstallationDate: null,
})

const component = (
  id: string,
  installations: ReturnType<typeof installation>[]
) => ({ id, componentInstallations: installations })

const structureRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  structureId: `BABUF-${id}`,
  roomId: `RUM-${id}`,
  roomCode: 'KÖK',
  roomName: 'Kök',
  residenceId: `LGH-${id}`,
  residenceCode: '0101',
  residenceName: 'Lägenhet 0101',
  rentalId: '123-456-01-0101',
  buildingCode: '123-456',
  buildingName: 'Huset',
  residenceRowId: `BALGH-${id}`,
  ...overrides,
})

const queriedIds = () => {
  const [query] = mockPrisma.$queryRaw.mock.calls[0]
  const json = query.values.find(
    (value: unknown) => typeof value === 'string' && value.startsWith('[')
  )
  return JSON.parse(json)
}

describe('component-instance-adapter.getComponents', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.components.count.mockResolvedValue(1)
  })

  it('looks up the space structure in one raw query instead of a nested include', async () => {
    mockPrisma.components.findMany.mockResolvedValue([
      component('C1', [installation('I1', 'OBJ1')]),
      component('C2', [installation('I2', 'OBJ2')]),
    ])
    mockPrisma.$queryRaw.mockResolvedValue([
      structureRow('OBJ1'),
      structureRow('OBJ2'),
    ])

    await getComponents({ subtypeId: 'S1' }, 1, 25)

    const include =
      mockPrisma.components.findMany.mock.calls[0][0].include
        .componentInstallations
    expect(include.include?.propertyObject).toBeUndefined()
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(queriedIds()).toEqual(['OBJ1', 'OBJ2'])
  })

  it('returns the same propertyObject shape the include did', async () => {
    mockPrisma.components.findMany.mockResolvedValue([
      component('C1', [installation('I1', 'OBJ1')]),
    ])
    mockPrisma.$queryRaw.mockResolvedValue([structureRow('OBJ1')])

    const result = await getComponents({ subtypeId: 'S1' }, 1, 25)

    expect(
      result.components[0].componentInstallations[0].propertyObject
    ).toEqual({
      id: 'OBJ1',
      propertyStructures: [
        {
          roomId: 'RUM-OBJ1',
          roomCode: 'KÖK',
          roomName: 'Kök',
          residenceId: 'LGH-OBJ1',
          residenceCode: '0101',
          residenceName: 'Lägenhet 0101',
          rentalId: '123-456-01-0101',
          buildingCode: '123-456',
          buildingName: 'Huset',
          residence: { id: 'BALGH-OBJ1' },
        },
      ],
    })
  })

  it('gives null when the installation has no space or the space is missing', async () => {
    mockPrisma.components.findMany.mockResolvedValue([
      component('C1', [installation('I1', null)]),
      component('C2', [installation('I2', 'GONE')]),
    ])
    mockPrisma.$queryRaw.mockResolvedValue([])

    const result = await getComponents({ subtypeId: 'S1' }, 1, 25)

    expect(
      result.components[0].componentInstallations[0].propertyObject
    ).toBeNull()
    expect(
      result.components[1].componentInstallations[0].propertyObject
    ).toBeNull()
    expect(queriedIds()).toEqual(['GONE'])
  })

  it('gives no structures for a space without one, and no residence for a structure without one', async () => {
    mockPrisma.components.findMany.mockResolvedValue([
      component('C1', [installation('I1', 'BARE')]),
      component('C2', [installation('I2', 'NOLGH')]),
    ])
    mockPrisma.$queryRaw.mockResolvedValue([
      structureRow('BARE', {
        structureId: null,
        roomId: null,
        roomCode: null,
        roomName: null,
        residenceId: null,
        residenceCode: null,
        residenceName: null,
        rentalId: null,
        buildingCode: null,
        buildingName: null,
        residenceRowId: null,
      }),
      structureRow('NOLGH', { residenceRowId: null }),
    ])

    const result = await getComponents({ subtypeId: 'S1' }, 1, 25)

    expect(
      result.components[0].componentInstallations[0].propertyObject
    ).toEqual({ id: 'BARE', propertyStructures: [] })
    expect(
      result.components[1].componentInstallations[0].propertyObject
        ?.propertyStructures[0].residence
    ).toBeNull()
  })

  it('matches space-padded keys and asks for each space once', async () => {
    mockPrisma.components.findMany.mockResolvedValue([
      component('C1', [installation('I1', 'OBJ1           ')]),
      component('C2', [installation('I2', 'OBJ1           ')]),
    ])
    mockPrisma.$queryRaw.mockResolvedValue([structureRow('OBJ1           ')])

    const result = await getComponents({ subtypeId: 'S1' }, 1, 25)

    expect(queriedIds()).toEqual(['OBJ1           '])
    expect(
      result.components[1].componentInstallations[0].propertyObject?.id
    ).toBe('OBJ1')
  })

  it('skips the raw query when no installation has a space', async () => {
    mockPrisma.components.findMany.mockResolvedValue([
      component('C1', []),
      component('C2', [installation('I2', null)]),
    ])

    await getComponents({ subtypeId: 'S1' }, 1, 25)

    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled()
  })
})
