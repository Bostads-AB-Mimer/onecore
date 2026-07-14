// Client-side rules for scheduling bulk sends (MIM-1897). Mirrors the
// per-channel server caps in services/communication (schedule.ts); the server
// re-validates. Email's 5 days is Infobip's hard limit for email scheduling.
export const MAX_SCHEDULE_DAYS_AHEAD = { sms: 90, email: 5 } as const

const DAY_MS = 24 * 60 * 60 * 1000

// Formats a Date as a value for <input type="datetime-local"> (local time,
// minute resolution). toISOString() is wrong here — it would shift to UTC.
export const toDatetimeLocalValue = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

// Bounds for a <input type="datetime-local"> min/max, so the native picker
// greys out past times and times beyond the channel cap. These only guide the
// picker — validateScheduleInput remains the real gate (see SmsModal).
export const getScheduleBounds = (
  maxDaysAhead: number
): { min: string; max: string } => {
  const now = Date.now()
  return {
    min: toDatetimeLocalValue(new Date(now)),
    max: toDatetimeLocalValue(new Date(now + maxDaysAhead * DAY_MS)),
  }
}

// Validates a datetime-local input value against the channel's cap. Returns a
// user-facing error message or null when the value is usable as a schedule time.
export const validateScheduleInput = (
  value: string,
  maxDaysAhead: number
): string | null => {
  if (!value) return 'Välj datum och tid för utskicket'
  const target = new Date(value)
  if (isNaN(target.getTime())) return 'Ogiltigt datum'
  if (target.getTime() <= Date.now()) {
    return 'Tidpunkten måste vara i framtiden'
  }
  if (target.getTime() > Date.now() + maxDaysAhead * DAY_MS) {
    return `Utskick kan schemaläggas högst ${maxDaysAhead} dagar fram`
  }
  return null
}

export const formatScheduleTimestamp = (iso: string): string =>
  new Date(iso).toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
