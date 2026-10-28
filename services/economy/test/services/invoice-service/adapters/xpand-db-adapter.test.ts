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
