import nock from 'nock'

import * as adapter from '@src/services/common/adapters/xledger-adapter'
import config from '@src/common/config'
import { schemas } from '@onecore/types'

afterEach(nock.cleanAll)

const { origin, pathname } = new URL(config.xledger.url)

describe(adapter.getInvoicesByContactCode, () => {
  it('returns null when customer does not exist', async () => {
    nock(origin).post(pathname).reply(200, {
      data: null,
    })

    const result = await adapter.getInvoicesByContactCode('P12345')
    expect(result).toBeNull()
  })

  it('returns [] when customer exists but has no invoices', async () => {
    // First POST: customers query → return a dbId
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          customers: {
            edges: [{ node: { dbId: 1234 } }],
          },
        },
      })

    // Second POST: arTransactions query → no invoices
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [],
          },
        },
      })

    const result = await adapter.getInvoicesByContactCode('P12345')
    expect(result).toEqual([])
  })

  it('returns invoices when customer exists and has invoices', async () => {
    // First POST: customers query → return a dbId
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          customers: {
            edges: [{ node: { dbId: 1234 } }],
          },
        },
      })

    // Second POST: arTransactions query → no invoices
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              {
                node: {
                  invoiceNumber: '12345',
                  invoiceDate: '2025-01-01',
                  invoiceRemaining: 100,
                  subledger: {
                    code: 'code',
                  },
                  period: {
                    fromDate: '2025-01-01',
                    toDate: '2025-01-01',
                  },
                  dueDate: '2025-01-01',
                  text: null,
                  headerTransactionSourceDbId: 600,
                  amount: 100,
                },
              },
            ],
          },
        },
      })

    const result = await adapter.getInvoicesByContactCode('P12345')
    expect(result).toHaveLength(1)
    expect(() => schemas.v1.InvoiceSchema.array().parse(result)).not.toThrow()
  })

  it('marks invoice as credit when payment reference is set', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          customers: {
            edges: [{ node: { dbId: 1234 } }],
          },
        },
      })

    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              {
                node: {
                  invoiceNumber: '12345',
                  invoiceDate: '2025-01-01',
                  invoiceRemaining: 100,
                  subledger: {
                    code: 'code',
                  },
                  period: {
                    fromDate: '2025-01-01',
                    toDate: '2025-01-01',
                  },
                  dueDate: '2025-01-01',
                  text: null,
                  headerTransactionSourceDbId: 600,
                  amount: 100,
                  paymentReference: '123456',
                },
              },
            ],
          },
        },
      })

    const result = await adapter.getInvoicesByContactCode('P12345')
    expect(result).toEqual([
      expect.objectContaining({ credit: { originalInvoiceId: '123456' } }),
    ])
  })

  it('marks invoice as credit when invoice number ends with K', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          customers: {
            edges: [{ node: { dbId: 1234 } }],
          },
        },
      })

    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              {
                node: {
                  invoiceNumber: '12345K',
                  invoiceDate: '2025-01-01',
                  invoiceRemaining: 100,
                  subledger: {
                    code: 'code',
                  },
                  period: {
                    fromDate: '2025-01-01',
                    toDate: '2025-01-01',
                  },
                  dueDate: '2025-01-01',
                  text: null,
                  headerTransactionSourceDbId: 600,
                  amount: 100,
                },
              },
            ],
          },
        },
      })

    const result = await adapter.getInvoicesByContactCode('P12345')
    expect(result).toEqual([
      expect.objectContaining({ credit: { originalInvoiceId: '12345' } }),
    ])
  })
})

describe(adapter.getInvoicePaymentEvents, () => {
  it('returns null when customer does not exist', async () => {
    nock(origin).post(pathname).reply(200, {
      data: null,
    })

    const result = await adapter.getInvoicePaymentEvents('P12345')
    expect(result).toEqual([])
  })

  it('filters out AR and OS transactions', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              {
                node: {
                  type: 'foo',
                  invoiceNumber: '12345',
                  amount: 100,
                  text: null,
                  paymentDate: '2025-01-01',
                  transactionHeader: {
                    postedDate: '2025-01-01',
                    transactionSource: { code: 'AR' },
                  },
                  matchId: 1,
                },
              },
              {
                node: {
                  type: 'foo',
                  invoiceNumber: '12345',
                  amount: 100,
                  text: null,
                  paymentDate: '2025-01-01',
                  transactionHeader: {
                    postedDate: '2025-01-01',
                    transactionSource: { code: 'OS' },
                  },
                  matchId: 2,
                },
              },
              {
                node: {
                  type: 'OCR',
                  invoiceNumber: '12345',
                  amount: 100,
                  text: null,
                  paymentDate: '2025-01-01',
                  transactionHeader: {
                    postedDate: '2025-01-01',
                    transactionSource: { code: 'OCR' },
                  },
                  matchId: 3,
                },
              },
            ],
          },
        },
      })

    const result = await adapter.getInvoicePaymentEvents('12345')

    expect(() =>
      schemas.v1.InvoicePaymentEventSchema.array().parse(result)
    ).not.toThrow()

    expect(result).toEqual([
      expect.objectContaining({
        type: 'OCR',
      }),
    ])
  })
})

