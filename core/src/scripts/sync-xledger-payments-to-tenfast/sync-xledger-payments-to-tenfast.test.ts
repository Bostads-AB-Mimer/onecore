import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import nock from 'nock'
import config from '../../common/config'
import {
  syncPayments,
  notifySyncFailure,
  fileCursorStore,
} from './sync-xledger-payments-to-tenfast'

const ECONOMY_URL = config.economyService.url
const COMM_URL = config.communicationService.url

const makeStore = (initial: string | null = null) => {
  let cursor = initial
  const saves: string[] = []
  return {
    read: async () => cursor,
    save: async (c: string) => {
      cursor = c
      saves.push(c)
    },
    get cursor() {
      return cursor
    },
    saves,
  }
}

const makePaymentEvent = (
  overrides?: Partial<{
    invoiceId: string
    amount: number
    paymentDate: string
    transactionSourceCode: string
    matchId: number
    type: string
    text: string | null
    slTransactionType: string | null
    cursor: string
  }>
) => ({
  type: 'OCR',
  invoiceId: '55123456',
  matchId: 1,
  amount: -1000,
  paymentDate: '2026-04-01T00:00:00.000Z',
  text: 'Hyra',
  transactionSourceCode: 'OCR',
  slTransactionType: null,
  cursor: 'cursor-new',
  ...overrides,
})

const makePaymentsResponse = (
  overrides?: Partial<{ events: object[]; lastCursor: string | null }>
) => ({
  content: {
    events: [makePaymentEvent()],
    lastCursor: 'cursor-new',
    ...overrides,
  },
})

afterEach(nock.cleanAll)

