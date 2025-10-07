// lib/dateUtils.ts
import { formatDistanceToNow, format } from 'date-fns'
import { sv } from 'date-fns/locale'

/**
 * Formats a date as relative time in Swedish
 * Examples: "2 timmar sedan", "3 dagar sedan", "igår"
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  return formatDistanceToNow(dateObj, {
    addSuffix: true,
    locale: sv,
  })
}

/**
 * Formats a date as absolute time
 * Example: "2024-10-07 14:30"
 */
export function formatAbsoluteTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  return format(dateObj, 'yyyy-MM-dd HH:mm', {
    locale: sv,
  })
}

/**
 * Formats a date as full Swedish date
 * Example: "7 oktober 2024 kl. 14:30"
 */
export function formatFullDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  return format(dateObj, "d MMMM yyyy 'kl.' HH:mm", {
    locale: sv,
  })
}
