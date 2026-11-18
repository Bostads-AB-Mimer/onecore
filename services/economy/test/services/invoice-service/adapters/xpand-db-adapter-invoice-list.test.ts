// Tests for the Xpand invoice lookups behind the invoice list
// (GET /invoices/bycontactcode). Kept apart from xpand-db-adapter.test.ts
// because they need a query-builder mock that records each query per table.

const mockRaw = jest.fn()

// Per-table query results for the chainable query-builder mock. Two modes:
// - static: an array of row objects — every query for the table resolves to it
// - queue: an array of arrays — each query for the table consumes the next
//   result set, so two queries against the same table can get different rows
// An Error entry makes every query for the table reject with it.
const mockTableQueries: Record<string, unknown[] | Error> = {}

const resolveTableResult = (table: string | undefined): unknown[] | Error => {
  const entry = mockTableQueries[table ?? '']
  if (!entry) {
    return []
  }
  if (entry instanceof Error) {
    return entry
  }
  if (entry.length > 0 && Array.isArray(entry[0])) {
    // Queue mode: the first element is an array (checked above), so each entry
    // is a result set.
    return (entry.shift() as unknown[]) ?? []
  }
  return entry
}

const chainMethods = [
  'innerJoin',
  'leftJoin',
  'where',
  'andWhere',
  'whereIn',
  'select',
  'orderBy',
] as const

type MockChain = {
  [M in (typeof chainMethods)[number]]: jest.Mock
} & {
  then: (
    resolve: (value: unknown[]) => unknown,
    reject: (reason: unknown) => unknown
  ) => unknown
  from: jest.Mock
}

// Chainables recorded per table, in creation order, so tests can assert on the
// query methods of a specific query (e.g. which args `whereIn` got).
const mockTableChains: Record<string, MockChain[]> = {}

// Resolves lazily via the table name so both `db('krfkh')` and
// `db.select(...).from('krfkh')` pick their result set from mockTableQueries.
const createChainable = (table?: string): MockChain => {
  let resolveTable = table
  // Filled in below: then, from and every chain method are assigned before
  // the chain is returned.
  const chain = {} as MockChain
  chain.then = (resolve, reject) => {
    const result = resolveTableResult(resolveTable)
    return result instanceof Error ? reject(result) : resolve(result)
  }
  const register = (t: string) => {
    resolveTable = t
    mockTableChains[t] = mockTableChains[t] ?? []
    mockTableChains[t].push(chain)
  }
  for (const method of chainMethods) {
    chain[method] = jest.fn().mockReturnValue(chain)
  }
  chain.from = jest.fn((t: string) => {
    register(t)
    return chain
  })
  if (table) register(table)
  return chain
}

const mockDb = Object.assign(
  jest.fn((table: string) => createChainable(table)),
  {
    raw: mockRaw,
    select: jest.fn((...args: unknown[]) => {
      const chain = createChainable()
      chain.select(...args)
      return chain
    }),
    from: jest.fn((table: string) => createChainable(table)),
  }
)

jest.mock('knex', () => () => mockDb)

import { schemas } from '@onecore/types'
import { logger } from '@onecore/utilities'

import * as adapter from '@src/services/invoice-service/adapters/xpand-db-adapter'

const clearTableMocks = () => {
  for (const key of Object.keys(mockTableQueries)) {
    delete mockTableQueries[key]
  }
  for (const key of Object.keys(mockTableChains)) {
    delete mockTableChains[key]
  }
}

const leaseQueries = () =>
  (mockTableChains['krfkh'] ?? []).filter((chain) =>
    chain.whereIn.mock.calls.some(
      (call: unknown[]) => call[0] === 'krfkh.reference'
    )
  )

beforeEach(() => {
  jest.clearAllMocks()
  clearTableMocks()
})