describe(adapter.getPaymentsSince, () => {
  const makeArTransactionEdge = (overrides?: {
    sourceCode?: string
    postedDate?: string
    cursor?: string
  }) => {
    const sourceCode = overrides?.sourceCode ?? 'OCR'
    return {
      cursor: overrides?.cursor ?? 'cursor-1',
      node: {
        matchId: 42,
        invoiceNumber: '55123456',
        amount: '1000.00',
        text: 'Hyra',
        paymentDate: '2026-04-01',
        transactionHeader: {
          postedDate: overrides?.postedDate ?? '2026-04-02',
          transactionSource: {
            code: sourceCode,
          },
        },
      },
    }
  }

  it('returns empty events and null cursor when no transactions exist', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [],
            pageInfo: { hasNextPage: false },
          },
        },
      })

    const result = await adapter.getPaymentsSince(null)
    expect(result).toEqual({ events: [], lastCursor: null })
  })

  it('returns payment events and lastCursor', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [makeArTransactionEdge({ cursor: 'cursor-42' })],
            pageInfo: { hasNextPage: false },
          },
        },
      })

    const result = await adapter.getPaymentsSince(null)

    expect(result.lastCursor).toBe('cursor-42')
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({
      invoiceId: '55123456',
      matchId: 42,
      amount: 1000,
      paymentDate: new Date('2026-04-02'),
      transactionSourceCode: 'OCR',
    })
    expect(() =>
      schemas.v1.InvoicePaymentEventSchema.array().parse(result.events)
    ).not.toThrow()
  })

  it('only returns OCR, BAA and BA transactions', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              makeArTransactionEdge({ sourceCode: 'AR' }),
              makeArTransactionEdge({ sourceCode: 'OS' }),
              makeArTransactionEdge({ sourceCode: 'SO' }),
              makeArTransactionEdge({ sourceCode: 'KF' }),
              makeArTransactionEdge({ sourceCode: 'GL' }),
              makeArTransactionEdge({ sourceCode: 'OCR' }),
              makeArTransactionEdge({ sourceCode: 'BAA' }),
              makeArTransactionEdge({ sourceCode: 'BA' }),
            ],
            pageInfo: { hasNextPage: false },
          },
        },
      })

    const result = await adapter.getPaymentsSince(null)

    expect(result.events).toHaveLength(3)
    expect(result.events.map((e) => e.transactionSourceCode)).toEqual([
      'OCR',
      'BAA',
      'BA',
    ])
  })

  it('paginates through multiple pages using cursor', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [makeArTransactionEdge({ cursor: 'page1-cursor' })],
            pageInfo: { hasNextPage: true },
          },
        },
      })

    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [makeArTransactionEdge({ cursor: 'page2-cursor' })],
            pageInfo: { hasNextPage: false },
          },
        },
      })

    const result = await adapter.getPaymentsSince(null)

    expect(result.events).toHaveLength(2)
    expect(result.lastCursor).toBe('page2-cursor')
  })

  it('falls back to paymentDate when postedDate is absent', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [makeArTransactionEdge({ postedDate: '' })],
            pageInfo: { hasNextPage: false },
          },
        },
      })

    const result = await adapter.getPaymentsSince(null)

    expect(result.events[0].paymentDate).toEqual(new Date('2026-04-01'))
  })

  it('uses filter: {} when afterCursor is provided', async () => {
    let capturedBody: any

    nock(origin)
      .post(pathname, (body) => {
        capturedBody = body
        return true
      })
      .reply(200, {
        data: {
          arTransactions: {
            edges: [],
            pageInfo: { hasNextPage: false },
          },
        },
      })

    await adapter.getPaymentsSince('saved-cursor')

    expect(capturedBody.variables.after).toBe('saved-cursor')
    expect(capturedBody.variables.since).toBeUndefined()
  })

  it('uses postedDate_gte date filter when no cursor (first run)', async () => {
    let capturedBody: any

    nock(origin)
      .post(pathname, (body) => {
        capturedBody = body
        return true
      })
      .reply(200, {
        data: {
          arTransactions: {
            edges: [],
            pageInfo: { hasNextPage: false },
          },
        },
      })

    const fallback = new Date('2026-04-01T12:00:00Z')
    await adapter.getPaymentsSince(null, fallback)

    expect(capturedBody.variables.since).toBe('2026-04-01')
    expect(capturedBody.variables.after).toBeNull()
  })
})

describe(adapter.getInvoiceMatchId, () => {
  it('returns null when matchId is not found', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [],
          },
        },
      })

    const result = await adapter.getInvoiceMatchId('12345')
    expect(result).toEqual(null)
  })

  it('returns null when matchId is 0', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              {
                node: { matchId: 0 },
              },
            ],
          },
        },
      })

    const result = await adapter.getInvoiceMatchId('12345')
    expect(result).toEqual(null)
  })

  it('returns matchId', async () => {
    const matchId = 12345

    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              {
                node: { matchId },
              },
            ],
          },
        },
      })

    const result = await adapter.getInvoiceMatchId('invoice-number')

    expect(result).toEqual(matchId)
  })
})
