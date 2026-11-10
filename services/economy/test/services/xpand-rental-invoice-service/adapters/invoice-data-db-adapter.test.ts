import { logger } from '@onecore/utilities'

const mockRaw = jest.fn()
let mockQueryResult: unknown[] = []
type MockChain = {
  select: jest.Mock
  distinct: jest.Mock
  where: jest.Mock
  then: (resolve: (value: unknown[]) => unknown) => unknown
}
const mockChain: MockChain = {
  select: jest.fn(() => mockChain),
  distinct: jest.fn(() => mockChain),
  where: jest.fn(() => mockChain),
  then: (resolve) => resolve(mockQueryResult),
}
const mockDb = Object.assign(
  jest.fn(() => mockChain),
  { raw: mockRaw, destroy: jest.fn() }
)

jest.mock('knex', () => () => mockDb)

import {
  getBatchAccountTotals,
  verifyImport,
} from '@src/services/xpand-rental-invoice-service/adapters/invoice-data-db-adapter'

beforeEach(() => {
  jest.clearAllMocks()
})

describe(verifyImport, () => {
  it('throws when an invoice selected for import is missing in the batch', async () => {
    mockQueryResult = [{ InvoiceNumber: '1' }]
    mockRaw.mockResolvedValueOnce([{ batchTotalAmount: 100 }])

    await expect(verifyImport(['1', '2'], '7', 100)).rejects.toThrow(
      'Invoices that were selected for import were not imported'
    )
  })

  it('warns when the batch total differs from the Xpand total', async () => {
    mockQueryResult = [{ InvoiceNumber: '1' }]
    mockRaw.mockResolvedValueOnce([{ batchTotalAmount: 100 }])

    await verifyImport(['1'], '7', -250)

    expect(mockRaw).toHaveBeenCalledWith(expect.any(String), ['7'])
    expect(logger.warn).toHaveBeenCalledWith(
      { batchId: '7', batchTotalAmount: 100, xpandTotalAmount: -250 },
      'Xpand total amount does not match batch row totals'
    )
  })

  it('does not warn when the totals match', async () => {
    mockQueryResult = [{ InvoiceNumber: '1' }]
    mockRaw.mockResolvedValueOnce([{ batchTotalAmount: 100.4 }])

    // Opposite signs, see verifyImport
    await verifyImport(['1'], '7', -100)

    expect(logger.warn).not.toHaveBeenCalled()
  })
})

describe(getBatchAccountTotals, () => {
  it('maps the sum of each account', async () => {
    mockRaw.mockResolvedValueOnce([
      { account: '3012', accountSum: 1000 },
      { account: '3999', accountSum: 0.43 },
    ])

    expect(await getBatchAccountTotals('7')).toEqual({
      '3012': 1000,
      '3999': 0.43,
    })
  })
})
