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

const spaceQuery = () =>
  mockPrisma.$queryRaw.mock.calls
    .map(([query]) => query)
    .filter((query) => query.sql.includes('dbo.cmobj'))
    .at(-1)

const queriedIds = () =>
  JSON.parse(
    spaceQuery().values.find(
      (value: unknown) => typeof value === 'string' && value.startsWith('[')
    )
  )

const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

describe('component-instance-adapter.getComponents', () => {
  const spaceLookup = jest.fn()
  const countLookup = jest.fn()
  let pageIds: string[] = []

  const givenComponents = (components: ReturnType<typeof component>[]) => {
    pageIds = components.map(({ id }) => id)
    mockPrisma.components.findMany.mockResolvedValue(components)
  }

  beforeEach(() => {
    jest.resetAllMocks()
    pageIds = []
    countLookup.mockResolvedValue([{ total: 1 }])
    mockPrisma.$queryRaw.mockImplementation((query: { sql: string }) => {
      if (query.sql.includes('COUNT(*)')) return countLookup(query)
      if (query.sql.includes('SELECT c.id')) {
        return Promise.resolve(pageIds.map((id) => ({ id })))
      }
      return spaceLookup(query)
    })
  })

  it('looks up the space structure in one raw query instead of a nested include', async () => {
    givenComponents([
      component('C1', [installation('I1', 'OBJ1')]),
      component('C2', [installation('I2', 'OBJ2')]),
    ])
    spaceLookup.mockResolvedValue([structureRow('OBJ1'), structureRow('OBJ2')])

    await getComponents({ subtypeId: 'S1' }, 1, 25)

    const include =
      mockPrisma.components.findMany.mock.calls[0][0].include
        .componentInstallations
    expect(include.include?.propertyObject).toBeUndefined()
    expect(spaceLookup).toHaveBeenCalledTimes(1)
    expect(queriedIds()).toEqual(['OBJ1', 'OBJ2'])
  })

  it('joins the structure on the space and the residence on the structure, skipping deleted structures', async () => {
    givenComponents([component('C1', [installation('I1', 'OBJ1')])])
    spaceLookup.mockResolvedValue([structureRow('OBJ1')])

    await getComponents({ subtypeId: 'S1' }, 1, 25)

    const sql = spaceQuery().sql.replace(/\s+/g, ' ')
    expect(sql).toContain('FROM dbo.cmobj o')
    expect(sql).toContain(
      'LEFT JOIN dbo.babuf b ON b.keycmobj = o.keycmobj AND b.deletemark = 0'
    )
    expect(sql).toContain('LEFT JOIN dbo.balgh l ON l.keycmobj = b.keyobjlgh')
  })

  it('builds propertyObject from the structure row', async () => {
    givenComponents([component('C1', [installation('I1', 'OBJ1')])])
    spaceLookup.mockResolvedValue([structureRow('OBJ1')])

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
    givenComponents([
      component('C1', [installation('I1', null)]),
      component('C2', [installation('I2', 'GONE')]),
    ])
    spaceLookup.mockResolvedValue([])

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
    givenComponents([
      component('C1', [installation('I1', 'BARE')]),
      component('C2', [installation('I2', 'NOLGH')]),
    ])
    spaceLookup.mockResolvedValue([
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
    givenComponents([
      component('C1', [installation('I1', 'OBJ1           ')]),
      component('C2', [installation('I2', 'OBJ1           ')]),
    ])
    spaceLookup.mockResolvedValue([structureRow('OBJ1           ')])

    const result = await getComponents({ subtypeId: 'S1' }, 1, 25)

    expect(queriedIds()).toEqual(['OBJ1'])
    expect(
      result.components[1].componentInstallations[0].propertyObject?.id
    ).toBe('OBJ1')
  })

  it('matches keys that differ only in case, as SQL Server does', async () => {
    givenComponents([component('C1', [installation('I1', 'abc123')])])
    spaceLookup.mockResolvedValue([structureRow('ABC123')])

    const result = await getComponents({ subtypeId: 'S1' }, 1, 25)

    expect(
      result.components[0].componentInstallations[0].propertyObject?.id
    ).toBe('ABC123')
  })

  it('skips the raw query when no installation has a space', async () => {
    givenComponents([
      component('C1', []),
      component('C2', [installation('I2', null)]),
    ])

    await getComponents({ subtypeId: 'S1' }, 1, 25)

    expect(spaceLookup).not.toHaveBeenCalled()
  })

  it('looks up spaces without waiting for the count', async () => {
    let resolveCount: (total: number) => void = () => undefined
    countLookup.mockReturnValue(
      new Promise((resolve) => (resolveCount = (total) => resolve([{ total }])))
    )
    givenComponents([component('C1', [installation('I1', 'OBJ1')])])
    spaceLookup.mockResolvedValue([structureRow('OBJ1')])

    const pending = getComponents({ subtypeId: 'S1' }, 1, 25)
    await flushPromises()

    expect(spaceLookup).toHaveBeenCalledTimes(1)
    resolveCount(1)
    await expect(pending).resolves.toMatchObject({
      pagination: { total: 1 },
    })
  })

  it('logs and rethrows when the space lookup fails', async () => {
    const error = jest.spyOn(logger, 'error')
    const failure = new Error('Invalid object name')
    givenComponents([component('C1', [installation('I1', 'OBJ1')])])
    spaceLookup.mockRejectedValue(failure)

    await expect(getComponents({ subtypeId: 'S1' }, 1, 25)).rejects.toBe(
      failure
    )
    expect(error).toHaveBeenCalledWith(
      { err: failure },
      'component-instance-adapter.getSpacesWithStructures'
    )
  })

  it('returns the page in the order the sorted query gave, whatever order Prisma loads it in', async () => {
    givenComponents([
      component('C1', []),
      component('C2', []),
      component('C3', []),
    ])
    pageIds = ['c3', 'C1', 'C2']

    const result = await getComponents({ subtypeId: 'S1' }, 1, 25)

    expect(mockPrisma.components.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ['c3', 'C1', 'C2'] },
    })
    expect(result.components.map(({ id }) => id)).toEqual(['C3', 'C1', 'C2'])
  })

  it('loads nothing more when the page is empty', async () => {
    countLookup.mockResolvedValue([{ total: 0 }])

    const result = await getComponents({ subtypeId: 'S1' }, 3, 25)

    expect(mockPrisma.components.findMany).not.toHaveBeenCalled()
    expect(result).toEqual({
      components: [],
      pagination: { page: 3, limit: 25, total: 0, totalPages: 0 },
    })
  })

  it('pages and sorts in the query and counts with the same filters', async () => {
    countLookup.mockResolvedValue([{ total: 51 }])

    const result = await getComponents(
      { subtypeId: 'S1', installation: 'installed' },
      3,
      25,
      { sortBy: 'model', sortOrder: 'desc' }
    )

    const [[page], [count]] = mockPrisma.$queryRaw.mock.calls
    expect(page.sql).toContain(
      "m.modelName)), '') COLLATE Finnish_Swedish_CI_AS DESC"
    )
    expect(page.values).toEqual(['S1', 50, 25])
    expect(count.sql).toContain('i.id IS NOT NULL')
    expect(count.values).toEqual(['S1'])
    expect(result.pagination).toEqual({
      page: 3,
      limit: 25,
      total: 51,
      totalPages: 3,
    })
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
