import nock from 'nock'
import config from '../../common/config'
import {
  syncPayments,
  notifySyncFailure,
} from './sync-xledger-payments-to-tenfast'

const ECONOMY_URL = config.economyService.url
const COMM_URL = config.communicationService.url

const makeStore = (initial: string | null = null) => {
  let cursor = initial
  return {
    read: async () => cursor,
    save: async (c: string) => {
      cursor = c
    },
    get cursor() {
      return cursor
    },
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
  }>
) => ({
  type: 'OCR',
  invoiceId: '55123456',
  matchId: 1,
  amount: 1000,
  paymentDate: '2026-04-01T00:00:00.000Z',
  text: 'Hyra',
  transactionSourceCode: 'OCR',
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

      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(200, makePaymentsResponse())

      nock(ECONOMY_URL)
        .post('/invoices/55123456/payments')
        .reply(200, { content: null })

      await syncPayments(store)

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

    it('groups multiple events for the same invoice into a single not-found skip', async () => {
      const store = makeStore('cursor-start')

      nock(ECONOMY_URL)
        .get('/payments/since')
        .query({ after: 'cursor-start' })
        .reply(
          200,
          makePaymentsResponse({
            events: [
              makePaymentEvent({ matchId: 1, amount: 500 }),
              makePaymentEvent({ matchId: 2, amount: 500 }),
            ],
          })
        )

      // Only one Tenfast call expected — second event is skipped after not-found
      nock(ECONOMY_URL).post('/invoices/55123456/payments').reply(404, {})

      await syncPayments(store)

      expect(nock.pendingMocks()).toHaveLength(0)
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
