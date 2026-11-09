import { db } from '../../../common/db'
import {
  cancelScheduledRecipients,
  logOutboundDispatch,
  updateDispatchSendAt,
} from '../../communication-log-service/adapters/db'
import { ProviderResponseError } from '../../infobip-service/adapters/provider-error'
import {
  claimDueRecipients,
  expireStaleRecipients,
  failExhaustedRecipients,
  markRecipientsSent,
  MAX_ATTEMPTS_EXCEEDED_ERROR,
  releaseRecipients,
  SCHEDULE_EXPIRED_ERROR,
} from '../adapters/db'
import { runTick, WorkerSettings } from '../worker'

jest.mock('@onecore/utilities', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}))

/**
 * Runs the worker's claim/settle SQL against the real test database (the
 * worker unit tests mock it). Uses the shared pool and deletes what it
 * creates, like guides-service/tests/images-concurrency.test.ts.
 */
const createdDispatchIds: string[] = []

afterEach(async () => {
  if (createdDispatchIds.length > 0) {
    await db('dispatch').whereIn('id', createdDispatchIds).delete()
    createdDispatchIds.length = 0
  }
})

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000)

async function scheduledDispatch(sendAt: Date, addresses: string[]) {
  const { dispatchId } = await logOutboundDispatch({
    channel: 'sms',
    fromAddress: 'Mimer',
    body: 'Hej!',
    messageType: 'bulk_sms',
    provider: 'tele2',
    sendAt,
    recipients: addresses.map((toAddress) => ({
      toAddress,
      status: 'scheduled',
    })),
  })
  createdDispatchIds.push(dispatchId)
  return dispatchId
}

const recipientsOf = (dispatchId: string) =>
  db('message_recipient')
    .where('dispatchId', dispatchId)
    .orderBy('toAddress')
    .select(
      'id',
      'toAddress',
      'status',
      'attempts',
      'externalMessageId',
      'error'
    )

const claimParams = (
  overrides: Partial<Parameters<typeof claimDueRecipients>[0]> = {}
) => ({
  batchSize: 100,
  now: new Date(),
  cutoff: minutesAgo(180),
  claimedUntil: new Date(Date.now() + 5 * 60 * 1000),
  maxAttempts: 2,
  ...overrides,
})

describe('claimDueRecipients', () => {
  it('claims due scheduled rows once, bumping attempts, and skips rows under a live claim', async () => {
    const dispatchId = await scheduledDispatch(minutesAgo(1), [
      '4670a',
      '4670b',
    ])
    await scheduledDispatch(new Date(Date.now() + 60 * 60 * 1000), ['4670z'])

    const claimed = await claimDueRecipients(claimParams())

    expect(claimed.map((r) => r.toAddress).sort()).toEqual(['4670a', '4670b'])
    expect(claimed.every((r) => r.dispatchId === dispatchId)).toBe(true)
    expect(claimed.every((r) => r.attempts === 1)).toBe(true)

    const rows = await recipientsOf(dispatchId)
    expect(rows.map((r) => r.status)).toEqual(['sending', 'sending'])

    // Live claim: a second worker gets nothing.
    expect(await claimDueRecipients(claimParams())).toEqual([])
  })

  it('re-claims a sending row whose claim has lapsed', async () => {
    const dispatchId = await scheduledDispatch(minutesAgo(1), ['4670a'])
    await claimDueRecipients(claimParams({ claimedUntil: minutesAgo(1) }))

    const reclaimed = await claimDueRecipients(claimParams())

    expect(reclaimed).toHaveLength(1)
    expect(reclaimed[0]).toMatchObject({ dispatchId, attempts: 2 })
  })

  it('leaves stale rows (slot older than the cutoff) for expiry', async () => {
    await scheduledDispatch(minutesAgo(200), ['4670a'])

    expect(await claimDueRecipients(claimParams())).toEqual([])
  })

  it('honours the batch size', async () => {
    await scheduledDispatch(minutesAgo(1), ['4670a', '4670b', '4670c'])

    expect(
      await claimDueRecipients(claimParams({ batchSize: 2 }))
    ).toHaveLength(2)
    expect(
      await claimDueRecipients(claimParams({ batchSize: 2 }))
    ).toHaveLength(1)
  })

  it('never claims a row that has used up maxAttempts', async () => {
    const dispatchId = await scheduledDispatch(minutesAgo(1), ['4670a'])
    await db('message_recipient')
      .where('dispatchId', dispatchId)
      .update({ attempts: 2 })

    expect(await claimDueRecipients(claimParams({ maxAttempts: 2 }))).toEqual(
      []
    )
    expect(
      await claimDueRecipients(claimParams({ maxAttempts: 3 }))
    ).toHaveLength(1)
  })
})

