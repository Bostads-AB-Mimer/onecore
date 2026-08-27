jest.mock('../../adapters/db', () => ({
  prisma: {
    marketArea: { findMany: jest.fn() },
  },
}))

import { prisma } from '../../adapters/db'
import { listMarketAreas } from '../../adapters/market-area-adapter'

type MockedPrisma = {
  marketArea: { findMany: jest.Mock }
}
const mockPrisma = prisma as unknown as MockedPrisma

describe('market-area-adapter.listMarketAreas', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('trims padded strings and maps a missing name to null', async () => {
    mockPrisma.marketArea.findMany.mockResolvedValue([
      { id: '61140          ', code: '61140     ', name: null },
      { id: '61150          ', code: '61150     ', name: 'Distrikt Väst ' },
    ])

    const result = await listMarketAreas()

    expect(result).toEqual([
      { id: '61140', code: '61140', name: null },
      { id: '61150', code: '61150', name: 'Distrikt Väst' },
    ])
  })

  it('orders by code ascending and selects only id, code, name', async () => {
    mockPrisma.marketArea.findMany.mockResolvedValue([])

    await listMarketAreas()

    expect(mockPrisma.marketArea.findMany).toHaveBeenCalledWith({
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    })
  })

  it('rethrows and logs when the adapter throws', async () => {
    mockPrisma.marketArea.findMany.mockRejectedValue(new Error('boom'))

    await expect(listMarketAreas()).rejects.toThrow('boom')
  })
})
