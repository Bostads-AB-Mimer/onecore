import { ProviderResponseError } from '../../infobip-service/adapters/provider-error'
import {
  claimDueRecipients,
  expireStaleRecipients,
  getDispatchesByIds,
  markRecipientsSent,
  releaseRecipients,
} from '../adapters/db'
import { runTick, ScheduledSendsWorker, WorkerSettings } from '../worker'

jest.mock('@onecore/utilities', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('../adapters/db', () => ({
  expireStaleRecipients: jest.fn(),
  claimDueRecipients: jest.fn(),
  getDispatchesByIds: jest.fn(),
  markRecipientsSent: jest.fn(),
  releaseRecipients: jest.fn(),
}))

const expireMock = expireStaleRecipients as jest.Mock
const claimMock = claimDueRecipients as jest.Mock
const getDispatchesMock = getDispatchesByIds as jest.Mock
const markSentMock = markRecipientsSent as jest.Mock
const releaseMock = releaseRecipients as jest.Mock

const settings: WorkerSettings = {
  rules: {
    enabled: true,
    blockedFrom: '21:00',
    blockedUntil: '07:00',
    maxDaysAhead: 30,
  },
  stalenessHours: 3,
  batchSize: 100,
  claimMinutes: 5,
  providerTimeoutMs: 1000,
}

// Tuesday 14:00 local (summer), open hours.
const NOW = new Date('2026-07-14T12:00:00.000Z')

const dispatch = (id: string, channel: 'sms' | 'email' = 'sms') => ({
  id,
  channel,
  subject: channel === 'email' ? 'Ämne' : null,
  body: 'Hej!',
})

const row = (id: string, dispatchId: string, attempts = 1) => ({
  id,
  dispatchId,
  toAddress: `46700000${id}`,
  attempts,
})

const deps = (send: jest.Mock, isStopping = () => false) => ({
  send,
  now: () => NOW,
  isStopping,
})

beforeEach(() => {
  // resetAllMocks, not clearAllMocks: a test's unconsumed mockResolvedValueOnce
  // (the tick stops claiming after a short batch) must not leak into the next.
  jest.resetAllMocks()
  expireMock.mockResolvedValue({ ids: [], dispatchIds: [] })
  claimMock.mockResolvedValue([])
  getDispatchesMock.mockResolvedValue([])
  markSentMock.mockResolvedValue({ updatedCount: 0 })
  releaseMock.mockResolvedValue({ updatedCount: 0 })
})

describe('runTick', () => {
  it('expires stale rows with the staleness cutoff before claiming', async () => {
    expireMock.mockResolvedValue({ ids: ['r1'], dispatchIds: ['d1'] })
    const send = jest.fn()

    const summary = await runTick(settings, deps(send))

    expect(expireMock).toHaveBeenCalledWith({
      cutoff: new Date('2026-07-14T09:00:00.000Z'),
      now: NOW,
    })
    expect(summary.expired).toBe(1)
    expect(send).not.toHaveBeenCalled()
  })

  it('claims with the batch size, claim expiry and the same cutoff', async () => {
    await runTick(settings, deps(jest.fn()))

    expect(claimMock).toHaveBeenCalledWith({
      batchSize: 100,
      now: NOW,
      cutoff: new Date('2026-07-14T09:00:00.000Z'),
      claimedUntil: new Date('2026-07-14T12:05:00.000Z'),
    })
  })

  it('sends one provider call per dispatch and marks the rows sent with provider ids', async () => {
    claimMock.mockResolvedValueOnce([
      row('a', 'd1'),
      row('b', 'd1'),
      row('c', 'd2'),
    ])
    getDispatchesMock.mockResolvedValue([
      dispatch('d1'),
      dispatch('d2', 'email'),
    ])
    const send = jest
      .fn()
      .mockResolvedValueOnce({
        messages: [{ messageId: 'm-a' }, { messageId: 'm-b' }],
      })
      .mockResolvedValueOnce({ messages: [] })

    const summary = await runTick(settings, deps(send))

    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0][0]).toMatchObject({ id: 'd1' })
    expect(send.mock.calls[0][1]).toEqual(['46700000a', '46700000b'])
    expect(send.mock.calls[0][2]).toBeInstanceOf(AbortSignal)
    expect(send.mock.calls[1][0]).toMatchObject({ id: 'd2', channel: 'email' })

    expect(markSentMock).toHaveBeenNthCalledWith(
      1,
      [
        { id: 'a', attempts: 1, externalMessageId: 'm-a' },
        { id: 'b', attempts: 1, externalMessageId: 'm-b' },
      ],
      NOW
    )
    // No message id in the response: stored as null, still 'sent'.
    expect(markSentMock).toHaveBeenNthCalledWith(
      2,
      [{ id: 'c', attempts: 1, externalMessageId: null }],
      NOW
    )
    expect(summary).toMatchObject({
      claimed: 3,
      sent: 3,
      retried: 0,
      unknown: 0,
    })
  })

  it('releases rows back to scheduled when the provider refuses (4xx/5xx)', async () => {
    claimMock.mockResolvedValueOnce([row('a', 'd1', 2)])
    getDispatchesMock.mockResolvedValue([dispatch('d1')])
    const send = jest
      .fn()
      .mockRejectedValue(new ProviderResponseError('infobip-sms', 500, 'down'))

    const summary = await runTick(settings, deps(send))

    expect(releaseMock).toHaveBeenCalledWith([{ id: 'a', attempts: 2 }], NOW)
    expect(markSentMock).not.toHaveBeenCalled()
    expect(summary).toMatchObject({ claimed: 1, sent: 0, retried: 1 })
  })

  it('leaves rows in sending when the outcome is unknown (timeout/connection)', async () => {
    claimMock.mockResolvedValueOnce([row('a', 'd1')])
    getDispatchesMock.mockResolvedValue([dispatch('d1')])
    const send = jest.fn().mockRejectedValue(new Error('fetch failed'))

    const summary = await runTick(settings, deps(send))

    // The claim expiry — not an immediate release — drives the resend, so a
    // message that may have gone out isn't resent within seconds.
    expect(releaseMock).not.toHaveBeenCalled()
    expect(markSentMock).not.toHaveBeenCalled()
    expect(summary).toMatchObject({ claimed: 1, unknown: 1 })
  })

  it('still counts the batch as sent when the sent-mark keeps failing (claim expiry resends)', async () => {
    claimMock.mockResolvedValueOnce([row('a', 'd1')])
    getDispatchesMock.mockResolvedValue([dispatch('d1')])
    markSentMock.mockRejectedValue(new Error('db down'))
    const send = jest.fn().mockResolvedValue({ messages: [{ messageId: 'm' }] })

    const summary = await runTick(settings, deps(send))

    expect(markSentMock).toHaveBeenCalledTimes(3)
    expect(summary.sent).toBe(1)
  })

  it('keeps claiming while full batches come back', async () => {
    const full = Array.from({ length: 100 }, (_, i) => row(`r${i}`, 'd1'))
    claimMock
      .mockResolvedValueOnce(full)
      .mockResolvedValueOnce([row('x', 'd1')])
    getDispatchesMock.mockResolvedValue([dispatch('d1')])
    const send = jest.fn().mockResolvedValue({ messages: [] })

    const summary = await runTick(settings, deps(send))

    expect(claimMock).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenCalledTimes(2)
    expect(summary.claimed).toBe(101)
  })

  it('releases claimed-but-unsent rows and stops claiming when shutting down', async () => {
    claimMock.mockResolvedValueOnce([row('a', 'd1'), row('b', 'd2')])
    getDispatchesMock.mockResolvedValue([dispatch('d1'), dispatch('d2')])
    releaseMock.mockResolvedValue({ updatedCount: 1 })
    let stopping = false
    const send = jest.fn().mockImplementation(async () => {
      stopping = true // SIGTERM arrives during the first provider call
      return { messages: [] }
    })

    const summary = await runTick(
      settings,
      deps(send, () => stopping)
    )

    expect(send).toHaveBeenCalledTimes(1)
    expect(releaseMock).toHaveBeenCalledWith([{ id: 'b', attempts: 1 }], NOW)
    expect(summary).toMatchObject({ sent: 1, released: 1 })
  })
})