describe('markRecipientsSent / releaseRecipients', () => {
  it('settles only rows whose attempts fence still matches', async () => {
    const dispatchId = await scheduledDispatch(minutesAgo(1), [
      '4670a',
      '4670b',
    ])
    const [a, b] = await claimDueRecipients(claimParams())

    const sent = await markRecipientsSent(
      [
        { id: a.id, attempts: a.attempts, externalMessageId: 'mid-a' },
        // Stale fence: another worker re-claimed this row in the meantime.
        { id: b.id, attempts: b.attempts + 1, externalMessageId: 'mid-b' },
      ],
      new Date()
    )
    expect(sent.updatedCount).toBe(1)

    const rows = await recipientsOf(dispatchId)
    expect(rows.find((r) => r.id === a.id)).toMatchObject({
      status: 'sent',
      externalMessageId: 'mid-a',
    })
    expect(rows.find((r) => r.id === b.id)).toMatchObject({
      status: 'sending',
      externalMessageId: null,
    })

    const released = await releaseRecipients(
      [{ id: b.id, attempts: b.attempts }],
      new Date()
    )
    expect(released.updatedCount).toBe(1)
    expect(
      (await recipientsOf(dispatchId)).find((r) => r.id === b.id)
    ).toMatchObject({ status: 'scheduled', attempts: 1 })
  })

  it('refundAttempt takes the claim attempt back (shutdown before sending)', async () => {
    const dispatchId = await scheduledDispatch(minutesAgo(1), ['4670a'])
    const [a] = await claimDueRecipients(claimParams())
    expect(a.attempts).toBe(1)

    await releaseRecipients([{ id: a.id, attempts: a.attempts }], new Date(), {
      refundAttempt: true,
    })

    expect((await recipientsOf(dispatchId))[0]).toMatchObject({
      status: 'scheduled',
      attempts: 0,
    })
  })
})

describe('failExhaustedRecipients', () => {
  it('fails capped scheduled rows and capped lapsed claims, not live claims or rows under the cap', async () => {
    const capped = await scheduledDispatch(minutesAgo(1), ['4670a', '4670b'])
    const [a, b] = await recipientsOf(capped)
    // 4670a: released after its 2nd refusal -> failed.
    await db('message_recipient').where('id', a.id).update({ attempts: 2 })
    // 4670b: 2nd attempt timed out, claim lapsed -> failed.
    await db('message_recipient')
      .where('id', b.id)
      .update({ attempts: 2, status: 'sending', claimedUntil: minutesAgo(1) })
    // 2nd attempt in flight right now: must be left to settle itself.
    const live = await scheduledDispatch(minutesAgo(1), ['4670c'])
    await db('message_recipient')
      .where('dispatchId', live)
      .update({
        attempts: 2,
        status: 'sending',
        claimedUntil: new Date(Date.now() + 60_000),
      })
    // Under the cap: still retryable.
    const retryable = await scheduledDispatch(minutesAgo(1), ['4670d'])
    await db('message_recipient')
      .where('dispatchId', retryable)
      .update({ attempts: 1 })

    const failed = await failExhaustedRecipients({
      maxAttempts: 2,
      now: new Date(),
    })

    expect(failed.ids).toHaveLength(2)
    expect(failed.dispatchIds).toEqual([capped])
    expect(
      (await recipientsOf(capped)).map((r) => [r.status, r.error])
    ).toEqual([
      ['failed', MAX_ATTEMPTS_EXCEEDED_ERROR],
      ['failed', MAX_ATTEMPTS_EXCEEDED_ERROR],
    ])
    expect((await recipientsOf(live))[0].status).toBe('sending')
    expect((await recipientsOf(retryable))[0].status).toBe('scheduled')
  })
})

