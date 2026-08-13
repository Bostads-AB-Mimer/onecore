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

  it('returns [] when Xledger returns null edges', async () => {
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
            edges: null,
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

    const result = await adapter.getInvoicePaymentEvents('1')
    expect(result).toEqual([])
  })

  it('drops the original invoice posting and OS rows, keeps credits and payments', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              {
                // Original invoice posting — must be dropped
                node: {
                  invoiceNumber: '12345',
                  amount: 100,
                  text: null,
                  paymentDate: null,
                  slTransactionType: { name: 'INVOICE' },
                  transactionHeader: {
                    postedDate: '2025-01-01',
                    transactionSource: { code: 'AR' },
                  },
                  matchId: 1,
                },
              },
              {
                // OS row — always dropped
                node: {
                  invoiceNumber: '12345',
                  amount: 100,
                  text: null,
                  paymentDate: '2025-01-01',
                  slTransactionType: null,
                  transactionHeader: {
                    postedDate: '2025-01-01',
                    transactionSource: { code: 'OS' },
                  },
                  matchId: 1,
                },
              },
              {
                // Credit memo — kept
                node: {
                  invoiceNumber: '12345K',
                  amount: -100,
                  text: null,
                  paymentDate: null,
                  slTransactionType: { name: 'CREDIT_MEMO' },
                  transactionHeader: {
                    postedDate: '2025-01-02',
                    transactionSource: { code: 'AR' },
                  },
                  matchId: 1,
                },
              },
              {
                // Bank payment — kept
                node: {
                  invoiceNumber: null,
                  amount: -100,
                  text: null,
                  paymentDate: '2025-01-03',
                  slTransactionType: { name: 'ELECTRONIC_PAYMENT' },
                  transactionHeader: {
                    postedDate: '2025-01-03',
                    transactionSource: { code: 'OCR' },
                  },
                  matchId: 1,
                },
              },
            ],
          },
        },
      })

    const result = await adapter.getInvoicePaymentEvents('1')

    expect(result).toEqual([
      expect.objectContaining({
        transactionSourceCode: 'OCR',
        invoiceId: null,
      }),
      expect.objectContaining({
        transactionSourceCode: 'AR',
        invoiceId: '12345K',
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

describe(adapter.submitMiscellaneousInvoice, () => {
  const invoice = {
    reference: '12345',
    invoiceDate: new Date('2026-08-13'),
    contactCode: 'P123456',
    tenantName: 'Test Tenant',
    leaseId: '123-456-78-9012/01',
    costCentre: 'KC01',
    propertyCode: '123',
    invoiceRows: [
      {
        price: 100,
        amount: 1,
        article: { id: '369800', name: 'Övriga intäkter', standardPrice: 100 },
      },
    ],
  }

  it('returns the created items on success', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          addInvoiceBaseItems: {
            edges: [{ node: { dbId: 1 } }],
          },
        },
      })

    const result = await adapter.submitMiscellaneousInvoice(invoice)

    expect(result).toEqual({ ok: true, data: [{ node: { dbId: 1 } }] })
  })

  it('returns xledger-customer-not-found when the subledger is missing', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        errors: [
          {
            message:
              "subledger.code: No value matching owner 42365431, code 'P123456'.",
          },
        ],
      })

    const result = await adapter.submitMiscellaneousInvoice(invoice)

    expect(result).toEqual({ ok: false, err: 'xledger-customer-not-found' })
  })

  it('returns xledger-customer-not-found when the subledger error arrives with a non-200 status', async () => {
    nock(origin)
      .post(pathname)
      .reply(400, {
        errors: [
          {
            message:
              "subledger.code: No value matching owner 42365431, code 'P123456'.",
          },
        ],
      })

    const result = await adapter.submitMiscellaneousInvoice(invoice)

    expect(result).toEqual({ ok: false, err: 'xledger-customer-not-found' })
  })

  it('returns unknown on other Xledger errors', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        errors: [{ message: 'Something else went wrong' }],
      })

    const result = await adapter.submitMiscellaneousInvoice(invoice)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})

describe(adapter.getInvoicesByInvoiceNumbers, () => {
  it('returns [] without calling Xledger when no valid invoice numbers', async () => {
    // No nock interceptor registered — an HTTP call would throw.
    const result = await adapter.getInvoicesByInvoiceNumbers([
      'abc',
      '1" ) { x }',
      '',
    ])

    expect(result).toEqual([])
  })

  it('fetches invoices for valid invoice numbers only', async () => {
    let capturedQuery = ''
    nock(origin)
      .post(pathname, (body) => {
        capturedQuery = body.query
        return true
      })
      .reply(200, {
        data: {
          arTransactions: {
            edges: [],
          },
        },
      })

    const result = await adapter.getInvoicesByInvoiceNumbers([
      '552012345678',
      'not-a-number',
      '12345K',
    ])

    expect(result).toEqual([])
    expect(capturedQuery).toContain('"552012345678"')
    expect(capturedQuery).toContain('"12345K"')
    expect(capturedQuery).not.toContain('not-a-number')
    // Without the source filter the same invoice number also matches payment
    // and credit transaction rows.
    expect(capturedQuery).toContain('headerTransactionSourceDbId_in')
  })
})
