import { createHash } from 'node:crypto'

import { LeaseTerminationConfirmationEmail } from '@onecore/types'

export type IdempotencyClaimOutcome =
  'claimed' | 'duplicate' | 'conflict' | 'in-flight'

export type IdempotencyStore = {
  /** Synchronous reservation — must run before any await on the send path. */
  claim: (key: string, payloadHash: string) => IdempotencyClaimOutcome
  markSucceeded: (key: string, payloadHash: string) => void
  /** Drops an in-flight reservation so the caller can retry after send failure. */
  release: (key: string, payloadHash: string) => void
  clear: () => void
}

/** Stable hash of the integration payload (excludes server-added attribution). */
export const hashNotificationPayload = (
  notification: LeaseTerminationConfirmationEmail
): string => {
  const { triggeredByUser: _triggeredByUser, ...dedupeFields } = notification
  const canonical = JSON.stringify(
    Object.keys(dedupeFields)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = dedupeFields[key as keyof typeof dedupeFields]
        return acc
      }, {})
  )
  return createHash('sha256').update(canonical).digest('hex')
}

type IdempotencyRecord = {
  payloadHash: string
  state: 'in-flight' | 'succeeded'
  expiresAt: number
}

/** In-process store with TTL. Swap for shared storage when Core runs multi-instance. */
export const createInMemoryIdempotencyStore = (
  ttlMs: number
): IdempotencyStore => {
  const records = new Map<string, IdempotencyRecord>()

  const purgeExpired = (now: number) => {
    for (const [key, record] of records) {
      if (record.expiresAt <= now) records.delete(key)
    }
  }

  return {
    claim(key, payloadHash) {
      const now = Date.now()
      purgeExpired(now)

      const existing = records.get(key)
      if (!existing) {
        records.set(key, {
          payloadHash,
          state: 'in-flight',
          expiresAt: now + ttlMs,
        })
        return 'claimed'
      }

      if (existing.payloadHash !== payloadHash) {
        return 'conflict'
      }

      if (existing.state === 'succeeded') {
        return 'duplicate'
      }

      return 'in-flight'
    },
    markSucceeded(key, payloadHash) {
      const existing = records.get(key)
      if (
        !existing ||
        existing.payloadHash !== payloadHash ||
        existing.state !== 'in-flight'
      ) {
        return
      }

      records.set(key, {
        payloadHash,
        state: 'succeeded',
        expiresAt: Date.now() + ttlMs,
      })
    },
    release(key, payloadHash) {
      const existing = records.get(key)
      if (
        !existing ||
        existing.payloadHash !== payloadHash ||
        existing.state !== 'in-flight'
      ) {
        return
      }

      records.delete(key)
    },
    clear() {
      records.clear()
    },
  }
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

export const tenantNotificationIdempotencyStore =
  createInMemoryIdempotencyStore(DEFAULT_TTL_MS)