describe(adapter.getInvoiceRows, () => {
  const baseRow = {
    text: 'Hyra bostad    ',
    roundoff: 0,
    rowtype: 1,
    rentArticle: 'HYRAB   ',
    printGroup: 'A   ',
    rowReduction: 100,
    rowAmount: 100,
    rowVat: 100,
    invoiceToDate: new Date('2025-01-31'),
    expirationDate: new Date('2025-02-28'),
    invoice: '1234567890    ',
    invdate: new Date('2025-01-15'),
    type: 1,
  }

  // Matches xledgerDateString (UTC-based), used for pass-through assertions.
  const toXledger = (d: Date) =>
    d.toISOString().substring(0, 10).replaceAll('-', '')

  it('returns an empty array without querying when no invoice numbers are given', async () => {
    // Act
    const result = await adapter.getInvoiceRows('001', [])

    // Assert
    expect(result).toEqual([])
    expect(mockRaw).not.toHaveBeenCalled()
  })

  it('returns invoice rows that match the invoice row schema', async () => {
    // Arrange
    mockRaw.mockResolvedValueOnce([
      { ...baseRow, invoiceFromDate: new Date('2025-01-01') },
    ])

    // Act
    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    // Assert
    expect(result).toHaveLength(1)
    expect(() =>
      schemas.v1.InvoiceRowSchema.array().parse(result)
    ).not.toThrow()
    expect(result[0]).toEqual(
      expect.objectContaining({
        invoiceNumber: '1234567890',
        invoiceRowText: 'Hyra bostad',
        rentArticle: 'HYRAB',
        printGroup: 'A',
        totalAmount: 300,
      })
    )
  })

  it('reverses the signs of a credit invoice row', async () => {
    // Arrange
    mockRaw.mockResolvedValueOnce([
      { ...baseRow, type: 2, invoiceFromDate: new Date('2025-01-01') },
    ])

    // Act
    const [row] = await adapter.getInvoiceRows('001', ['1234567890'])

    // Assert
    expect(row).toEqual(
      expect.objectContaining({ amount: -100, vat: -100, totalAmount: -300 })
    )
  })

  it('passes the invoice numbers as bindings, not in the SQL text', async () => {
    // Arrange
    mockRaw.mockResolvedValueOnce([])
    // Would break the query if it were interpolated.
    const invoiceNumbers = ['1234567890', "1') OR 1=1 --"]

    // Act
    await adapter.getInvoiceRows('001', invoiceNumbers)

    // Assert
    const [sql, bindings] = mockRaw.mock.calls[0]
    expect(sql).not.toContain('1234567890')
    expect(sql).not.toContain('OR 1=1')
    expect(bindings).toEqual(['FADBT_HYRA', '001', ...invoiceNumbers])
  })

  it('casts the invoice numbers to the column type so the index can be used', async () => {
    // Arrange
    mockRaw.mockResolvedValueOnce([])

    // Act
    await adapter.getInvoiceRows('001', ['1234567890', '1234567891'])

    // Assert
    const [sql] = mockRaw.mock.calls[0]
    expect(sql).toContain(
      'invoice IN (CAST(? AS varchar(25)), CAST(? AS varchar(25)))'
    )
  })

  it('queries many invoice numbers in chunks below the SQL Server parameter limit', async () => {
    // Arrange
    mockRaw.mockResolvedValue([])
    const invoiceNumbers = Array.from({ length: 1200 }, (_, i) => String(i))

    // Act
    await adapter.getInvoiceRows('001', invoiceNumbers)

    // Assert
    expect(mockRaw).toHaveBeenCalledTimes(3)
    const queriedInvoiceNumbers = mockRaw.mock.calls.flatMap(
      ([, bindings]: [string, string[]]) => bindings.slice(2)
    )
    expect(queriedInvoiceNumbers).toEqual(invoiceNumbers)
    for (const [, bindings] of mockRaw.mock.calls) {
      expect(bindings.length).toBeLessThan(2100)
    }
  })

  it('logs and rethrows when the query fails', async () => {
    // Arrange
    const error = new Error('connection lost')
    mockRaw.mockRejectedValueOnce(error)

    // Act & Assert
    await expect(adapter.getInvoiceRows('001', ['1234567890'])).rejects.toBe(
      error
    )
    expect(logger.error).toHaveBeenCalledWith(
      { err: error },
      'adapter.getInvoiceRows'
    )
  })

  it("keeps the invoice's period on a row from a past month", async () => {
    // Arrange
    const fromDate = new Date('2025-03-01')
    const toDate = new Date('2025-03-31')
    mockRaw.mockResolvedValueOnce([
      { ...baseRow, invoiceFromDate: fromDate, invoiceToDate: toDate },
    ])

    // Act
    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    // Assert
    expect(result[0].fromDate).toBe(toXledger(fromDate))
    expect(result[0].toDate).toBe(toXledger(toDate))
  })
})

