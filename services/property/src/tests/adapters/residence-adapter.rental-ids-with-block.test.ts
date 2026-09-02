jest.mock('../../adapters/db', () => ({
  prisma: {
    rentalBlock: { findMany: jest.fn() },
  },
}))

import { prisma } from '../../adapters/db'
import { getRentalIdsWithBlock } from '../../adapters/residence-adapter'

type MockedPrisma = {
  rentalBlock: { findMany: jest.Mock }
}
const mockPrisma = prisma as unknown as MockedPrisma

const row = (rentalId: string | null) => ({
  propertyStructure: { rentalId },
})

// The where clause comes from buildRentalBlockWhereClause, which returns a bare
// condition when there is only one and an AND list otherwise. Normalise to a
// list so assertions don't depend on how many filters were passed.
const whereArg = () => mockPrisma.rentalBlock.findMany.mock.calls[0][0].where
const andConditions = (): Record<string, any>[] => {
  const where = whereArg()
  return where.AND ?? [where]
}

describe('residence-adapter.getRentalIdsWithBlock', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns distinct, trimmed rental ids', async () => {
    mockPrisma.rentalBlock.findMany.mockResolvedValue([
      row('705-022-04-0201'),
      // Xpand pads rentalId, so the same object can arrive twice looking different
      row('705-022-04-0201  '),
      row('705-022-04-0202'),
    ])

    const result = await getRentalIdsWithBlock({})

    expect(result).toEqual(['705-022-04-0201', '705-022-04-0202'])
  })

  it('drops rows with a missing, null or empty rental id', async () => {
    mockPrisma.rentalBlock.findMany.mockResolvedValue([
      row('705-022-04-0201'),
      row(null),
      row('   '),
      { propertyStructure: null },
    ])

    const result = await getRentalIdsWithBlock({})

    expect(result).toEqual(['705-022-04-0201'])
  })

  it('returns an empty list when nothing matches', async () => {
    mockPrisma.rentalBlock.findMany.mockResolvedValue([])

    await expect(getRentalIdsWithBlock({})).resolves.toEqual([])
  })

  it('always applies the shared base filter requiring a rental id', async () => {
    mockPrisma.rentalBlock.findMany.mockResolvedValue([])

    await getRentalIdsWithBlock({})

    expect(andConditions()).toEqual(
      expect.arrayContaining([{ propertyStructure: { rentalId: { not: '' } } }])
    )
  })

  it('filters on block reason captions', async () => {
    mockPrisma.rentalBlock.findMany.mockResolvedValue([])

    await getRentalIdsWithBlock({ blockReason: ['SKADEDJUR', 'OMBYGGNAD'] })

    expect(JSON.stringify(andConditions())).toContain('SKADEDJUR')
    expect(JSON.stringify(andConditions())).toContain('OMBYGGNAD')
  })

  it('translates active=true into "not yet ended"', async () => {
    mockPrisma.rentalBlock.findMany.mockResolvedValue([])

    await getRentalIdsWithBlock({ active: true })

    const activeCondition = andConditions().find((condition) => condition.OR)
    expect(activeCondition?.OR).toEqual([
      { toDate: { gte: expect.any(Date) } },
      { toDate: null },
    ])
  })

  it('translates active=false into "already ended"', async () => {
    mockPrisma.rentalBlock.findMany.mockResolvedValue([])

    await getRentalIdsWithBlock({ active: false })

    expect(andConditions()).toEqual(
      expect.arrayContaining([{ toDate: { lt: expect.any(Date) } }])
    )
  })

  it('selects only the rental id - no rent or district enrichment', async () => {
    mockPrisma.rentalBlock.findMany.mockResolvedValue([])

    await getRentalIdsWithBlock({})

    const args = mockPrisma.rentalBlock.findMany.mock.calls[0][0]
    expect(args.select).toEqual({
      propertyStructure: { select: { rentalId: true } },
    })
    expect(args.include).toBeUndefined()
  })

  it('propagates database errors', async () => {
    mockPrisma.rentalBlock.findMany.mockRejectedValue(new Error('boom'))

    await expect(getRentalIdsWithBlock({})).rejects.toThrow('boom')
  })
})
