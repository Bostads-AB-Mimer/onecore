// Scheduling rules for scheduled SMS/email (MIM-1838). Shared by the bulk
// send routes, the reschedule route and the worker so every path agrees on
// what a valid send time is. All wall-clock logic is Swedish local time;
// the API exchanges UTC instants.
import { communication } from '@onecore/types'

import config from '../../common/config'

export const TIME_ZONE = 'Europe/Stockholm'
export const SLOT_MINUTES = 10
const SLOT_MS = SLOT_MINUTES * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

// Absorbs clock skew and request latency: a sendAt this close to "now" (either
// side) is treated as an immediate send instead of a schedule or an error.
export const SCHEDULE_GRACE_SECONDS = 30

export type ScheduleRules = {
  enabled: boolean
  blockedFrom: string // 'HH:mm', inclusive start of the daily blocked window
  blockedUntil: string // 'HH:mm', exclusive end; before blockedFrom = overnight
  maxDaysAhead: number
}

export const getScheduleRules = (): ScheduleRules => ({
  enabled: config.scheduledSends.enabled,
  blockedFrom: config.scheduledSends.blockedFrom,
  blockedUntil: config.scheduledSends.blockedUntil,
  maxDaysAhead: config.scheduledSends.maxDaysAhead,
})

// What the frontend picker needs to mirror the rules (see ScheduleConfigSchema).
export const toScheduleConfig = (
  rules: ScheduleRules
): communication.ScheduleConfig => ({
  enabled: rules.enabled,
  timeZone: TIME_ZONE,
  slotMinutes: SLOT_MINUTES,
  blockedHours: { from: rules.blockedFrom, until: rules.blockedUntil },
  maxDaysAhead: rules.maxDaysAhead,
})

// 'HH:mm' -> minutes since local midnight. Throws on malformed config so a
// typo fails at startup rather than silently disabling the window.
export const parseHHmm = (value: string): number => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  const hours = match ? Number(match[1]) : NaN
  const minutes = match ? Number(match[2]) : NaN
  if (!match || hours > 23 || minutes > 59) {
    throw new Error(`Invalid HH:mm time: "${value}"`)
  }
  return hours * 60 + minutes
}

const localTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// Minutes since local (Swedish) midnight for an instant; DST-correct.
export const localMinutesOfDay = (date: Date): number => {
  const parts = localTimeFormatter.formatToParts(date)
  const get = (type: 'hour' | 'minute') =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN)
  return get('hour') * 60 + get('minute')
}

export const isInBlockedHours = (date: Date, rules: ScheduleRules): boolean => {
  const from = parseHHmm(rules.blockedFrom)
  const until = parseHHmm(rules.blockedUntil)
  if (from === until) return false // no window configured
  const minute = localMinutesOfDay(date)
  // from < until: same-day window; otherwise it wraps past midnight.
  return from < until
    ? minute >= from && minute < until
    : minute >= from || minute < until
}

// Slot boundaries are :00/:10/.../:50 local time. Europe/Stockholm is a
// whole-hour offset from UTC (+01/+02), so the UTC minute decides.
export const isOnSlotBoundary = (date: Date): boolean =>
  date.getTime() % SLOT_MS === 0

// First slot boundary strictly after `after`.
export const nextSlotBoundary = (after: Date): Date =>
  new Date(Math.floor(after.getTime() / SLOT_MS) * SLOT_MS + SLOT_MS)

// First slot boundary strictly after `after` that is outside blocked hours.
export const nextOpenSlot = (after: Date, rules: ScheduleRules): Date => {
  let slot = nextSlotBoundary(after)
  // A blocked window is under 24 h, so an open slot is always within a day.
  const giveUpAt = slot.getTime() + DAY_MS
  while (isInBlockedHours(slot, rules)) {
    slot = new Date(slot.getTime() + SLOT_MS)
    if (slot.getTime() > giveUpAt) {
      throw new Error('Blocked hours leave no open slot within 24 hours')
    }
  }
  return slot
}

export type SendAtInvalidCode =
  | 'SCHEDULING_DISABLED'
  | 'SEND_AT_IN_PAST'
  | 'SEND_AT_TOO_FAR_AHEAD'
  | 'SEND_AT_OFF_SLOT'
  | 'SEND_AT_IN_BLOCKED_HOURS'

export type SendAtEvaluation =
  | { kind: 'immediate' }
  | { kind: 'scheduled'; sendAt: Date }
  | { kind: 'invalid'; code: SendAtInvalidCode; message: string }

/**
 * Decide what a send route should do with an optional sendAt. The input is an
 * ISO 8601 instant already format-validated by the route schema. A scheduled
 * time must be in the future, within maxDaysAhead, on a 10-minute slot
 * boundary and outside blocked hours; each violation has its own 400 code.
 */
export function evaluateSendAt(
  sendAt: string | undefined,
  rules: ScheduleRules,
  now: Date = new Date()
): SendAtEvaluation {
  if (sendAt === undefined) return { kind: 'immediate' }

  if (!rules.enabled) {
    return {
      kind: 'invalid',
      code: 'SCHEDULING_DISABLED',
      message: 'Scheduled sends are disabled in this environment',
    }
  }

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
  if (deltaMs > rules.maxDaysAhead * DAY_MS) {
    return {
      kind: 'invalid',
      code: 'SEND_AT_TOO_FAR_AHEAD',
      message: `sendAt must be within ${rules.maxDaysAhead} days`,
    }
  }
  if (!isOnSlotBoundary(target)) {
    return {
      kind: 'invalid',
      code: 'SEND_AT_OFF_SLOT',
      message: `sendAt must be on a ${SLOT_MINUTES}-minute boundary`,
    }
  }
  if (isInBlockedHours(target, rules)) {
    return {
      kind: 'invalid',
      code: 'SEND_AT_IN_BLOCKED_HOURS',
      message: `sendAt must be outside ${rules.blockedFrom}–${rules.blockedUntil} (${TIME_ZONE})`,
    }
  }
  return { kind: 'scheduled', sendAt: target }
}
