// In-process scheduler for scheduled SMS/email (MIM-1838). Ticks on every
// 10-minute slot boundary outside blocked hours, claims due recipients and
// sends them through the provider as immediate sends. Every replica runs
// it; the atomic claim in adapters/db.ts keeps them from colliding.
import { communication } from '@onecore/types'
import { logger } from '@onecore/utilities'

import config from '../../common/config'
import { ProviderResponseError } from '../infobip-service/adapters/provider-error'
import { sendBulkEmail } from '../infobip-service/adapters/email-adapter'
import { sendBulkSms } from '../infobip-service/adapters/sms-adapter'
import {
  ClaimedRecipient,
  claimDueRecipients,
  expireStaleRecipients,
  getDispatchesByIds,
  markRecipientsSent,
  releaseRecipients,
} from './adapters/db'
import {
  getScheduleRules,
  isInBlockedHours,
  nextOpenSlot,
  ScheduleRules,
} from './rules'

export type WorkerSettings = {
  rules: ScheduleRules
  stalenessHours: number
  batchSize: number
  claimMinutes: number
  providerTimeoutMs: number
}

// Both Infobip send responses (SMS v3, email v4) expose messages[i] aligned
// with the destinations array submitted.
export type ProviderSendResponse = { messages?: Array<{ messageId: string }> }

export type SendBatchFn = (
  dispatch: communication.Dispatch,
  toAddresses: string[],
  signal: AbortSignal
) => Promise<ProviderSendResponse>

export type WorkerDeps = {
  send: SendBatchFn
  now: () => Date
  isStopping: () => boolean
}

export type TickSummary = {
  expired: number
  claimed: number
  sent: number
  retried: number // provider refused; back to 'scheduled' for the next tick
  unknown: number // timeout/connection lost; left 'sending' until the claim lapses
  released: number // handed back unsent because the worker was stopping
  durationMs: number
}

const sendViaProvider: SendBatchFn = (dispatch, toAddresses, signal) => {
  switch (dispatch.channel) {
    case 'sms':
      return sendBulkSms({
        phoneNumbers: toAddresses,
        text: dispatch.body,
        signal,
      })
    case 'email':
      // The route requires a subject, so null here is a data error: refuse
      // rather than send an empty subject (rows expire via staleness).
      if (dispatch.subject === null) {
        logger.error(
          { dispatchId: dispatch.id },
          'scheduled email dispatch has no subject; not sending'
        )
        return Promise.reject(new Error('Email dispatch without subject'))
      }
      return sendBulkEmail({
        emails: toAddresses,
        subject: dispatch.subject,
        text: dispatch.body,
        signal,
      })
    default:
      // Only sms/email can be scheduled; anything else is a data error.
      return Promise.reject(
        new Error(
          `Cannot send scheduled dispatch on channel ${dispatch.channel}`
        )
      )
  }
}

const defaultDeps: WorkerDeps = {
  send: sendViaProvider,
  now: () => new Date(),
  isStopping: () => false,
}

const DB_RETRY_ATTEMPTS = 3
const DB_RETRY_DELAY_MS = 250

async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < DB_RETRY_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, DB_RETRY_DELAY_MS))
      }
    }
  }
  throw lastError
}

// Only the fencing keys go back to the DB, not the addresses.
const fences = (batch: ClaimedRecipient[]) =>
  batch.map((r) => ({ id: r.id, attempts: r.attempts }))

// One provider call for one dispatch's claimed rows, then settle their status.
async function sendBatch(
  dispatch: communication.Dispatch,
  batch: ClaimedRecipient[],
  settings: WorkerSettings,
  deps: WorkerDeps
): Promise<'sent' | 'retried' | 'unknown'> {
  const logFields = {
    dispatchId: dispatch.id,
    channel: dispatch.channel,
    recipientCount: batch.length,
    attempt: Math.max(...batch.map((r) => r.attempts)),
  }

  let result: ProviderSendResponse
  try {
    result = await deps.send(
      dispatch,
      batch.map((r) => r.toAddress),
      AbortSignal.timeout(settings.providerTimeoutMs)
    )
  } catch (err: unknown) {
    if (err instanceof ProviderResponseError) {
      logger.warn(
        { ...logFields, status: err.status },
        'provider refused scheduled batch; retrying next tick'
      )
      try {
        await releaseRecipients(fences(batch), deps.now())
      } catch (releaseError: unknown) {
        // Rows stay 'sending'; the claim lapses and the next tick retries.
        logger.error(
          { ...logFields, err: releaseError },
          'could not release refused batch — claim expiry will retry it'
        )
      }
      return 'retried'
    }
    logger.warn(
      { ...logFields, err },
      'scheduled batch outcome unknown (timeout/connection); claim expiry will retry'
    )
    return 'unknown'
  }

  const sentRows = batch.map((r, i) => ({
    id: r.id,
    attempts: r.attempts,
    externalMessageId: result.messages?.[i]?.messageId ?? null,
  }))
  try {
    // Retry a DB blip: a sent batch left 'sending' is resent when the claim lapses.
    await withRetries(() => markRecipientsSent(sentRows, deps.now()))
  } catch (err: unknown) {
    logger.error(
      { ...logFields, err },
      'batch sent but could not be marked sent — claim expiry will resend it'
    )
  }
  return 'sent'
}

