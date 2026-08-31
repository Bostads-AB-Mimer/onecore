const mockRaw = jest.fn()

// Queue of results returned (FIFO) by successive query-builder chains, i.e.
// each `db('table')....` call resolves to the next enqueued rows array.
const mockQueryResults: any[] = []

// Per-table query results for the chainable query-builder mock (db('table')...).
// Tests set entries here to control what `await db('repsk').innerJoin(...).where(...)` resolves to.
const mockTableQueries: Record<string, unknown[]> = {}

const createChainable = (resolveValue: unknown[]) => {
  const chain: Record<string, unknown> = {
    then: (resolve: (value: unknown[]) => unknown) => resolve(resolveValue),
    catch: () => chain,
  }
  for (const method of [
    'innerJoin',
    'leftJoin',
    'where',
    'andWhere',
    'andWhereLike',
    'whereIn',
    'orWhere',
    'orWhereLike',
    'whereLike',
    'distinct',
    'select',
    'from',
    'orderBy',
    'limit',
    'offset',
  ]) {
    chain[method] = jest.fn().mockReturnValue(chain)
  }
  return chain
}

// Enqueued FIFO results (mockQueryResults) take precedence; otherwise the
// per-table results (mockTableQueries) are used.
const mockDb: any = jest.fn((table: string) =>
  createChainable(
    mockQueryResults.length ? mockQueryResults.shift() : (mockTableQueries[table] ?? [])
  )
)
mockDb.raw = mockRaw

jest.mock('knex', () => () => mockDb)

import { schemas } from '@onecore/types'

import * as adapter from '@src/services/invoice-service/adapters/xpand-db-adapter'
import { InvoiceWithAccounting } from '@src/common/types/typesv2'

beforeEach(() => {
  jest.clearAllMocks()
  mockQueryResults.length = 0
  for (const key of Object.keys(mockTableQueries)) {
    delete mockTableQueries[key]
  }
})

const buildInvoice = (
  projectCode: string | undefined
): InvoiceWithAccounting =>
  ({
    invoiceId: '55123456',
    invoiceDate: new Date('2026-06-15T00:00:00.000Z'),
    invoiceRows: [
      {
        rentalObject: 'RO1',
        account: '3012',
        projectCode,
      },
    ],
  }) as any

// getRentalSpecificRules runs a buildings query then an areas query. The
// buildings query returns a rule that only carries costCode and property
// (projectCode is never set by that lookup); the areas query returns nothing.
const enqueueXpandRuleWithoutProjectCode = () => {
  mockQueryResults.push([{ hyresid: 'RO1', p2: 'CC-XPAND', p3: 'PROP-XPAND' }])
  mockQueryResults.push([])
}

describe(adapter.enrichInvoiceWithAccounting, () => {
  it('keeps the article projectCode and does not overwrite it with the xpand rule', async () => {
    enqueueXpandRuleWithoutProjectCode()

    const invoice = buildInvoice('ARTICLE-PC')
    await adapter.enrichInvoiceWithAccounting(invoice)

    expect(invoice.invoiceRows[0].projectCode).toBe('ARTICLE-PC')
    // costCode/property fall back to the xpand rule since the row had none
    expect(invoice.invoiceRows[0].costCode).toBe('CC-XPAND')
    expect(invoice.invoiceRows[0].property).toBe('PROP-XPAND')
  })

  it('leaves projectCode undefined when neither the article nor the xpand rule provides one', async () => {
    enqueueXpandRuleWithoutProjectCode()

    const invoice = buildInvoice(undefined)
    await adapter.enrichInvoiceWithAccounting(invoice)

    expect(invoice.invoiceRows[0].projectCode).toBeUndefined()
  })

  it('throws when no accounting rule can be found for the rental object', async () => {
    mockQueryResults.push([]) // buildings
    mockQueryResults.push([]) // areas

    const invoice = buildInvoice('ARTICLE-PC')

    await expect(adapter.enrichInvoiceWithAccounting(invoice)).rejects.toThrow(
      /Kunde inte hitta konteringsregler/
    )
  })

  it('skips rows without a rental object when the article code is an exception', async () => {
    mockQueryResults.push([]) // buildings
    mockQueryResults.push([]) // areas

    const invoice = {
      invoiceId: '55123456',
      invoiceDate: new Date('2026-06-15T00:00:00.000Z'),
      invoiceRows: [
        {
          rentalObject: undefined,
          rentArticleName: 'FAKT AVG',
          account: '3012',
          projectCode: 'ARTICLE-PC',
        },
      ],
    } as any

    // Must not throw even though there is no rental object / rule.
    await adapter.enrichInvoiceWithAccounting(invoice)

    // The article accounting is left untouched (no xpand rule applied).
    expect(invoice.invoiceRows[0].projectCode).toBe('ARTICLE-PC')
    expect(invoice.invoiceRows[0].costCode).toBeUndefined()
    expect(invoice.invoiceRows[0].property).toBeUndefined()
  })

  it('throws when a row without a rental object is not an exception', async () => {
    mockQueryResults.push([]) // buildings
    mockQueryResults.push([]) // areas

    const invoice = {
      invoiceId: '55123456',
      invoiceDate: new Date('2026-06-15T00:00:00.000Z'),
      invoiceRows: [
        {
          rentalObject: undefined,
          rentArticleName: 'HYRAB',
          account: '3012',
        },
      ],
    } as any

    await expect(adapter.enrichInvoiceWithAccounting(invoice)).rejects.toThrow(
      /saknar hyresobjekt/
    )
  })
})