describe('syncPayments', () => {
  describe('bootstrap (no saved cursor)', () => {
    it('fetches the latest cursor from Xledger, saves it, and exits without processing payments', async () => {
      const store = makeStore()

      nock(ECONOMY_URL)
        .get('/payments/latest-cursor')
        .reply(200, { content: 'cursor-seed' })

      await syncPayments(store)

      expect(store.cursor).toBe('cursor-seed')
      expect(nock.pendingMocks()).toHaveLength(0)
    })

    it('throws when the latest cursor fetch fails', async () => {
      nock(ECONOMY_URL).get('/payments/latest-cursor').reply(500)

      await expect(syncPayments(makeStore())).rejects.toThrow(
        'Failed to fetch latest cursor from Xledger'
      )
    })

    it('throws when Xledger returns a null cursor', async () => {
      nock(ECONOMY_URL)
        .get('/payments/latest-cursor')
        .reply(200, { content: null })

      await expect(syncPayments(makeStore())).rejects.toThrow(
        'No cursor found in Xledger'
      )
    })
  })

  describe('normal run (cursor exists)', () => {
    it('records payments in Tenfast and advances the cursor', async () => {
      const store = makeStore('cursor-start')
      let postedPaymentBody: unknown

      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(200, makePaymentsResponse())

      nock(ECONOMY_URL)
        .post('/invoices/55123456/payments', (body) => {
          postedPaymentBody = body
          return true
        })
        .reply(200, { content: null })

      await syncPayments(store)

      expect(postedPaymentBody).toMatchObject({
        amount: -1000,
        method: 'OCR',
      })
      expect(store.cursor).toBe('cursor-new')
    })

    it('does not advance the cursor when there are no new payments and no new cursor', async () => {
      const store = makeStore('cursor-start')

      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(200, makePaymentsResponse({ events: [], lastCursor: null }))

      await syncPayments(store)

      expect(store.cursor).toBe('cursor-start')
    })

    it('advances the cursor when events are empty but Xledger returns a new cursor', async () => {
      const store = makeStore('cursor-start')

      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(
          200,
          makePaymentsResponse({ events: [], lastCursor: 'cursor-new' })
        )

      await syncPayments(store)

      expect(store.cursor).toBe('cursor-new')
    })

    it('skips an invoice not found in Tenfast and still advances the cursor', async () => {
      const store = makeStore('cursor-start')

      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(200, makePaymentsResponse())

      nock(ECONOMY_URL).post('/invoices/55123456/payments').reply(404, {})

      await syncPayments(store)

      expect(store.cursor).toBe('cursor-new')
    })

    it('skips later payments for an invoice not found in Tenfast without asking again', async () => {
      const store = makeStore('cursor-start')

      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(
          200,
          makePaymentsResponse({
            events: [
              makePaymentEvent({ matchId: 1, amount: 500, cursor: 'c1' }),
              makePaymentEvent({ matchId: 2, amount: 500, cursor: 'c2' }),
            ],
            lastCursor: 'c2',
          })
        )

      // Only one Tenfast call expected — second event is skipped after not-found
      nock(ECONOMY_URL).post('/invoices/55123456/payments').reply(404, {})

      await syncPayments(store)

      expect(nock.pendingMocks()).toHaveLength(0)
      expect(store.cursor).toBe('c2')
    })

    it('records payments in Xledger order and saves the cursor after each one', async () => {
      const store = makeStore('cursor-start')
      const posted: string[] = []

      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(
          200,
          makePaymentsResponse({
            events: [
              makePaymentEvent({ invoiceId: 'INV-1', cursor: 'c1' }),
              makePaymentEvent({ invoiceId: 'INV-2', cursor: 'c2' }),
              makePaymentEvent({ invoiceId: 'INV-1', cursor: 'c3' }),
            ],
            lastCursor: 'c3',
          })
        )

      nock(ECONOMY_URL)
        .post(/\/invoices\/INV-\d\/payments/)
        .times(3)
        .reply(200, (uri) => {
          posted.push(uri)
          return { content: null }
        })

      await syncPayments(store)

      expect(posted).toEqual([
        '/invoices/INV-1/payments',
        '/invoices/INV-2/payments',
        '/invoices/INV-1/payments',
      ])
      expect(store.saves).toEqual(['c1', 'c2', 'c3', 'c3'])
    })

    it('saves the last cursor Xledger returned after the last payment', async () => {
      const store = makeStore('cursor-start')

      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(
          200,
          makePaymentsResponse({
            events: [makePaymentEvent({ cursor: 'c1' })],
            // A trailing row without an invoice reference was dropped
            lastCursor: 'c2',
          })
        )

      nock(ECONOMY_URL)
        .post('/invoices/55123456/payments')
        .reply(200, { content: null })

      await syncPayments(store)

      expect(store.cursor).toBe('c2')
    })

    it('keeps the cursor on the last recorded payment when a later one fails, and resumes from there', async () => {
      const store = makeStore('cursor-start')

      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(
          200,
          makePaymentsResponse({
            events: [
              makePaymentEvent({ invoiceId: 'INV-1', cursor: 'c1' }),
              makePaymentEvent({ invoiceId: 'INV-2', cursor: 'c2' }),
            ],
            lastCursor: 'c2',
          })
        )
      nock(ECONOMY_URL)
        .post('/invoices/INV-1/payments')
        .reply(200, { content: null })
      nock(ECONOMY_URL).post('/invoices/INV-2/payments').reply(500, {})

      await expect(syncPayments(store)).rejects.toThrow(
        'Failed to record payment for invoice INV-2 in Tenfast'
      )
      expect(store.cursor).toBe('c1')

      // Next run starts after INV-1, so INV-1 is not posted again
      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'c1' })
        .reply(
          200,
          makePaymentsResponse({
            events: [makePaymentEvent({ invoiceId: 'INV-2', cursor: 'c2' })],
            lastCursor: 'c2',
          })
        )
      nock(ECONOMY_URL)
        .post('/invoices/INV-2/payments')
        .reply(200, { content: null })

      await syncPayments(store)

      expect(nock.pendingMocks()).toHaveLength(0)
      expect(store.cursor).toBe('c2')
    })

    it('throws and does not advance the cursor when Tenfast returns an error', async () => {
      const store = makeStore('cursor-start')

      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(200, makePaymentsResponse())

      nock(ECONOMY_URL).post('/invoices/55123456/payments').reply(500, {})

      await expect(syncPayments(store)).rejects.toThrow(
        'Failed to record payment for invoice 55123456 in Tenfast'
      )

      expect(store.cursor).toBe('cursor-start')
    })

    it('throws when Xledger returns payments but no cursor', async () => {
      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(200, makePaymentsResponse({ lastCursor: null }))

      await expect(syncPayments(makeStore('cursor-start'))).rejects.toThrow(
        'Xledger returned payments but no cursor'
      )
    })

    it('throws when fetching payments from Xledger fails', async () => {
      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(500)

      await expect(syncPayments(makeStore('cursor-start'))).rejects.toThrow(
        'Failed to fetch payments from Xledger'
      )
    })

    it('records multiple payments for different invoices', async () => {
      const store = makeStore('cursor-start')

      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(
          200,
          makePaymentsResponse({
            events: [
              makePaymentEvent({ invoiceId: 'INV-1', amount: 100 }),
              makePaymentEvent({ invoiceId: 'INV-2', amount: 200 }),
            ],
          })
        )

      nock(ECONOMY_URL)
        .post('/invoices/INV-1/payments')
        .reply(200, { content: null })
      nock(ECONOMY_URL)
        .post('/invoices/INV-2/payments')
        .reply(200, { content: null })

      await syncPayments(store)

      expect(nock.pendingMocks()).toHaveLength(0)
    })
  })
})

