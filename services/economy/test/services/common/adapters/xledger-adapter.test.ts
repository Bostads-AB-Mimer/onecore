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
