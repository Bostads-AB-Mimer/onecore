// Client-side rules for scheduling sends (MIM-1897/MIM-1838). The rules come
// from the communication service via core (ScheduleConfig) so the picker and
// the server never disagree; the server re-validates every sendAt.
//
// Slot and blocked-hour maths run in the browser's local time, which for our
// users is the same Swedish zone the service enforces (config.timeZone).
import type { ScheduleConfig } from '@/services/api/core/communicationService'

const DAY_MS = 24 * 60 * 60 * 1000
const MINUTES_PER_DAY = 24 * 60

// 'HH:mm' -> minutes since midnight.
export const parseHHmm = (value: string): number => {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

// Local 'HH:mm' of a Date, for the time dropdown's values and labels.
export const formatSlotTime = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

// Blocked window: inclusive start, exclusive end; from after until = overnight.
export const isBlockedMinute = (
  minuteOfDay: number,
  config: ScheduleConfig
): boolean => {
  const from = parseHHmm(config.blockedHours.from)
  const until = parseHHmm(config.blockedHours.until)
  if (from === until) return false
  return from < until
    ? minuteOfDay >= from && minuteOfDay < until
    : minuteOfDay >= from || minuteOfDay < until
}

// Latest permitted send time.
export const getMaxSendAt = (
  config: ScheduleConfig,
  now: Date = new Date()
): Date => new Date(now.getTime() + config.maxDaysAhead * DAY_MS)

// Calendar days the picker greys out: before today or past max-ahead.
export const isDayDisabled = (
  day: Date,
  config: ScheduleConfig,
  now: Date = new Date()
): boolean =>
  startOfDay(day) < startOfDay(now) ||
  startOfDay(day) > startOfDay(getMaxSendAt(config, now))

// Open slots on `day`: every slot boundary outside blocked hours that is
// still ahead of `now` and within max-ahead. Built from wall-clock minutes so
// DST days still enumerate correctly.
export const getSlotsForDay = (
  day: Date,
  config: ScheduleConfig,
  now: Date = new Date()
): Date[] => {
  const base = startOfDay(day)
  const max = getMaxSendAt(config, now).getTime()
  const slots: Date[] = []
  for (let m = 0; m < MINUTES_PER_DAY; m += config.slotMinutes) {
    if (isBlockedMinute(m, config)) continue
    const slot = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      0,
      m
    )
    // DST: the constructor maps a nonexistent spring-forward hour onto the
    // next one (duplicate slots) and picks one of the two autumn hours. Keep
    // only slots that landed on the wall-clock time we asked for.
    if (slot.getHours() * 60 + slot.getMinutes() !== m) continue
    if (slot.getTime() <= now.getTime() || slot.getTime() > max) continue
    slots.push(slot)
  }
  return slots
}

// First open slot after `after`, or null if none within max-ahead. Used to
// suggest a sensible default when the user enables scheduling.
export const getNextOpenSlot = (
  after: Date,
  config: ScheduleConfig,
  now: Date = new Date()
): Date | null => {
  for (let d = 0; d <= config.maxDaysAhead + 1; d++) {
    const day = new Date(after.getTime() + d * DAY_MS)
    const slot = getSlotsForDay(day, config, now).find(
      (s) => s.getTime() > after.getTime()
    )
    if (slot) return slot
  }
  return null
}

// User-facing validation of a picked send time. Returns null when usable.
export const validateScheduleDate = (
  sendAt: Date | null,
  config: ScheduleConfig,
  now: Date = new Date()
): string | null => {
  if (!sendAt) return 'Välj datum och tid för utskicket'
  if (isNaN(sendAt.getTime())) return 'Ogiltigt datum'
  if (sendAt.getTime() <= now.getTime()) {
    return 'Tidpunkten måste vara i framtiden'
  }
  if (sendAt.getTime() > getMaxSendAt(config, now).getTime()) {
    return `Utskick kan schemaläggas högst ${config.maxDaysAhead} dagar fram`
  }
  if (isBlockedMinute(sendAt.getHours() * 60 + sendAt.getMinutes(), config)) {
    return `Utskick kan inte schemaläggas mellan ${config.blockedHours.from} och ${config.blockedHours.until}`
  }
  if (
    (sendAt.getMinutes() % config.slotMinutes !== 0 ||
      sendAt.getSeconds() !== 0) &&
    config.slotMinutes > 1
  ) {
    return `Välj en tid i ${config.slotMinutes}-minutersintervall`
  }
  return null
}

// Maps schedule-related error codes — as forwarded by core from the
// communication service (bulk sends use `reason`, cancel/reschedule use
// `error`) — to user-facing Swedish. Returns null for unrecognized codes so
// callers can fall back to their generic message.
export const scheduleSendErrorText = (code: unknown): string | null => {
  switch (code) {
    case 'conflict':
      return 'Utskicket har redan skickats eller håller på att skickas.'
    case 'not-found':
      return 'Utskicket kunde inte hittas.'
    case 'SCHEDULING_DISABLED':
      return 'Schemalagda utskick är avstängda i den här miljön.'
    case 'SEND_AT_IN_PAST':
    case 'SEND_AT_TOO_SOON':
      return 'Tidpunkten måste vara i framtiden.'
    case 'SEND_AT_TOO_FAR_AHEAD':
      return 'Tidpunkten är för långt fram i tiden.'
    case 'SEND_AT_OFF_SLOT':
      return 'Tidpunkten måste vara en hel tiominutersperiod.'
    case 'SEND_AT_IN_BLOCKED_HOURS':
      return 'Utskick kan inte schemaläggas under natten.'
    case 'SCHEDULE_LOG_FAILED':
      return 'Schemaläggningen misslyckades. Ingenting skickades — försök igen.'
    case 'TOO_MANY_RECIPIENTS':
      return 'För många mottagare.'
    default:
      return null
  }
}

// Semantic alias for the shared timestamp formatter, kept for send-confirmation
// call sites that read as "Skickas {time}". One implementation lives in
// shared/lib/formatters.
export { formatTimestamp as formatScheduleTimestamp } from './formatters'
