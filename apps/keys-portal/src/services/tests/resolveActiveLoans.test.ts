import { describe, it, expect, vi, beforeEach } from 'vitest'

import { resolveActiveLoansForItems } from '../loans/resolveActiveLoans'
import { keyLoanService } from '../api/keyLoanService'
import { makeKey, makeCard, makeLoan } from './fixtures'

vi.mock('../api/keyLoanService', () => ({
  keyLoanService: {
    getByKeyId: vi.fn(),
    getByCardId: vi.fn(),
    get: vi.fn(),
  },
}))

beforeEach(() => {
  vi.mocked(keyLoanService.getByKeyId).mockReset()
  vi.mocked(keyLoanService.getByCardId).mockReset()
  vi.mocked(keyLoanService.get).mockReset()
})

describe('resolveActiveLoansForItems', () => {
  it('resolves the enriched active loan behind a single key', async () => {
    vi.mocked(keyLoanService.getByKeyId).mockResolvedValue([
      makeLoan({ id: 'L1' }),
    ])
    vi.mocked(keyLoanService.get).mockResolvedValue(
      makeLoan({ id: 'L1', keysArray: [makeKey({ id: 'k1' })] })
    )

    const loans = await resolveActiveLoansForItems(['k1'], [])

    expect(loans.map((l) => l.id)).toEqual(['L1'])
    expect(loans[0].keysArray).toHaveLength(1)
    expect(keyLoanService.get).toHaveBeenCalledTimes(1)
  })

  it('dedupes and skips items already covered by a found loan', async () => {
    // Both k1 and k2 belong to L1; fetching k1 should cover k2.
    vi.mocked(keyLoanService.getByKeyId).mockResolvedValue([
      makeLoan({ id: 'L1' }),
    ])
    vi.mocked(keyLoanService.get).mockResolvedValue(
      makeLoan({
        id: 'L1',
        keysArray: [makeKey({ id: 'k1' }), makeKey({ id: 'k2' })],
      })
    )

    const loans = await resolveActiveLoansForItems(['k1', 'k2'], [])

    expect(loans.map((l) => l.id)).toEqual(['L1'])
    expect(keyLoanService.getByKeyId).toHaveBeenCalledTimes(1)
    expect(keyLoanService.getByKeyId).toHaveBeenCalledWith('k1')
    expect(keyLoanService.get).toHaveBeenCalledTimes(1)
  })

  it('ignores a key whose only loans are already returned', async () => {
    vi.mocked(keyLoanService.getByKeyId).mockResolvedValue([
      makeLoan({ id: 'L1', returnedAt: '2025-01-01T00:00:00Z' }),
    ])

    const loans = await resolveActiveLoansForItems(['k1'], [])

    expect(loans).toEqual([])
    expect(keyLoanService.get).not.toHaveBeenCalled()
  })

  it('resolves the active loan behind a card', async () => {
    vi.mocked(keyLoanService.getByCardId).mockResolvedValue([
      makeLoan({ id: 'L2' }),
    ])
    vi.mocked(keyLoanService.get).mockResolvedValue(
      makeLoan({ id: 'L2', keyCardsArray: [makeCard({ cardId: 'c1' })] })
    )

    const loans = await resolveActiveLoansForItems([], ['c1'])

    expect(loans.map((l) => l.id)).toEqual(['L2'])
    expect(keyLoanService.getByCardId).toHaveBeenCalledWith('c1')
  })

  it('collects multiple distinct loans across keys and cards', async () => {
    vi.mocked(keyLoanService.getByKeyId).mockResolvedValue([
      makeLoan({ id: 'L1' }),
    ])
    vi.mocked(keyLoanService.getByCardId).mockResolvedValue([
      makeLoan({ id: 'L2' }),
    ])
    vi.mocked(keyLoanService.get).mockImplementation(async (id) =>
      id === 'L1'
        ? makeLoan({ id: 'L1', keysArray: [makeKey({ id: 'k1' })] })
        : makeLoan({ id: 'L2', keyCardsArray: [makeCard({ cardId: 'c1' })] })
    )

    const loans = await resolveActiveLoansForItems(['k1'], ['c1'])

    expect(loans.map((l) => l.id).sort()).toEqual(['L1', 'L2'])
    expect(keyLoanService.get).toHaveBeenCalledTimes(2)
  })

  it('returns [] when nothing is selected', async () => {
    const loans = await resolveActiveLoansForItems([], [])
    expect(loans).toEqual([])
    expect(keyLoanService.getByKeyId).not.toHaveBeenCalled()
    expect(keyLoanService.getByCardId).not.toHaveBeenCalled()
  })
})