describe('fileCursorStore', () => {
  const originalDataDir = process.env.DATA_DIR
  let dataDir: string

  beforeEach(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xledger-cursor-'))
    process.env.DATA_DIR = dataDir
  })

  afterEach(async () => {
    process.env.DATA_DIR = originalDataDir
    await fs.rm(dataDir, { recursive: true, force: true })
  })

  it('returns null when no cursor has been saved', async () => {
    expect(await fileCursorStore.read()).toBeNull()
  })

  it('reads back the latest saved cursor and leaves no temp file behind', async () => {
    await fileCursorStore.save('c1')
    await fileCursorStore.save('c2')

    expect(await fileCursorStore.read()).toBe('c2')
    expect(await fs.readdir(dataDir)).toEqual(['last-xledger-payment-sync.txt'])
  })
})

describe('notifySyncFailure', () => {
  const originalEconomy = config.emailAddresses.economy

  afterEach(() => {
    config.emailAddresses.economy = originalEconomy
  })

  it('sends an email to the economy address on failure', async () => {
    config.emailAddresses.economy = 'economy@example.com'

    const emailScope = nock(COMM_URL).post('/send-email').reply(200, {})

    await notifySyncFailure(new Error('something went wrong'))

    expect(emailScope.isDone()).toBe(true)
  })

  it('includes the error message in the email body', async () => {
    config.emailAddresses.economy = 'economy@example.com'

    let capturedBody = ''
    nock(COMM_URL)
      .post('/send-email', (body) => {
        capturedBody = JSON.stringify(body)
        return true
      })
      .reply(200, {})

    await notifySyncFailure(new Error('tenfast exploded'))

    expect(capturedBody).toContain('tenfast exploded')
  })

  it('skips sending email when economy address is not configured', async () => {
    config.emailAddresses.economy = ''

    await expect(notifySyncFailure(new Error('oops'))).resolves.toBeUndefined()
  })

  it('does not throw when the email call returns a non-200 response', async () => {
    config.emailAddresses.economy = 'economy@example.com'

    nock(COMM_URL).post('/send-email').reply(500, {})

    await expect(
      notifySyncFailure(new Error('sync error'))
    ).resolves.toBeUndefined()
  })
})
