import nock from 'nock'

import * as adapter from '@src/services/common/adapters/xledger-adapter'
import config from '@src/common/config'
import { PaymentStatus, schemas } from '@onecore/types'

afterEach(() => {
  nock.abortPendingRequests()
  nock.cleanAll()
})

const { origin, pathname } = new URL(config.xledger.url)

const rateLimitBody = {
  errors: [
    { code: 'BAD_REQUEST.BURST_RATE_LIMIT_REACHED', message: 'Rate limited' },
  ],
}
const matchIdBody = {
  data: { arTransactions: { edges: [{ node: { matchId: 1 } }] } },
}

describe('makeXledgerRequest rate limiting', () => {
  const defaultPolicy = { ...adapter.xledgerRequestPolicy }

  beforeEach(() => {
    adapter.setXledgerRequestPolicy({ baseDelayMs: 1, maxDelayMs: 5 })
  })

  afterEach(() => {
    adapter.setXledgerRequestPolicy(defaultPolicy)
  })

  it('retries after a burst rate limit and succeeds', async () => {
    nock(origin).post(pathname).reply(200, rateLimitBody)
    nock(origin).post(pathname).reply(200, rateLimitBody)
    nock(origin).post(pathname).reply(200, matchIdBody)

    await expect(adapter.getInvoiceMatchId('1')).resolves.toEqual(1)
    expect(nock.isDone()).toBe(true)
  })

  it('gives up after maxAttempts instead of retrying forever', async () => {
    adapter.setXledgerRequestPolicy({ maxAttempts: 3 })
    const scope = nock(origin).post(pathname).times(3).reply(200, rateLimitBody)
    const extra = nock(origin).post(pathname).reply(200, matchIdBody)

    await expect(adapter.getInvoiceMatchId('1')).rejects.toThrow(
      /rate limit.*3 attempts/i
    )
    expect(scope.isDone()).toBe(true)
    expect(extra.isDone()).toBe(false)
  })

  it('waits with exponential backoff and jitter between attempts', () => {
    adapter.setXledgerRequestPolicy({ baseDelayMs: 1000, maxDelayMs: 10_000 })

    expect(adapter.retryDelayMs(1, () => 0)).toBe(500)
    expect(adapter.retryDelayMs(2, () => 0)).toBe(1000)
    expect(adapter.retryDelayMs(3, () => 0)).toBe(2000)
    expect(adapter.retryDelayMs(1, () => 0.5)).toBe(1000)
    expect(adapter.retryDelayMs(1, () => 0.999)).toBeLessThan(1500)
    expect(adapter.retryDelayMs(10, () => 0.999)).toBeLessThan(15_000)
    expect(adapter.retryDelayMs(10, () => 0.5)).toBe(10_000)
  })

  it('releases its slot while sleeping between retries', async () => {
    adapter.setXledgerRequestPolicy({
      maxConcurrency: 1,
      baseDelayMs: 100,
      maxDelayMs: 100,
    })
    nock(origin).post(pathname).reply(200, rateLimitBody)
    nock(origin).post(pathname).times(2).reply(200, matchIdBody)

    const rateLimited = adapter.getInvoiceMatchId('1')
    const started = Date.now()
    const normal = adapter.getInvoiceMatchId('2')

    await expect(normal).resolves.toEqual(1)
    expect(Date.now() - started).toBeLessThan(50)
    await expect(rateLimited).resolves.toEqual(1)
  })

  it('never has more than maxConcurrency requests in flight', async () => {
    adapter.setXledgerRequestPolicy({ maxConcurrency: 2 })
    let inFlight = 0
    let peak = 0

    nock(origin)
      .post(pathname)
      .times(6)
      .reply(async () => {
        inFlight++
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, 10))
        inFlight--
        return [200, matchIdBody]
      })

    await Promise.all(
      Array.from({ length: 6 }, () => adapter.getInvoiceMatchId('1'))
    )

    expect(peak).toBe(2)
  })

  it('times out and does not retry a slow request', async () => {
    adapter.setXledgerRequestPolicy({ timeoutMs: 20 })
    const slow = nock(origin).post(pathname).delay(200).reply(200, matchIdBody)
    const extra = nock(origin).post(pathname).reply(200, matchIdBody)

    await expect(adapter.getInvoiceMatchId('1')).rejects.toThrow(/timeout/i)
    expect(slow.isDone()).toBe(true)
    expect(extra.isDone()).toBe(false)
  })
})

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