/**
 * One tick: expire stale rows, then claim and send due rows in batches until
 * nothing is due or the worker is stopping. Exported for tests; the loop
 * below drives it in production.
 */
export async function runTick(
  settings: WorkerSettings,
  deps: WorkerDeps = defaultDeps
): Promise<TickSummary> {
  const startedAt = Date.now()
  const summary: TickSummary = {
    expired: 0,
    claimed: 0,
    sent: 0,
    retried: 0,
    unknown: 0,
    released: 0,
    durationMs: 0,
  }
  const now = deps.now()
  const cutoff = new Date(now.getTime() - settings.stalenessHours * 3600_000)

  const expired = await expireStaleRecipients({ cutoff, now })
  summary.expired = expired.ids.length
  if (expired.ids.length > 0) {
    logger.error(
      {
        dispatchIds: expired.dispatchIds,
        recipientCount: expired.ids.length,
        stalenessHours: settings.stalenessHours,
      },
      'scheduled recipients expired unsent (SCHEDULE_EXPIRED)'
    )
  }

  while (!deps.isStopping()) {
    const claimNow = deps.now()
    const rows = await claimDueRecipients({
      batchSize: settings.batchSize,
      now: claimNow,
      cutoff,
      claimedUntil: new Date(
        claimNow.getTime() + settings.claimMinutes * 60_000
      ),
    })
    if (rows.length === 0) break
    summary.claimed += rows.length

    const groups = new Map<string, ClaimedRecipient[]>()
    for (const row of rows) {
      const group = groups.get(row.dispatchId) ?? []
      group.push(row)
      groups.set(row.dispatchId, group)
    }
    const dispatches = new Map(
      (await getDispatchesByIds([...groups.keys()])).map((d) => [d.id, d])
    )

    for (const [dispatchId, batch] of groups) {
      const dispatch = dispatches.get(dispatchId)
      // Stopping: hand rows back now so another replica picks them up at the
      // next tick instead of after the claim lapses. A missing dispatch can't
      // happen (FK cascade) but must not strand the rows either.
      if (deps.isStopping() || !dispatch) {
        if (!dispatch) {
          logger.error({ dispatchId }, 'claimed recipients have no dispatch')
        }
        const { updatedCount } = await releaseRecipients(
          fences(batch),
          deps.now()
        )
        summary.released += updatedCount
        continue
      }
      summary[await sendBatch(dispatch, batch, settings, deps)] += batch.length
    }

    // A short batch means nothing else is due right now.
    if (rows.length < settings.batchSize) break
  }

  summary.durationMs = Date.now() - startedAt
  // One summary per tick; an Elasticsearch alert on its absence during open
  // hours catches a silently stopped worker.
  logger.info(summary, 'scheduled-sends tick')
  return summary
}

/**
 * Chained setTimeout (never setInterval) to the next open slot boundary, so a
 * slow tick can't overlap the next one and blocked hours are slept through.
 */
export class ScheduledSendsWorker {
  private timer: ReturnType<typeof setTimeout> | undefined
  private inFlight: Promise<void> | undefined
  private stopping = false

  constructor(
    private readonly settings: WorkerSettings,
    private readonly deps: WorkerDeps = defaultDeps
  ) {}

  start(): void {
    logger.info(
      {
        blockedFrom: this.settings.rules.blockedFrom,
        blockedUntil: this.settings.rules.blockedUntil,
        stalenessHours: this.settings.stalenessHours,
        batchSize: this.settings.batchSize,
      },
      'scheduled-sends worker started'
    )
    this.scheduleNext()
  }

  // SIGTERM: stop claiming, let the in-flight provider call settle, resolve.
  async stop(): Promise<void> {
    this.stopping = true
    if (this.timer) clearTimeout(this.timer)
    await this.inFlight
    logger.info('scheduled-sends worker stopped')
  }

  private scheduleNext(): void {
    if (this.stopping) return
    const now = this.deps.now()
    const next = nextOpenSlot(now, this.settings.rules)
    this.timer = setTimeout(() => this.run(), next.getTime() - now.getTime())
    logger.info(
      { nextTickAt: next.toISOString() },
      'scheduled-sends: next tick'
    )
  }

  private run(): void {
    // Defensive: the timer only targets open slots, but config can change.
    if (isInBlockedHours(this.deps.now(), this.settings.rules)) {
      this.scheduleNext()
      return
    }
    this.inFlight = runTick(this.settings, {
      ...this.deps,
      isStopping: () => this.stopping,
    })
      .then(
        () => undefined,
        (err: unknown) => {
          logger.error({ err }, 'scheduled-sends tick failed')
        }
      )
      .finally(() => {
        this.inFlight = undefined
        this.scheduleNext()
      })
  }
}

export const createScheduledSendsWorker = (): ScheduledSendsWorker =>
  new ScheduledSendsWorker({
    rules: getScheduleRules(),
    stalenessHours: config.scheduledSends.stalenessHours,
    batchSize: config.scheduledSends.batchSize,
    claimMinutes: config.scheduledSends.claimMinutes,
    providerTimeoutMs: config.scheduledSends.providerTimeoutMs,
  })
