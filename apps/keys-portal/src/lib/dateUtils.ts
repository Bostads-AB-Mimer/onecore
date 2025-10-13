import { formatDistanceToNow, format } from 'date-fns'
import { sv } from 'date-fns/locale'

function parseDbDateToLocal(date: string | Date): Date {
  if (date instanceof Date) return date
  // If it already looks like ISO with timezone, let JS handle it.
  if (/[TZz]|[+-]\d{2}:\d{2}$/.test(date)) return new Date(date)

  // Handle SQL-style: "YYYY-MM-DD HH:mm:ss.SSSSSSS"
  // -> treat as UTC by making it ISO and appending 'Z'
  const [ymd, hms] = date.trim().split(' ')
  if (ymd && hms) {
    // Trim fractional seconds to 3 digits for JS Date
    const fracMatch = hms.match(/\.(\d+)/)
    let hmsFixed = hms
    if (fracMatch) {
      const frac = (fracMatch[1] + '000').slice(0, 3) // keep ms
      hmsFixed = hms.replace(/\.(\d+)/, `.${frac}`)
    }
    const iso = `${ymd}T${hmsFixed}Z` // explicitly UTC
    return new Date(iso)
  }

  // Fallback
  return new Date(date)
}

/**
 * Formats a date as relative time in Swedish
 * Examples: "2 timmar sedan", "3 dagar sedan", "igår"
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = parseDbDateToLocal(date)
  return formatDistanceToNow(dateObj, { addSuffix: true, locale: sv })
}

/**
 * Formats a date as absolute time
 * Example: "2024-10-07 14:30"
 */
export function formatAbsoluteTime(date: string | Date): string {
  const dateObj = parseDbDateToLocal(date)
  return format(dateObj, 'yyyy-MM-dd HH:mm', { locale: sv })
}

/**
 * Formats a date as full Swedish date
 * Example: "7 oktober 2024 kl. 14:30"
 */
export function formatFullDate(date: string | Date): string {
  const dateObj = parseDbDateToLocal(date)
  return format(dateObj, "d MMMM yyyy 'kl.' HH:mm", { locale: sv })
}
