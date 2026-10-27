jest.mock('../../adapters/db', () => ({
  prisma: {
    onecoreKvvArea: { findMany: jest.fn(), update: jest.fn() },
    administrativeUnit: { findMany: jest.fn() },
  },
}))

import { prisma } from '../../adapters/db'
import { backfillKvvAreaNames } from '../../scripts/backfill-kvv-area-names'

type MockedPrisma = {
  onecoreKvvArea: { findMany: jest.Mock; update: jest.Mock }
  administrativeUnit: { findMany: jest.Mock }
}
const mockPrisma = prisma as unknown as MockedPrisma

describe('backfillKvvAreaNames', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sets name from the Xpand bafen caption for areas that have no name', async () => {
    mockPrisma.onecoreKvvArea.findMany.mockResolvedValue([
      { id: 'A', code: '61141' },
      { id: 'B', code: '61142' },
    ])
    // AdministrativeUnit.name is the Prisma mapping of Xpand bafen.caption
    mockPrisma.administrativeUnit.findMany.mockResolvedValue([
      { code: '61141', name: 'Distrikt Väst: SKÄLBY  ' },
    ])
    mockPrisma.onecoreKvvArea.update.mockResolvedValue({})

    const result = await backfillKvvAreaNames()

    expect(result).toEqual({ updated: 1, skipped: 1 })
    expect(mockPrisma.onecoreKvvArea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: null } })
    )
    // bafen.code is not unique and holds soft-deleted rows — mirror the seed's
    // filters or a deleted duplicate can win and write the wrong caption.
    expect(mockPrisma.administrativeUnit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deleteMark: 0,
          district: { not: null },
        }),
      })
    )
    expect(mockPrisma.onecoreKvvArea.update).toHaveBeenCalledTimes(1)
    expect(mockPrisma.onecoreKvvArea.update).toHaveBeenCalledWith({
      where: { id: 'A' },
      data: { name: 'Distrikt Väst: SKÄLBY' },
    })
  })

  it('does nothing when every area already has a name', async () => {
    mockPrisma.onecoreKvvArea.findMany.mockResolvedValue([])

    const result = await backfillKvvAreaNames()

    expect(result).toEqual({ updated: 0, skipped: 0 })
    expect(mockPrisma.administrativeUnit.findMany).not.toHaveBeenCalled()
    expect(mockPrisma.onecoreKvvArea.update).not.toHaveBeenCalled()
  })
})
