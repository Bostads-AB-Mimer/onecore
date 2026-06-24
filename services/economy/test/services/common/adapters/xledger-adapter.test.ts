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
        amount: '1000.00',
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
      amount: 1000,
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
