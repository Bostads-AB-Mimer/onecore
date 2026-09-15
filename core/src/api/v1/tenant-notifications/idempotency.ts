import { createHash } from 'node:crypto'

import { LeaseTerminationConfirmationEmail } from '@onecore/types'

export type IdempotencyOutcome = 'new' | 'duplicate' | 'conflict'

export type IdempotencyStore = {
  evaluate: (key: string, payloadHash: string) => IdempotencyOutcome
  remember: (key: string, payloadHash: string) => void
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

/** In-process store with TTL. Swap for shared storage when Core runs multi-instance. */
export const createInMemoryIdempotencyStore = (
  ttlMs: number
): IdempotencyStore => {
  const records = new Map<string, { payloadHash: string; expiresAt: number }>()

  const purgeExpired = (now: number) => {
    for (const [key, record] of records) {
      if (record.expiresAt <= now) records.delete(key)
    }
  }

  return {
    evaluate(key, payloadHash) {
      const now = Date.now()
      purgeExpired(now)
      const existing = records.get(key)
      if (!existing) return 'new'
      if (existing.payloadHash === payloadHash) return 'duplicate'
      return 'conflict'
    },
    remember(key, payloadHash) {
      records.set(key, { payloadHash, expiresAt: Date.now() + ttlMs })
    },
    clear() {
      records.clear()
    },
  }
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

export const tenantNotificationIdempotencyStore =
  createInMemoryIdempotencyStore(DEFAULT_TTL_MS)