describe(adapter.getInvoiceRows, () => {
  it('returns empty array when no invoice numbers are provided', async () => {
    const result = await adapter.getInvoiceRows('001', [])
    expect(result).toEqual([])
  })

  const baseRow = {
    p1: 'foo',
    p5: 'foo',
    p4: 'foo',
    text: 'foo',
    roundoff: 0,
    rowtype: 1,
    cmctcben: 'foo',
    cmctckod: 'P12345',
    rentArticle: 'foo',
    printGroup: 'bar',
    printGroupLabel: 'baz',
    rowReduction: 100,
    rowAmount: 100,
    rowVat: 100,
    company: 'company',
    invoiceToDate: new Date('2025-01-31'),
    expirationDate: new Date('2025-02-28'),
    invoiceTotal: 100,
    invoice: '1234567890',
    invdate: new Date('2025-01-15'),
    type: 1,
  }

  const now = new Date()
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const pad = (n: number) => String(n).padStart(2, '0')
  const y = now.getFullYear()
  const m = pad(now.getMonth() + 1)
  const lastDay = pad(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  )
  const startOfCurrentMonthString = `${y}${m}01`
  const endOfCurrentMonthString = `${y}${m}${lastDay}`

  // toXledger matches xledgerDateString (UTC-based), used for pass-through assertions
  const toXledger = (d: Date) =>
    d.toISOString().substring(0, 10).replaceAll('-', '')

  it('returns invoice rows when invoice numbers are provided', async () => {
    mockRaw.mockResolvedValueOnce([
      { ...baseRow, invoiceFromDate: new Date('2025-01-01') },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result).toHaveLength(1)
    expect(() =>
      schemas.v1.InvoiceRowSchema.array().parse(result)
    ).not.toThrow()
  })

  it('uses first of current month as fromDate when invoiceFromDate is in a past month', async () => {
    mockRaw.mockResolvedValueOnce([
      { ...baseRow, invoiceFromDate: new Date('2025-01-01') },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result[0].fromDate).toBe(startOfCurrentMonthString)
  })

  it('uses last day of current month as toDate when invoiceToDate is in a past month', async () => {
    mockRaw.mockResolvedValueOnce([
      {
        ...baseRow,
        invoiceFromDate: startOfCurrentMonth,
        invoiceToDate: new Date('2025-01-31'),
      },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result[0].toDate).toBe(endOfCurrentMonthString)
  })

  it('uses invoiceFromDate as fromDate when it is in the current month', async () => {
    const currentMonthFromDate = new Date(now.getFullYear(), now.getMonth(), 10)
    mockRaw.mockResolvedValueOnce([
      { ...baseRow, invoiceFromDate: currentMonthFromDate },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result[0].fromDate).toBe(toXledger(currentMonthFromDate))
  })

  it('uses invoiceToDate as toDate when it is in the current month', async () => {
    const currentMonthToDate = new Date(now.getFullYear(), now.getMonth(), 20)
    mockRaw.mockResolvedValueOnce([
      {
        ...baseRow,
        invoiceFromDate: startOfCurrentMonth,
        invoiceToDate: currentMonthToDate,
      },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result[0].toDate).toBe(toXledger(currentMonthToDate))
  })

  it('uses invoiceFromDate as fromDate when it is in a future month', async () => {
    const futureFromDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    mockRaw.mockResolvedValueOnce([
      { ...baseRow, invoiceFromDate: futureFromDate },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result[0].fromDate).toBe(toXledger(futureFromDate))
  })

  it('uses invoiceToDate as toDate when it is in a future month', async () => {
    const futureToDate = new Date(now.getFullYear(), now.getMonth() + 1, 28)
    mockRaw.mockResolvedValueOnce([
      {
        ...baseRow,
        invoiceFromDate: startOfCurrentMonth,
        invoiceToDate: futureToDate,
      },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result[0].toDate).toBe(toXledger(futureToDate))
  })
})

describe(adapter.enrichInvoiceRows, () => {
  beforeEach(() => {
    for (const key of Object.keys(mockTableQueries)) {
      delete mockTableQueries[key]
    }
  })

  const xpandInvoice = {
    invdate: '20250115',
    fromdate: '20250101',
    todate: '20250131',
    expdate: '20250228',
  }

  it('drops every row of an invoice when any of its rows fails enrichment', async () => {
    // Specific rule exists for rental "000-A" only, not "000-B".
    // Both rows belong to invoice INV-1 — one row will succeed, the other will fail.
    // Per the "no partial invoices" guarantee, BOTH rows should be excluded.
    mockTableQueries['repsk'] = [
      { hyresid: '000-A', p2: 'COSTCODE-A', p3: 'PROPERTY-A' },
    ]

    const invoices = { 'INV-1': xpandInvoice } as any

    const rows = [
      {
        invoiceNumber: 'INV-1',
        contractCode: '000-A/01',
        company: '001',
        fromDate: '20250101',
      },
      {
        invoiceNumber: 'INV-1',
        contractCode: '000-B/01',
        company: '001',
        fromDate: '20250101',
      },
    ] as any

    const result = await adapter.enrichInvoiceRows(rows, invoices)

    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].invoiceNumber).toBe('INV-1')
  })

  it('keeps rows of a fully-successful invoice when a different invoice fails', async () => {
    // INV-1's rental ("000-A") has a rule. INV-2's rental ("000-B") does not.
    // INV-1 should pass through cleanly; INV-2 should be filtered out entirely.
    mockTableQueries['repsk'] = [
      { hyresid: '000-A', p2: 'COSTCODE-A', p3: 'PROPERTY-A' },
    ]

    const invoices = {
      'INV-1': xpandInvoice,
      'INV-2': xpandInvoice,
    } as any

    const rows = [
      {
        invoiceNumber: 'INV-1',
        contractCode: '000-A/01',
        company: '001',
        fromDate: '20250101',
      },
      {
        invoiceNumber: 'INV-1',
        contractCode: '000-A/02',
        company: '001',
        fromDate: '20250101',
      },
      {
        invoiceNumber: 'INV-2',
        contractCode: '000-B/01',
        company: '001',
        fromDate: '20250101',
      },
    ] as any

    const result = await adapter.enrichInvoiceRows(rows, invoices)

    expect(result.rows).toHaveLength(2)
    expect(result.rows.every((row) => row.invoiceNumber === 'INV-1')).toBe(true)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].invoiceNumber).toBe('INV-2')
  })

  it('records an error and excludes the rows when an invoice is not found in Xpand', async () => {
    mockTableQueries['repsk'] = [
      { hyresid: '000-A', p2: 'COSTCODE-A', p3: 'PROPERTY-A' },
    ]

    // The invoices map is empty — every row's invoice will be "not found".
    const invoices = {} as any

    const rows = [
      {
        invoiceNumber: 'INV-MISSING',
        contractCode: '000-A/01',
        company: '001',
        fromDate: '20250101',
      },
      {
        invoiceNumber: 'INV-MISSING',
        contractCode: '000-A/02',
        company: '001',
        fromDate: '20250101',
      },
    ] as any

    const result = await adapter.enrichInvoiceRows(rows, invoices)

    expect(result.rows).toHaveLength(0)
    expect(result.errors.some((e) => e.invoiceNumber === 'INV-MISSING')).toBe(
      true
    )
  })
})