describe('kundförlust (KF) rows', () => {
  // A write-off is booked in Xledger as a KF-sourced row on the customer
  // ledger account, matched to the invoice. Xledger then reports
  // invoiceRemaining as 0, which must not read as paid.
  const invoiceRow = {
    invoiceNumber: '12043',
    invoiceDate: '2026-05-20',
    invoiceRemaining: '0.0000',
    amount: '1250.0000',
    subledger: { code: 'P058289' },
    period: { fromDate: '2026-05-01', toDate: '2026-05-31' },
    dueDate: '2026-06-19',
    text: 'Sergel Inkasso 20260724',
    headerTransactionSourceDbId: 600,
    transactionHeader: { transactionSource: { code: 'SO' } },
    account: { code: '1530' },
  }
  const writeOffRow = {
    invoiceNumber: '12043',
    invoiceDate: '2026-10-01',
    invoiceRemaining: '0.0000',
    amount: '-1250.0000',
    subledger: { code: 'P058289' },
    period: { fromDate: '2026-10-01', toDate: '2026-10-01' },
    dueDate: '2026-10-01',
    text: null,
    headerTransactionSourceDbId: 49647743,
    transactionHeader: { transactionSource: { code: 'KF' } },
    account: { code: '1530' },
  }
  const customerReply = {
    data: { customers: { edges: [{ node: { dbId: 1234 } }] } },
  }

  it('requests KF rows together with invoices for a contact', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: { customers: { edges: [{ node: { dbId: 1234 } }] } },
      })
    let capturedQuery = ''
    nock(origin)
      .post(pathname, (body) => {
        capturedQuery = body.query
        return true
      })
      .reply(200, { data: { arTransactions: { edges: [] } } })

    await adapter.getInvoicesByContactCode('P058289')

    expect(capturedQuery).toContain('49647743')
  })

  it('folds a KF row into its invoice as written off instead of paid', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: { customers: { edges: [{ node: { dbId: 1234 } }] } },
      })
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [{ node: invoiceRow }, { node: writeOffRow }],
          },
        },
      })

    const result = await adapter.getInvoicesByContactCode('P058289')

    expect(result).toEqual([
      expect.objectContaining({
        invoiceId: '12043',
        paymentStatus: PaymentStatus.WrittenOff,
        writtenOffAmount: 1250,
        paidAmount: 0,
        remainingAmount: 0,
      }),
    ])
    expect(() => schemas.v1.InvoiceSchema.array().parse(result)).not.toThrow()
  })

  it('keeps the paid part when only part of an invoice is written off', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: { customers: { edges: [{ node: { dbId: 1234 } }] } },
      })
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              { node: invoiceRow },
              { node: { ...writeOffRow, amount: '-250.0000' } },
            ],
          },
        },
      })

    const result = await adapter.getInvoicesByContactCode('P058289')

    expect(result).toEqual([
      expect.objectContaining({
        paymentStatus: PaymentStatus.WrittenOff,
        writtenOffAmount: 250,
        paidAmount: 1000,
      }),
    ])
  })

  it('folds KF rows into invoices looked up by invoice number', async () => {
    let capturedBody: any
    nock(origin)
      .post(pathname, (body) => {
        capturedBody = body
        return true
      })
      .reply(200, {
        data: {
          arTransactions: {
            edges: [{ node: invoiceRow }, { node: writeOffRow }],
          },
        },
      })

    const result = await adapter.getInvoicesByInvoiceNumbers(['12043'])

    expect(
      capturedBody.variables.filter.headerTransactionSourceDbId_in
    ).toContain(49647743)
    expect(result).toEqual([
      expect.objectContaining({
        invoiceId: '12043',
        paymentStatus: PaymentStatus.WrittenOff,
        writtenOffAmount: 1250,
      }),
    ])
  })

  it('classifies a write-off by its source code, not its dbId', async () => {
    // The dbId is entity-specific; the code is Xledger's own label.
    nock(origin).post(pathname).reply(200, customerReply)
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              { node: invoiceRow },
              { node: { ...writeOffRow, headerTransactionSourceDbId: 1 } },
            ],
          },
        },
      })

    const result = await adapter.getInvoicesByContactCode('P058289')

    expect(result).toEqual([
      expect.objectContaining({
        invoiceId: '12043',
        paymentStatus: PaymentStatus.WrittenOff,
      }),
    ])
  })

  it('leaves writtenOffAmount unset when KF rows net to zero', async () => {
    // A reversed write-off reopens the invoice; status follows the balance.
    nock(origin).post(pathname).reply(200, customerReply)
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              { node: { ...invoiceRow, invoiceRemaining: '1250.0000' } },
              { node: writeOffRow },
              { node: { ...writeOffRow, amount: '1250.0000' } },
            ],
          },
        },
      })

    const result = await adapter.getInvoicesByContactCode('P058289')

    expect(result).toHaveLength(1)
    expect(result?.[0].writtenOffAmount).toBeUndefined()
    expect(result?.[0].paymentStatus).toBe(PaymentStatus.Overdue)
  })

  it('folds KF rows into a single-invoice lookup', async () => {
    let capturedQuery = ''
    nock(origin)
      .post(pathname, (body) => {
        capturedQuery = body.query
        return true
      })
      .reply(200, {
        data: {
          arTransactions: {
            edges: [{ node: invoiceRow }, { node: writeOffRow }],
          },
        },
      })

    const result = await adapter.getInvoiceByInvoiceNumber('12043')

    expect(capturedQuery).toContain('49647743')
    expect(capturedQuery).not.toMatch(/first:\s*1\b/)
    expect(result).toEqual(
      expect.objectContaining({
        invoiceId: '12043',
        paymentStatus: PaymentStatus.WrittenOff,
        writtenOffAmount: 1250,
      })
    )
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
  it('returns [] without calling Xledger when given no invoice numbers', async () => {
    // No nock interceptor registered — an HTTP call would throw.
    const result = await adapter.getInvoicesByInvoiceNumbers([])

    expect(result).toEqual([])
  })

  it('requests a page size well above the invoice-number chunk size', async () => {
    // One invoice number can match several transaction rows, so `first` must
    // exceed the chunk size or Xledger silently truncates the result.
    let capturedVariables: any
    nock(origin)
      .post(pathname, (body) => {
        capturedVariables = body.variables
        return true
      })
      .reply(200, { data: { arTransactions: { edges: [] } } })

    await adapter.getInvoicesByInvoiceNumbers(['552012345678'])

    expect(capturedVariables.first).toBeGreaterThanOrEqual(1000)
  })

  it('passes invoice numbers as GraphQL variables, not into the query document', async () => {
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
          },
        },
      })

    // The second value would break the query if it were interpolated.
    const invoiceNumbers = ['552012345678', '1" ) { x }', '12345K']
    const result = await adapter.getInvoicesByInvoiceNumbers(invoiceNumbers)

    expect(result).toEqual([])
    expect(capturedBody.variables.filter.invoiceNumber_in).toEqual(
      invoiceNumbers
    )
    expect(capturedBody.query).not.toContain('552012345678')
    // Without the source filter the same invoice number also matches payment
    // and credit transaction rows.
    expect(
      capturedBody.variables.filter.headerTransactionSourceDbId_in
    ).toEqual(expect.arrayContaining([600, 797, 3536]))
  })

  it('splits many invoice numbers into several requests', async () => {
    const requests: string[][] = []
    nock(origin)
      .post(pathname, (body) => {
        requests.push(body.variables.filter.invoiceNumber_in)
        return true
      })
      .times(3)
      .reply(200, { data: { arTransactions: { edges: [] } } })

    const invoiceNumbers = Array.from({ length: 120 }, (_, i) => String(i))
    await adapter.getInvoicesByInvoiceNumbers(invoiceNumbers)

    expect(requests.flat()).toEqual(invoiceNumbers)
    expect(requests.every((chunk) => chunk.length <= 50)).toBe(true)
  })
})