describe('runTick against the real claim SQL (resend guard)', () => {
  const settings: WorkerSettings = {
    rules: {
      enabled: true,
      blockedFrom: '21:00',
      blockedUntil: '07:00',
      maxDaysAhead: 30,
    },
    stalenessHours: 3,
    batchSize: 500,
    claimMinutes: 5,
    providerTimeoutMs: 1000,
    maxAttempts: 2,
  }

  it('a full batch the provider keeps refusing is sent at most maxAttempts times, then failed', async () => {
    const addresses = Array.from(
      { length: 500 },
      (_, i) => `4670${String(i).padStart(7, '0')}`
    )
    const dispatchId = await scheduledDispatch(minutesAgo(5), addresses)
    // A 504 after the provider accepted looks exactly like this to the worker.
    const send = jest
      .fn()
      .mockRejectedValue(
        new ProviderResponseError('infobip-sms', 504, 'Gateway Timeout')
      )
    // Brake so a regression fails the test instead of hanging it.
    const isStopping = () => send.mock.calls.length >= 10
    const tick = () =>
      runTick(settings, { send, now: () => new Date(), isStopping })

    await tick()
    expect(send).toHaveBeenCalledTimes(1) // breaker: no resend in the same tick

    await tick()
    expect(send).toHaveBeenCalledTimes(2) // the one retry

    const third = await tick()
    expect(send).toHaveBeenCalledTimes(2) // cap: never a third copy
    expect(third.exhausted).toBe(500)
    const rows = await recipientsOf(dispatchId)
    expect(
      rows.every(
        (r) => r.status === 'failed' && r.error === MAX_ATTEMPTS_EXCEEDED_ERROR
      )
    ).toBe(true)
  })
})

describe('expireStaleRecipients', () => {
  it('fails scheduled rows and lapsed sending rows past the cutoff, not live claims or fresh slots', async () => {
    const stale = await scheduledDispatch(minutesAgo(200), ['4670a', '4670b'])
    const fresh = await scheduledDispatch(minutesAgo(1), ['4670c'])
    // 4670b: claimed by a worker that died (claim lapsed) -> expired.
    // 4670a: stays scheduled -> expired.
    const staleRows = await recipientsOf(stale)
    await db('message_recipient')
      .where('id', staleRows[1].id)
      .update({ status: 'sending', claimedUntil: minutesAgo(1) })
    const liveClaim = await scheduledDispatch(minutesAgo(200), ['4670d'])
    await db('message_recipient')
      .where('dispatchId', liveClaim)
      .update({
        status: 'sending',
        claimedUntil: new Date(Date.now() + 60_000),
      })

    const expired = await expireStaleRecipients({
      cutoff: minutesAgo(180),
      now: new Date(),
    })

    expect(expired.ids).toHaveLength(2)
    expect(expired.dispatchIds).toEqual([stale])
    expect((await recipientsOf(stale)).map((r) => [r.status, r.error])).toEqual(
      [
        ['failed', SCHEDULE_EXPIRED_ERROR],
        ['failed', SCHEDULE_EXPIRED_ERROR],
      ]
    )
    expect((await recipientsOf(fresh))[0].status).toBe('scheduled')
    expect((await recipientsOf(liveClaim))[0].status).toBe('sending')
  })
})

describe('cancel / reschedule against the claim', () => {
  it('updateDispatchSendAt only moves a dispatch nobody has claimed', async () => {
    const dispatchId = await scheduledDispatch(minutesAgo(1), [
      '4670a',
      '4670b',
    ])
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000)

    expect(await updateDispatchSendAt(dispatchId, later)).toEqual({
      updatedCount: 1,
    })

    await db('dispatch')
      .where('id', dispatchId)
      .update({ sendAt: minutesAgo(1) })
    await claimDueRecipients(claimParams({ batchSize: 1 }))

    expect(await updateDispatchSendAt(dispatchId, later)).toEqual({
      updatedCount: 0,
    })
  })

  it('cancelScheduledRecipients cancels only rows the worker has not taken', async () => {
    const dispatchId = await scheduledDispatch(minutesAgo(1), [
      '4670a',
      '4670b',
    ])
    await claimDueRecipients(claimParams({ batchSize: 1 }))

    expect(await cancelScheduledRecipients(dispatchId)).toEqual({
      updatedCount: 1,
    })
    expect(
      (await recipientsOf(dispatchId)).map((r) => r.status).sort()
    ).toEqual(['cancelled', 'sending'])
  })
})
