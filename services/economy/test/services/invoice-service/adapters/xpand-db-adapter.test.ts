const mockRaw = jest.fn()

// Queue of results returned (FIFO) by successive query-builder chains, i.e.
// each `db('table')....` call resolves to the next enqueued rows array.
const mockQueryResults: any[] = []

const mockDb: any = jest.fn(() => {
  const result = mockQueryResults.length ? mockQueryResults.shift() : []
  const builder: any = {}
  const chain = () => builder
  ;[
    'innerJoin',
    'leftJoin',
    'where',
    'andWhere',
    'andWhereLike',
    'whereIn',
    'distinct',
    'select',
    'orderBy',
    'from',
  ].forEach((method) => (builder[method] = jest.fn(chain)))
  builder.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject)
  return builder
})
mockDb.raw = mockRaw

jest.mock('knex', () => () => mockDb)

import { schemas } from '@onecore/types'

import * as adapter from '@src/services/invoice-service/adapters/xpand-db-adapter'
import { InvoiceWithAccounting } from '@src/common/types/typesv2'

beforeEach(() => {
  jest.clearAllMocks()
  mockQueryResults.length = 0
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
})

describe(adapter.getInvoiceRows, () => {
  it('returns empty array when no invoice numbers are provided', async () => {
    const result = await adapter.getInvoiceRows(2025, '001', [])
    expect(result).toEqual([])
  })

  it('returns invoice rows when invoice numbers are provided', async () => {
    // Expected result of the invoice row query
    mockRaw.mockResolvedValueOnce([
      {
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
        invoiceFromDate: new Date('2025-01-01'),
        invoiceToDate: new Date('2025-01-01'),
        expirationDate: new Date('2025-01-01'),
        invoiceTotal: 100,
        invoice: '1234567890',
        invoiceRowText: 'invoiceRowText',
        invoiceDate: new Date('2025-01-01'),
        invoiceNumber: '1234567890',
        invoiceTotalAmount: 100,
        projectCode: 'projectCode',
      },
    ])

    const result = await adapter.getInvoiceRows(2025, '001', ['1234567890'])

    expect(result).toHaveLength(1)
    expect(() =>
      schemas.v1.InvoiceRowSchema.array().parse(result)
    ).not.toThrow()
  })
})
