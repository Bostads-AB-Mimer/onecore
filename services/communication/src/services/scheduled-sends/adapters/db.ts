// Claim/settle queries for the scheduled-sends worker (MIM-1838). Every
// write after a claim is fenced on `attempts`: the claim increments it, so a
// worker that lost its claim (expired, re-claimed elsewhere) matches no rows.
import { communication } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { db } from '../../../common/db'

export type ClaimedRecipient = {
  id: string
  dispatchId: string
  toAddress: string
  attempts: number
}

export type RecipientFence = { id: string; attempts: number }

export const SCHEDULE_EXPIRED_ERROR = 'SCHEDULE_EXPIRED'

/**
 * Mark recipients whose slot is older than `cutoff` as 'failed' instead of
 * sending them: 'scheduled' rows, and 'sending' rows whose claim has lapsed
 * (a live claim is in flight and settles itself). Bounds every retry path.
 */
export async function expireStaleRecipients(params: {
  cutoff: Date
  now: Date
}): Promise<{ ids: string[]; dispatchIds: string[] }> {
  try {
    const rows = await db.raw<{ id: string; dispatchId: string }[]>(
      `
      UPDATE mr
        SET status = 'failed', error = ?, claimedUntil = NULL, statusUpdatedAt = ?
      OUTPUT inserted.id, inserted.dispatchId
      FROM message_recipient mr WITH (UPDLOCK, READPAST, ROWLOCK)
      JOIN dispatch d ON d.id = mr.dispatchId
      WHERE d.sendAt <= ?
        AND (mr.status = 'scheduled'
          OR (mr.status = 'sending' AND mr.claimedUntil < ?))
    `,
      [SCHEDULE_EXPIRED_ERROR, params.now, params.cutoff, params.now]
    )
    return {
      ids: rows.map((r) => r.id),
      dispatchIds: [...new Set(rows.map((r) => r.dispatchId))],
    }
  } catch (err) {
    logger.error({ err }, 'scheduled-sends-adapter.expireStaleRecipients')
    throw err
  }
}

/**
 * Atomically claim up to `batchSize` due recipients: 'scheduled' rows whose
 * dispatch slot has passed, plus 'sending' rows whose claim lapsed (worker
 * died mid-call; resend accepted). UPDLOCK + READPAST means two replicas
 * never claim the same row — the second skips rows the first holds. Rows
 * are ordered by dispatch so a batch clusters into few provider calls.
 */
export async function claimDueRecipients(params: {
  batchSize: number
  now: Date
  cutoff: Date // slots at or before this are stale and left for expiry
  claimedUntil: Date
}): Promise<ClaimedRecipient[]> {
  try {
    return await db.raw<ClaimedRecipient[]>(
      `
      ;WITH due AS (
        SELECT TOP (?) mr.id, mr.dispatchId, mr.toAddress, mr.status,
               mr.claimedUntil, mr.attempts, mr.statusUpdatedAt
        FROM message_recipient mr WITH (UPDLOCK, READPAST, ROWLOCK)
        JOIN dispatch d ON d.id = mr.dispatchId
        WHERE d.sendAt <= ? AND d.sendAt > ?
          AND (mr.status = 'scheduled'
            OR (mr.status = 'sending' AND mr.claimedUntil < ?))
        ORDER BY d.sendAt, mr.dispatchId
      )
      UPDATE due
        SET status = 'sending', claimedUntil = ?, attempts = attempts + 1,
            statusUpdatedAt = ?
      OUTPUT inserted.id, inserted.dispatchId, inserted.toAddress, inserted.attempts
    `,
      [
        params.batchSize,
        params.now,
        params.cutoff,
        params.now,
        params.claimedUntil,
        params.now,
      ]
    )
  } catch (err) {
    logger.error({ err }, 'scheduled-sends-adapter.claimDueRecipients')
    throw err
  }
}

/**
 * Open scheduled work (rows still 'scheduled' or 'sending'). Used at startup
 * when the worker is disabled, to warn that nothing will process them.
 */
export async function countOpenScheduledRecipients(): Promise<number> {
  try {
    const [row] = await db('message_recipient')
      .whereIn('status', ['scheduled', 'sending'])
      .count<{ count: number }[]>({ count: '*' })
    return Number(row?.count ?? 0)
  } catch (err) {
    logger.error(
      { err },
      'scheduled-sends-adapter.countOpenScheduledRecipients'
    )
    throw err
  }
}

// Raw rows: no template join here, so the read-side `templateName` is absent.
export async function getDispatchesByIds(
  ids: string[]
): Promise<Omit<communication.Dispatch, 'templateName'>[]> {
  if (ids.length === 0) return []
  try {
    return await db<communication.Dispatch>('dispatch').whereIn('id', ids)
  } catch (err) {
    logger.error({ err }, 'scheduled-sends-adapter.getDispatchesByIds')
    throw err
  }
}

/**
 * Provider accepted the batch: 'sending' -> 'sent' with the provider message
 * id (null when the response lacked one; delivery reports then can't match).
 */
export async function markRecipientsSent(
  rows: (RecipientFence & { externalMessageId: string | null })[],
  now: Date
): Promise<{ updatedCount: number }> {
  if (rows.length === 0) return { updatedCount: 0 }
  try {
    const updated = await db.raw<{ id: string }[]>(
      `
      UPDATE mr
        SET status = 'sent', externalMessageId = j.externalMessageId,
            claimedUntil = NULL, error = NULL, statusUpdatedAt = ?
      OUTPUT inserted.id
      FROM message_recipient mr
      JOIN OPENJSON(?) WITH (
        id UNIQUEIDENTIFIER '$.id',
        attempts INT '$.attempts',
        externalMessageId NVARCHAR(100) '$.externalMessageId'
      ) j ON j.id = mr.id
      WHERE mr.status = 'sending' AND mr.attempts = j.attempts
    `,
      [now, JSON.stringify(rows)]
    )
    return { updatedCount: updated.length }
  } catch (err) {
    logger.error({ err }, 'scheduled-sends-adapter.markRecipientsSent')
    throw err
  }
}

/**
 * Provider refused the batch (4xx/5xx) or the worker is shutting down before
 * calling: hand the rows back to 'scheduled' so the next tick retries them.
 */
export async function releaseRecipients(
  rows: RecipientFence[],
  now: Date
): Promise<{ updatedCount: number }> {
  if (rows.length === 0) return { updatedCount: 0 }
  try {
    const updated = await db.raw<{ id: string }[]>(
      `
      UPDATE mr
        SET status = 'scheduled', claimedUntil = NULL, statusUpdatedAt = ?
      OUTPUT inserted.id
      FROM message_recipient mr
      JOIN OPENJSON(?) WITH (
        id UNIQUEIDENTIFIER '$.id',
        attempts INT '$.attempts'
      ) j ON j.id = mr.id
      WHERE mr.status = 'sending' AND mr.attempts = j.attempts
    `,
      [now, JSON.stringify(rows)]
    )
    return { updatedCount: updated.length }
  } catch (err) {
    logger.error({ err }, 'scheduled-sends-adapter.releaseRecipients')
    throw err
  }
}