describe('ScheduledSendsWorker', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('ticks on the next slot boundary and chains the following one', async () => {
    let now = new Date('2026-07-14T12:03:00.000Z')
    const worker = new ScheduledSendsWorker(settings, {
      send: jest.fn(),
      now: () => now,
      isStopping: () => false,
    })

    worker.start()
    expect(expireMock).not.toHaveBeenCalled()

    now = new Date('2026-07-14T12:10:00.000Z')
    await jest.advanceTimersByTimeAsync(7 * 60 * 1000)
    expect(expireMock).toHaveBeenCalledTimes(1)

    now = new Date('2026-07-14T12:20:00.000Z')
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(expireMock).toHaveBeenCalledTimes(2)

    await worker.stop()
  })

  it('sleeps through blocked hours instead of ticking', async () => {
    // 20:55 local: next open slot is 07:00 local = 05:00Z, ten hours away.
    let now = new Date('2026-07-14T18:55:00.000Z')
    const worker = new ScheduledSendsWorker(settings, {
      send: jest.fn(),
      now: () => now,
      isStopping: () => false,
    })

    worker.start()
    now = new Date('2026-07-14T22:00:00.000Z')
    await jest.advanceTimersByTimeAsync(3 * 60 * 60 * 1000)
    expect(expireMock).not.toHaveBeenCalled()

    now = new Date('2026-07-15T05:00:00.000Z')
    await jest.advanceTimersByTimeAsync(7 * 60 * 60 * 1000 + 5 * 60 * 1000)
    expect(expireMock).toHaveBeenCalledTimes(1)

    await worker.stop()
  })

  it('stop() waits for the in-flight tick and cancels the next one', async () => {
    let now = new Date('2026-07-14T12:09:00.000Z')
    let resolveExpire: (v: {
      ids: string[]
      dispatchIds: string[]
    }) => void = () => undefined
    expireMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExpire = resolve
        })
    )
    const worker = new ScheduledSendsWorker(settings, {
      send: jest.fn(),
      now: () => now,
      isStopping: () => false,
    })

    worker.start()
    now = new Date('2026-07-14T12:10:00.000Z')
    await jest.advanceTimersByTimeAsync(60 * 1000)
    expect(expireMock).toHaveBeenCalledTimes(1)

    let stopped = false
    const stopping = worker.stop().then(() => {
      stopped = true
    })
    await Promise.resolve()
    expect(stopped).toBe(false)

    resolveExpire({ ids: [], dispatchIds: [] })
    await stopping
    expect(stopped).toBe(true)

    // No further ticks after stop.
    now = new Date('2026-07-14T12:20:00.000Z')
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(expireMock).toHaveBeenCalledTimes(1)
  })
})