describe(adapter.getMiscellaneousInvoices, () => {
  it('returns transformed invoices and pageInfo on success', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          salesOrders: {
            edges: [
              {
                cursor: 'cursor-1',
                node: {
                  invoiceDate: '2023-02-15T00:00:00.000Z',
                  invoiceNumber: '552303315030452',
                  ourRef: { name: 'Jane Doe' },
                  subledger: { code: 'P123456' },
                  invoiceAmount: 500,
                  headerInfo:
                    '705-025-03-0205/01: Skadedjursbekämpning: Råttor',
                  invoiceFile: { url: 'https://xledger.example.com/files/1' },
                  invoiceBaseItems: {
                    edges: [
                      {
                        node: {
                          text: 'Skadedjursbekämpning',
                          amount: 500,
                          quantity: 1,
                          unitPrice: 500,
                          glObject1: { code: '12345' },
                        },
                      },
                    ],
                  },
                },
              },
            ],
            pageInfo: { hasNextPage: true },
          },
        },
      })

    const result = await adapter.getMiscellaneousInvoices({})

    expect(result).toEqual({
      ok: true,
      data: {
        content: [
          {
            invoiceId: '552303315030452',
            amount: 500,
            invoiceBaseItems: [
              {
                text: 'Skadedjursbekämpning',
                amount: 500,
                quantity: 1,
                unitPrice: 500,
                costCentre: '12345',
              },
            ],
            invoiceDate: new Date('2023-02-15T00:00:00.000Z'),
            reference: 'P123456',
            ourReference: 'Jane Doe',
            description: '705-025-03-0205/01: Skadedjursbekämpning: Råttor',
            invoiceFileUrl: 'https://xledger.example.com/files/1',
          },
        ],
        pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
      },
    })
  })

  it('returns unknown when Xledger returns no edges', async () => {
    nock(origin).post(pathname).reply(200, { data: {} })

    const result = await adapter.getMiscellaneousInvoices({})

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns unknown on request failure', async () => {
    nock(origin).post(pathname).reply(500)

    const result = await adapter.getMiscellaneousInvoices({})

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})
