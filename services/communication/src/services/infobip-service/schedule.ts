// Scheduling rules for bulk sends (MIM-1897). Shared by the bulk SMS and bulk
// email routes so both channels validate sendAt identically.

// Per-channel caps. SMS: our own limit, deliberately under Infobip's 180-day
// max. Email: Infobip's hard limit — email v4 refuses schedules more than
// 5 days ahead.
export const MAX_SCHEDULE_DAYS_AHEAD = { sms: 90, email: 5 } as const

// Absorbs clock skew and request latency: a sendAt this close to "now" (either
// side) is treated as an immediate send instead of a schedule or an error.
export const SCHEDULE_GRACE_SECONDS = 30

// Request-level Infobip scheduling block (same shape for SMS v3 and email v4).
// bulkId is our dispatch id so the schedule can be managed later.
export type ScheduleOptions = { bulkId: string; sendAt: Date }

export type SendAtEvaluation =
  | { kind: 'immediate' }
  | { kind: 'scheduled'; sendAt: Date }
  | {
      kind: 'invalid'
      code: 'SEND_AT_IN_PAST' | 'SEND_AT_TOO_FAR_AHEAD'
      message: string
    }

/**
 * Decide what a bulk route should do with an optional sendAt. The input is an
 * ISO 8601 instant already format-validated by the route schema, so comparisons
 * here are pure UTC math — server vs. client timezone never enters into it.
 * `maxDaysAhead` is channel-specific (see MAX_SCHEDULE_DAYS_AHEAD).
 */
export function evaluateSendAt(
  sendAt: string | undefined,
  maxDaysAhead: number,
  now: Date = new Date()
): SendAtEvaluation {
  if (sendAt === undefined) return { kind: 'immediate' }

  const target = new Date(sendAt)
  const deltaMs = target.getTime() - now.getTime()

  if (Math.abs(deltaMs) <= SCHEDULE_GRACE_SECONDS * 1000) {
    return { kind: 'immediate' }
  }
  if (deltaMs < 0) {
    return {
      kind: 'invalid',
      code: 'SEND_AT_IN_PAST',
      message: 'sendAt must not be in the past',
    }
  }
  if (deltaMs > maxDaysAhead * 24 * 60 * 60 * 1000) {
    return {
      kind: 'invalid',
      code: 'SEND_AT_TOO_FAR_AHEAD',
      message: `sendAt must be within ${maxDaysAhead} days`,
    }
  }
  return { kind: 'scheduled', sendAt: target }
}
