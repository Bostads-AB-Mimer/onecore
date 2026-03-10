import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/keyLoanService', () => ({
  keyLoanService: {
    getByRentalObject: vi.fn(),
  },
}))

import { findExistingActiveLoansForTransfer } from '../loanTransferHelpers'
import { keyLoanService } from '../api/keyLoanService'

function makeLoan(overrides: Record<string, any> = {}) {
  return {
    id: 'loan-1',
    loanType: 'TENANT',
    contact: null,
    contact2: null,
    keysArray: [],
    keyCardsArray: [],
    ...overrides,
  }
}

describe('findExistingActiveLoansForTransfer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('matches on primary contact', async () => {
    vi.mocked(keyLoanService.getByRentalObject).mockResolvedValue([
      makeLoan({ contact: 'P001' }),
    ] as any)

    const result = await findExistingActiveLoansForTransfer(['P001'], 'R001')

    expect(result).toHaveLength(1)
    expect(result[0].loan.contact).toBe('P001')
  })

  it('matches on secondary contact (contact2)', async () => {
    vi.mocked(keyLoanService.getByRentalObject).mockResolvedValue([
      makeLoan({ contact: 'OTHER', contact2: 'P002' }),
    ] as any)

    const result = await findExistingActiveLoansForTransfer(['P002'], 'R001')

    expect(result).toHaveLength(1)
  })

  it('separates disposed keys into disposedKeys and non-disposed into keysToTransfer', async () => {
    vi.mocked(keyLoanService.getByRentalObject).mockResolvedValue([
      makeLoan({
        contact: 'P001',
        keysArray: [
          { id: 'k1', disposed: false },
          { id: 'k2', disposed: true },
          { id: 'k3', disposed: false },
        ],
      }),
    ] as any)

    const result = await findExistingActiveLoansForTransfer(['P001'], 'R001')

    expect(result[0].keysToTransfer).toHaveLength(2)
    expect(result[0].keysToTransfer.map((k) => k.id)).toEqual(['k1', 'k3'])
    expect(result[0].disposedKeys).toHaveLength(1)
    expect(result[0].disposedKeys[0].id).toBe('k2')
  })
})
