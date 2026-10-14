jest.mock('../../adapters/db', () => ({
  prisma: {
    components: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}))

import { logger } from '@onecore/utilities'
import { prisma } from '../../adapters/db'
import {
  getComponentById,
  getComponents,
  getComponentsByRoomId,
} from '../../adapters/component-instance-adapter'

type MockedPrisma = {
  components: { findMany: jest.Mock; findUnique: jest.Mock; count: jest.Mock }
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

const spaceQuery = () => mockPrisma.$queryRaw.mock.calls.at(-1)[0]

const queriedIds = () =>
  JSON.parse(
    spaceQuery().values.find(
      (value: unknown) => typeof value === 'string' && value.startsWith('[')
    )
  )

const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

describe('component-instance-adapter.getComponents', () => {
  beforeEach(() => {
    jest.resetAllMocks()
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

  it('joins the structure on the space and the residence on the structure, skipping deleted structures', async () => {
    mockPrisma.components.findMany.mockResolvedValue([
      component('C1', [installation('I1', 'OBJ1')]),
    ])
    mockPrisma.$queryRaw.mockResolvedValue([structureRow('OBJ1')])

    await getComponents({ subtypeId: 'S1' }, 1, 25)

    const sql = spaceQuery().sql.replace(/\s+/g, ' ')
    expect(sql).toContain('FROM dbo.cmobj o')
    expect(sql).toContain(
      'LEFT JOIN dbo.babuf b ON b.keycmobj = o.keycmobj AND b.deletemark = 0'
    )
    expect(sql).toContain('LEFT JOIN dbo.balgh l ON l.keycmobj = b.keyobjlgh')
  })

  it('builds propertyObject from the structure row', async () => {
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

  it('asks for each space once, trimmed, and matches padded keys', async () => {
    mockPrisma.components.findMany.mockResolvedValue([
      component('C1', [installation('I1', 'OBJ1           ')]),
      component('C2', [installation('I2', 'OBJ1           ')]),
    ])
    mockPrisma.$queryRaw.mockResolvedValue([structureRow('OBJ1           ')])

    const result = await getComponents({ subtypeId: 'S1' }, 1, 25)

    expect(queriedIds()).toEqual(['OBJ1'])
    expect(
      result.components[1].componentInstallations[0].propertyObject?.id
    ).toBe('OBJ1')
  })

  it('matches keys that differ only in case, as SQL Server does', async () => {
    mockPrisma.components.findMany.mockResolvedValue([
      component('C1', [installation('I1', 'abc123')]),
    ])
    mockPrisma.$queryRaw.mockResolvedValue([structureRow('ABC123')])

    const result = await getComponents({ subtypeId: 'S1' }, 1, 25)

    expect(
      result.components[0].componentInstallations[0].propertyObject?.id
    ).toBe('ABC123')
  })

  it('skips the raw query when no installation has a space', async () => {
    mockPrisma.components.findMany.mockResolvedValue([
      component('C1', []),
      component('C2', [installation('I2', null)]),
    ])

    await getComponents({ subtypeId: 'S1' }, 1, 25)

    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled()
  })

  it('looks up spaces without waiting for the count', async () => {
    let resolveCount: (total: number) => void = () => undefined
    mockPrisma.components.count.mockReturnValue(
      new Promise((resolve) => (resolveCount = resolve))
    )
    mockPrisma.components.findMany.mockResolvedValue([
      component('C1', [installation('I1', 'OBJ1')]),
    ])
    mockPrisma.$queryRaw.mockResolvedValue([structureRow('OBJ1')])

    const pending = getComponents({ subtypeId: 'S1' }, 1, 25)
    await flushPromises()

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
    resolveCount(1)
    await expect(pending).resolves.toMatchObject({
      pagination: { total: 1 },
    })
  })

  it('logs and rethrows when the space lookup fails', async () => {
    const error = jest.spyOn(logger, 'error')
    const failure = new Error('Invalid object name')
    mockPrisma.components.findMany.mockResolvedValue([
      component('C1', [installation('I1', 'OBJ1')]),
    ])
    mockPrisma.$queryRaw.mockRejectedValue(failure)

    await expect(getComponents({ subtypeId: 'S1' }, 1, 25)).rejects.toBe(
      failure
    )
    expect(error).toHaveBeenCalledWith(
      { err: failure },
      'component-instance-adapter.getSpacesWithStructures'
    )
  })
})

describe('component-instance-adapter.getComponentById', () => {
  beforeEach(() => jest.resetAllMocks())

  it('attaches spaces to every installation through the raw lookup', async () => {
    mockPrisma.components.findUnique.mockResolvedValue(
      component('C1', [installation('I1', 'OBJ1'), installation('I2', null)])
    )
    mockPrisma.$queryRaw.mockResolvedValue([structureRow('OBJ1')])

    const result = await getComponentById('C1')

    expect(
      mockPrisma.components.findUnique.mock.calls[0][0].include
        .componentInstallations
    ).toBe(true)
    expect(result?.componentInstallations[0].propertyObject?.id).toBe('OBJ1')
    expect(result?.componentInstallations[1].propertyObject).toBeNull()
  })

  it('gives null without a space lookup when the component is missing', async () => {
    mockPrisma.components.findUnique.mockResolvedValue(null)

    expect(await getComponentById('C1')).toBeNull()
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled()
  })
})

describe('component-instance-adapter.getComponentsByRoomId', () => {
  beforeEach(() => jest.resetAllMocks())

  it('finds the room’s components by a char(15) comparison, then attaches spaces', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ componentId: 'C1' }])
      .mockResolvedValueOnce([structureRow('ROOM1')])
    mockPrisma.components.findMany.mockResolvedValue([
      component('C1', [installation('I1', 'ROOM1')]),
    ])

    const result = await getComponentsByRoomId('ROOM1')

    const [roomQuery] = mockPrisma.$queryRaw.mock.calls[0]
    expect(roomQuery.sql.replace(/\s+/g, ' ')).toMatch(
      /WHERE spaceId = CAST\(\S+ AS CHAR\(15\)\)/
    )
    expect(roomQuery.values).toEqual(['ROOM1'])
    expect(mockPrisma.components.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ['C1'] },
    })
    expect(result[0].componentInstallations[0].propertyObject?.id).toBe('ROOM1')
  })

  it('returns nothing without further queries when the room is empty', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])

    expect(await getComponentsByRoomId('ROOM1')).toEqual([])
    expect(mockPrisma.components.findMany).not.toHaveBeenCalled()
  })
})
