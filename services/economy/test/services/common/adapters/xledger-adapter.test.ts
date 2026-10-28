import nock from 'nock'

import * as adapter from '@src/services/common/adapters/xledger-adapter'
import config from '@src/common/config'
import { schemas } from '@onecore/types'

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
    expect(() =>
      schemas.v1.InvoiceSchema.array().parse(
        result?.map((parsed) => parsed.invoice)
      )
    ).not.toThrow()
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
      expect.objectContaining({
        invoice: expect.objectContaining({
          credit: { originalInvoiceId: '123456' },
        }),
      }),
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
      expect.objectContaining({
        invoice: expect.objectContaining({
          credit: { originalInvoiceId: '12345' },
        }),
      }),
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

describe(adapter.getPaymentsSince, () => {
  const makeArTransactionEdge = (overrides?: {
    sourceCode?: string
    postedDate?: string
    cursor?: string
    invoiceNumber?: string | null
    extIdentifier?: string | null
    amount?: string
  }) => {
    const sourceCode = overrides?.sourceCode ?? 'OCR'
    return {
      cursor: overrides?.cursor ?? 'cursor-1',
      node: {
        matchId: 42,
        invoiceNumber:
          overrides?.invoiceNumber !== undefined
            ? overrides.invoiceNumber
            : '55123456',
        extIdentifier:
          overrides?.extIdentifier !== undefined
            ? overrides.extIdentifier
            : '55123456',
        amount: overrides?.amount ?? '-1000.00',
        text: 'Hyra',
        paymentDate: '2026-04-01',
        lastPaymentDate: '2026-04-01',
        invoiceAmount: '1000.00',
        invoiceRemaining: '0.00',
        transactionHeader: {
          transactionNumber: 1001,
          postedDate: overrides?.postedDate ?? '2026-04-02',
          transactionSource: {
            dbId: 5205,
            code: sourceCode,
            description: 'OCR',
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

    const result = await adapter.getPaymentsSince('some-cursor')
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

    const result = await adapter.getPaymentsSince('some-cursor')

    expect(result.lastCursor).toBe('cursor-42')
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({
      invoiceId: '55123456',
      matchId: 42,
      amount: -1000,
      paymentDate: new Date('2026-04-02'),
      transactionSourceCode: 'OCR',
    })
    expect(() =>
      schemas.v1.InvoicePaymentEventSchema.array().parse(result.events)
    ).not.toThrow()
  })

  it('uses extIdentifier as invoiceId for OCR payments', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              makeArTransactionEdge({
                sourceCode: 'OCR',
                invoiceNumber: 'WRONG',
                extIdentifier: 'CORRECT-EXT',
              }),
            ],
            pageInfo: { hasNextPage: false },
          },
        },
      })

    const result = await adapter.getPaymentsSince('some-cursor')

    expect(result.events[0].invoiceId).toBe('CORRECT-EXT')
  })

  it('uses invoiceNumber as invoiceId for BAA payments', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              makeArTransactionEdge({
                sourceCode: 'BAA',
                invoiceNumber: 'BAA-INV',
                extIdentifier: 'BAA-EXT',
              }),
            ],
            pageInfo: { hasNextPage: false },
          },
        },
      })

    const result = await adapter.getPaymentsSince('some-cursor')

    expect(result.events[0].invoiceId).toBe('BAA-INV')
  })

  it('skips BA payments with no invoice reference', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [
              makeArTransactionEdge({
                sourceCode: 'BA',
                invoiceNumber: null,
                extIdentifier: null,
              }),
              makeArTransactionEdge({ sourceCode: 'OCR' }),
            ],
            pageInfo: { hasNextPage: false },
          },
        },
      })

    const result = await adapter.getPaymentsSince('some-cursor')

    expect(result.events).toHaveLength(1)
    expect(result.events[0].transactionSourceCode).toBe('OCR')
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

    const result = await adapter.getPaymentsSince('some-cursor')

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

    const result = await adapter.getPaymentsSince('some-cursor')

    expect(result.events[0].paymentDate).toEqual(new Date('2026-04-01'))
  })

  it('sends cursor as after variable', async () => {
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
  })
})