describe(adapter.getInvoicesByContactCode, () => {
  const sharedLeaseId = '924-033-01-0201/10'

  const invoiceRow = {
    invoiceId: '552012345678    ',
    leaseId: `${sharedLeaseId}    `,
    amount: 7000,
    reduction: 0,
    vat: 0,
    roundoff: 0,
    fromDate: new Date('2026-01-01'),
    toDate: new Date('2026-01-31'),
    invoiceDate: new Date('2025-12-15'),
    expirationDate: new Date('2025-12-31'),
    debitStatus: 1,
    paymentStatus: 2,
    transactionType: '_S2Y14GIUN',
    transactionTypeName: 'HYRA    ',
    recipientContactCode: 'P083974    ',
    invoiceRowKey: '_KRFKH0001    ',
  }

  it('transforms an Xpand invoice into a legacy invoice', async () => {
    // Arrange
    mockTableQueries['hyavk'] = []
    mockTableQueries['krfkh'] = [invoiceRow]

    // Act
    const result = await adapter.getInvoicesByContactCode('P083974')

    // Assert
    expect(result).toEqual([
      expect.objectContaining({
        invoiceId: '552012345678',
        leaseIds: [sharedLeaseId],
        reference: 'P083974',
        amount: 7000,
        transactionTypeName: 'HYRA',
        source: 'legacy',
        invoiceRows: [],
        credit: null,
      }),
    ])
  })

  // MIM-1160/MIM-1221: a co-holder (INNEHAVARE in hyavk) has no invoices bound
  // to their own contact (krfkh.keycmctc points at the paying tenant only), so
  // invoices must also be fetched for the leases the contact holds.
  it('queries invoices for leases where the contact is a lease holder', async () => {
    // Arrange
    mockTableQueries['hyavk'] = [
      { leaseId: `${sharedLeaseId}    `, lastDebitDate: null },
    ]
    mockTableQueries['krfkh'] = [invoiceRow]

    // Act
    const result = await adapter.getInvoicesByContactCode('P083975')

    // Assert
    // Only INNEHAVARE relations may widen the invoice lookup — other relation
    // types (e.g. guarantors) must not expose invoices.
    const hyavkQuery = (mockTableChains['hyavk'] ?? [])[0]
    expect(hyavkQuery?.where).toHaveBeenCalledWith(
      'hyavk.keyhyakt',
      'INNEHAVARE'
    )
    expect(leaseQueries()[0]?.whereIn).toHaveBeenCalledWith('krfkh.reference', [
      sharedLeaseId,
    ])
    expect(result?.map((i) => i.invoiceId)).toEqual(['552012345678'])
    // reference must be the actual payer, not the contact the lookup was for
    expect(result?.[0].reference).toBe('P083974')
  })

  it('excludes terminated leases', async () => {
    // Arrange
    const today = new Date()
    mockTableQueries['hyavk'] = [
      { leaseId: sharedLeaseId, lastDebitDate: null, terminationDate: null },
      // Still billed today: the last debit day counts as active.
      {
        leaseId: `${sharedLeaseId.slice(0, -1)}1`,
        lastDebitDate: today,
        terminationDate: null,
      },
      // Last debit date has passed.
      {
        leaseId: '111-111-11-1111/01',
        lastDebitDate: new Date('2023-01-31'),
        terminationDate: null,
      },
      // Termination date has passed, even though billing never stopped.
      {
        leaseId: '222-222-22-2222/01',
        lastDebitDate: null,
        terminationDate: new Date('2023-01-31'),
      },
    ]
    mockTableQueries['krfkh'] = [invoiceRow]

    // Act
    await adapter.getInvoicesByContactCode('P083975')

    // Assert
    expect(leaseQueries()[0]?.whereIn).toHaveBeenCalledWith('krfkh.reference', [
      sharedLeaseId,
      `${sharedLeaseId.slice(0, -1)}1`,
    ])
  })

  it('returns household invoices for a co-holder with no own invoices', async () => {
    // Arrange
    mockTableQueries['hyavk'] = [
      { leaseId: sharedLeaseId, lastDebitDate: null },
    ]
    mockTableQueries['krfkh'] = [
      [], // recipient query: no invoices bound to the co-holder
      [invoiceRow], // lease query: the household's invoice
    ]

    // Act
    const result = await adapter.getInvoicesByContactCode('P083975')

    // Assert
    expect(result).toHaveLength(1)
    expect(result?.[0].invoiceId).toBe('552012345678')
    expect(result?.[0].reference).toBe('P083974')
  })

  it('queries the leases of a contact with many leases in chunks', async () => {
    // Arrange
    mockTableQueries['hyavk'] = Array.from({ length: 501 }, (_, i) => ({
      leaseId: `lease-${i}`,
      lastDebitDate: null,
    }))
    mockTableQueries['krfkh'] = []

    // Act
    await adapter.getInvoicesByContactCode('P083975')

    // Assert
    const chunkSizes = leaseQueries().map(
      (chain) => chain.whereIn.mock.calls[1][1].length
    )
    expect(chunkSizes).toEqual([500, 1])
  })

  it('keeps two distinct rows that share an invoice number', async () => {
    // Arrange
    // krfkh invoice numbers are not guaranteed unique — dedupe must key on
    // the primary key, not the number.
    mockTableQueries['hyavk'] = []
    mockTableQueries['krfkh'] = [
      { ...invoiceRow, invoiceRowKey: '_KRFKH0001' },
      { ...invoiceRow, invoiceRowKey: '_KRFKH0002' },
    ]

    // Act
    const result = await adapter.getInvoicesByContactCode('P083975')

    // Assert
    expect(result).toHaveLength(2)
  })

  it('deduplicates invoices found both via recipient and via lease', async () => {
    // Arrange
    mockTableQueries['hyavk'] = [
      { leaseId: sharedLeaseId, lastDebitDate: null },
    ]
    // Both the recipient query and the lease query resolve the same row.
    mockTableQueries['krfkh'] = [invoiceRow]

    // Act
    const result = await adapter.getInvoicesByContactCode('P083974')

    // Assert
    expect(result).toHaveLength(1)
  })

  it('does not query invoices by lease when the contact holds no leases', async () => {
    // Arrange
    mockTableQueries['hyavk'] = []
    mockTableQueries['krfkh'] = [invoiceRow]

    // Act
    await adapter.getInvoicesByContactCode('P083975')

    // Assert
    expect(leaseQueries()).toHaveLength(0)
  })

  it('returns recipient invoices when the lease holder lookup fails', async () => {
    // Arrange
    mockTableQueries['hyavk'] = new Error('hyavk unavailable')
    mockTableQueries['krfkh'] = [invoiceRow]

    // Act
    const result = await adapter.getInvoicesByContactCode('P083974')

    // Assert
    expect(result).toHaveLength(1)
    expect(leaseQueries()).toHaveLength(0)
    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      'adapter.getHolderLeaseIds'
    )
  })

  it('logs and rethrows when the invoice query fails', async () => {
    // Arrange
    mockTableQueries['hyavk'] = []
    mockTableQueries['krfkh'] = new Error('krfkh unavailable')

    // Act & Assert
    await expect(adapter.getInvoicesByContactCode('P083974')).rejects.toThrow(
      'krfkh unavailable'
    )
    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error), contactCode: 'P083974' },
      'adapter.getInvoicesByContactCode'
    )
  })

  it('excludes deleted invoices and returns undefined when nothing remains', async () => {
    // Arrange
    mockTableQueries['hyavk'] = []
    // debitStatus 6 = deleted (makulerad) and must be filtered out
    mockTableQueries['krfkh'] = [{ ...invoiceRow, debitStatus: 6 }]

    // Act
    const withDeleted = await adapter.getInvoicesByContactCode('P083975')
    mockTableQueries['krfkh'] = []
    const withNoRows = await adapter.getInvoicesByContactCode('P083975')

    // Assert
    expect(withDeleted).toEqual([])
    expect(withNoRows).toBeUndefined()
  })
})
