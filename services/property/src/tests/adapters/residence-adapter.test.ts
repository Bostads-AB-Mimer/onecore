jest.mock('../../adapters/db', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}))

import { prisma } from '../../adapters/db'
import { getCurrentRentByRentalId } from '../../adapters/residence-adapter'

type MockedPrisma = {
  $queryRaw: jest.Mock
}
const mockPrisma = prisma as unknown as MockedPrisma

const DAY = 24 * 60 * 60 * 1000

describe('residence-adapter.getCurrentRentByRentalId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the monthly rent valid today, ignoring rows from other periods', async () => {
    const now = Date.now()
    // Three debit rows for the same object across different periods.
    // Only the currently-valid row (no end date) should count — the
    // historical/future rows must NOT be summed on top of it.
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        rentalpropertyid: '202-001-01-0101',
        yearrent: 90000, // historical: ended last year
        debitfdate: new Date(now - 730 * DAY),
        debittodate: new Date(now - 365 * DAY),
      },
      {
        rentalpropertyid: '202-001-01-0101',
        yearrent: 112644, // current: valid from a year ago, open-ended
        debitfdate: new Date(now - 365 * DAY),
        debittodate: null,
      },
      {
        rentalpropertyid: '202-001-01-0101',
        yearrent: 150000, // future: starts next year
        debitfdate: new Date(now + 365 * DAY),
        debittodate: null,
      },
    ])

    const rent = await getCurrentRentByRentalId('202-001-01-0101')

    // 112644 / 12 = 9387 — not (90000 + 112644 + 150000) / 12
    expect(rent).toBe(9387)
  })

  it('returns null when the object has no rent rows', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])

    const rent = await getCurrentRentByRentalId('202-001-01-0101')

    expect(rent).toBeNull()
  })
})