describe(adapter.getLatestPaymentCursor, () => {
  it('returns the cursor of the latest payment transaction', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [{ cursor: 'latest-cursor-123' }],
          },
        },
      })

    const result = await adapter.getLatestPaymentCursor()
    expect(result).toBe('latest-cursor-123')
  })

  it('returns null when there are no payment transactions', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, {
        data: {
          arTransactions: {
            edges: [],
          },
        },
      })

    const result = await adapter.getLatestPaymentCursor()
    expect(result).toBeNull()
  })
})

const minimalInvoiceNode = (text: string | null = null) => ({
  invoiceNumber: '55123456',
  invoiceRemaining: '0',
  invoiceAmount: '1000',
  dueDate: '2026-01-01',
  amount: '1000',
  invoiceDate: '2026-01-01',
  text,
  matchId: 42,
  headerTransactionSourceDbId: 797,
  paymentReference: null,
  subledger: { code: 'P12345', description: '' },
  period: { fromDate: '2026-01-01', toDate: '2026-01-31' },
  account: null,
  slTransactionType: null,
  invoiceFile: null,
  glDimension: null,
})

describe(adapter.updateInvoiceDeferralDate, () => {
  const invoiceNumber = '55123456'
  const newDueDate = new Date('2026-06-30')
  const dueDateString = '2026-06-30'

  const mockDbIdResponse = {
    data: {
      arTransactions: {
        edges: [{ node: { dbId: 298929893 } }],
      },
    },
  }

  const mockInvoiceResponse = (text: string | null) => ({
    data: {
      arTransactions: {
        edges: [{ node: minimalInvoiceNode(text) }],
      },
    },
  })

  const mutationReply = {
    data: {
      updateArTransactions: { edges: [{ node: { dbId: 298929893 } }] },
    },
  }

  it('sends "Anstånd till YYYY-MM-DD" as text variable when invoice has no existing text', async () => {
    let mutationBody: any
    nock(origin).post(pathname).reply(200, mockDbIdResponse)
    nock(origin).post(pathname).reply(200, mockInvoiceResponse(null))
    nock(origin)
      .post(pathname, (body) => {
        mutationBody = body
        return true
      })
      .reply(200, mutationReply)

    await adapter.updateInvoiceDeferralDate(invoiceNumber, newDueDate)

    expect(mutationBody.variables.text).toBe(`Anstånd till ${dueDateString}`)
  })

  it('appends deferral with comma when invoice already has other text', async () => {
    let mutationBody: any
    nock(origin).post(pathname).reply(200, mockDbIdResponse)
    nock(origin)
      .post(pathname)
      .reply(200, mockInvoiceResponse('Hyra för januari'))
    nock(origin)
      .post(pathname, (body) => {
        mutationBody = body
        return true
      })
      .reply(200, mutationReply)

    await adapter.updateInvoiceDeferralDate(invoiceNumber, newDueDate)

    expect(mutationBody.variables.text).toBe(
      `Hyra för januari, Anstånd till ${dueDateString}`
    )
  })

  it('replaces existing Anstånd segment instead of appending a second one', async () => {
    let mutationBody: any
    nock(origin).post(pathname).reply(200, mockDbIdResponse)
    nock(origin)
      .post(pathname)
      .reply(200, mockInvoiceResponse('Anstånd till 2026-01-31'))
    nock(origin)
      .post(pathname, (body) => {
        mutationBody = body
        return true
      })
      .reply(200, mutationReply)

    await adapter.updateInvoiceDeferralDate(invoiceNumber, newDueDate)

    expect(mutationBody.variables.text).toBe(`Anstånd till ${dueDateString}`)
  })

  it('sends dueDate as a variable in the mutation', async () => {
    let mutationBody: any
    nock(origin).post(pathname).reply(200, mockDbIdResponse)
    nock(origin).post(pathname).reply(200, mockInvoiceResponse(null))
    nock(origin)
      .post(pathname, (body) => {
        mutationBody = body
        return true
      })
      .reply(200, mutationReply)

    await adapter.updateInvoiceDeferralDate(invoiceNumber, newDueDate)

    expect(mutationBody.variables.dueDate).toBe(dueDateString)
  })

  it('throws when invoice is not found in Xledger', async () => {
    nock(origin)
      .post(pathname)
      .reply(200, { data: { arTransactions: { edges: [] } } })
    nock(origin)
      .post(pathname)
      .reply(200, { data: { arTransactions: { edges: [] } } })

    await expect(
      adapter.updateInvoiceDeferralDate(invoiceNumber, newDueDate)
    ).rejects.toThrow(invoiceNumber)
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
