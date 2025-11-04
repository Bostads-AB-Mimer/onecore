import type {
  Key,
  KeyWithLoanStatus,
  KeyType,
  KeyEvent,
} from '@/services/types'
import { KeyEventStatusLabels, KeyEventTypeLabels } from '@/services/types'

/**
 * Extended Key type with computed loan information and display status
 */
export type KeyWithStatus = KeyWithLoanStatus & {
  matchesCurrentTenant: boolean // Whether the active loan matches the current tenant
  displayStatus: string
  displayDate?: string // Formatted date string to display (e.g., "Hämtad: 15/10/2025")
  isAvailable?: boolean // True if key is ready to be picked up (green), false if blocked (red)
}

/**
 * Helper to check if a key's active loan matches the current tenant contact codes
 */
function matchesCurrentTenant(
  key: KeyWithLoanStatus,
  currentContactCode?: string,
  currentContactCode2?: string
): boolean {
  if (!key.activeLoanContact) return false

  return (
    (currentContactCode &&
      (key.activeLoanContact?.trim() === currentContactCode.trim() ||
        key.activeLoanContact2?.trim() === currentContactCode.trim())) ||
    (currentContactCode2 &&
      (key.activeLoanContact?.trim() === currentContactCode2.trim() ||
        key.activeLoanContact2?.trim() === currentContactCode2.trim())) ||
    false
  )
}

/**
 * Helper to get the availability date from the key
 * Returns activeLoanAvailableFrom if picked up, otherwise prevLoanAvailableFrom
 */
function getAvailabilityDate(key: KeyWithLoanStatus): string | undefined {
  return key.activeLoanPickedUpAt
    ? key.activeLoanAvailableFrom
    : key.prevLoanAvailableFrom
}

/**
 * Default ordering for key types
 */
const KEY_TYPE_ORDER: Partial<Record<KeyType, number>> = {
  LGH: 1,
  PB: 2,
  FS: 3,
  HN: 4,
}

/**
 * Formats an ISO date string to Swedish date format (DD/MM/YYYY)
 * @param isoDateString - ISO 8601 date string
 * @returns Formatted date string or undefined if invalid
 */
function formatSwedishDate(isoDateString?: string): string | undefined {
  if (!isoDateString) return undefined

  try {
    const date = new Date(isoDateString)
    // Check if date is valid
    if (isNaN(date.getTime())) return undefined

    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()

    return `${day}/${month}/${year}`
  } catch {
    return undefined
  }
}

/**
 * Sorts keys hierarchically:
 * 1. By type (using KEY_TYPE_ORDER) - outer grouping
 * 2. Within type, by name
 * 3. Within name, by flex number
 * 4. Within flex, by sequence number
 *
 * @param keys - Array of keys to sort
 * @returns New sorted array of keys
 */
export function sortKeysByTypeAndSequence<T extends Key>(keys: T[]): T[] {
  const getTypeRank = (t: KeyType) => KEY_TYPE_ORDER[t] ?? 999
  const getSeq = (k: T) =>
    k.keySequenceNumber == null
      ? Number.POSITIVE_INFINITY
      : Number(k.keySequenceNumber)
  const getFlex = (k: T) =>
    k.flexNumber == null ? Number.POSITIVE_INFINITY : Number(k.flexNumber)

  return [...keys].sort((a, b) => {
    // First: sort by type (outer grouping)
    const typeCmp =
      getTypeRank(a.keyType as KeyType) - getTypeRank(b.keyType as KeyType)
    if (typeCmp !== 0) return typeCmp

    // Second: sort by name (within type)
    const nameCmp = (a.keyName || '').localeCompare(b.keyName || '')
    if (nameCmp !== 0) return nameCmp

    // Third: sort by flex number (within name)
    const flexCmp = getFlex(a) - getFlex(b)
    if (flexCmp !== 0) return flexCmp

    // Fourth: sort by sequence number (within flex)
    const seqCmp = getSeq(a) - getSeq(b)
    return seqCmp
  })
}

/**
 * Computes the display status text and date for a key based on its loan information and events
 * @param key - The key with pre-fetched loan data
 * @param matchesTenant - Whether the active loan matches the current tenant
 * @param latestEvent - Optional latest event for the key
 * @returns Object with status text, optional formatted date string, and availability flag
 */
export function getKeyDisplayStatus(
  key: KeyWithLoanStatus,
  matchesTenant: boolean,
  latestEvent?: KeyEvent
): { status: string; date?: string; isAvailable?: boolean } {
  // If there's an incomplete event, show event status
  if (latestEvent && latestEvent.status !== 'COMPLETED') {
    const statusText =
      KeyEventStatusLabels[
        latestEvent.status as keyof typeof KeyEventStatusLabels
      ] || latestEvent.status
    const eventType =
      KeyEventTypeLabels[latestEvent.type as keyof typeof KeyEventTypeLabels] ||
      latestEvent.type

    if (latestEvent.type === 'FLEX') {
      const dateToUse =
        latestEvent.status === 'ORDERED'
          ? latestEvent.createdAt
          : latestEvent.updatedAt
      const formattedDate = formatSwedishDate(dateToUse)

      return {
        status: formattedDate
          ? `${eventType} ${statusText.toLowerCase()} ${formattedDate}`
          : `${eventType} ${statusText.toLowerCase()}`,
        isAvailable: false, // Keys with incomplete events are not available
      }
    }

    return {
      status: `${eventType} ${statusText.toLowerCase()}`,
      isAvailable: false, // Keys with incomplete events are not available
    }
  }
  const isLoaned = !!key.activeLoanId
  const availabilityDate = getAvailabilityDate(key)

  // Check if key is disposed - show special status
  if (key.disposed) {
    if (matchesTenant) {
      return { status: `Kasserad, utlånad till den här hyresgästen` }
    } else {
      return {
        status: `Kasserad, utlånad till ${key.activeLoanContact ?? 'Okänd'}`,
      }
    }
  }

  if (isLoaned) {
    // Check if key has been picked up
    const isPickedUp = !!key.activeLoanPickedUpAt

    if (isPickedUp) {
      // Key is currently loaned and picked up - show pickup date
      const formattedDate = formatSwedishDate(key.activeLoanPickedUpAt)
      const dateString = formattedDate ? `Hämtad: ${formattedDate}` : undefined

      if (matchesTenant) {
        return {
          status: `Utlånat till den här hyresgästen`,
          date: dateString,
        }
      } else {
        return {
          status: `Utlånad till ${key.activeLoanContact ?? 'Okänd'}`,
          date: dateString,
        }
      }
    } else {
      // Key is loaned but not yet picked up - check if available date is in the future
      const availableDate = availabilityDate ? new Date(availabilityDate) : null
      const isInFuture = availableDate && availableDate > new Date()
      const isAvailable = !isInFuture // Available (green) if date is in past or not set

      const formattedDate = formatSwedishDate(availabilityDate)
      const dateString = formattedDate
        ? `${isInFuture ? 'Kan ej hämtas före' : 'Redo fr.o.m'}: ${formattedDate}`
        : undefined

      const statusText = isInFuture ? 'Kan ej hämtas' : 'Redo att hämtas'

      if (matchesTenant) {
        return {
          status: statusText,
          date: dateString,
          isAvailable,
        }
      } else {
        return {
          status: `${statusText} (${key.activeLoanContact ?? 'Okänd'})`,
          date: dateString,
          isAvailable,
        }
      }
    }
  } else {
    // Key is not currently loaned
    if (key.activeLoanContact === null && !availabilityDate) {
      // Never been loaned - always available (green)
      return { status: 'Ny', isAvailable: true }
    } else if (matchesTenant) {
      // Was returned by current tenant - check if available date is in the future
      const availableDate = availabilityDate ? new Date(availabilityDate) : null
      const isInFuture = availableDate && availableDate > new Date()
      const isAvailable = !isInFuture // Available (green) if date is in past or not set

      const formattedDate = formatSwedishDate(availabilityDate)
      const dateString = formattedDate
        ? `Tillgänglig fr.o.m: ${formattedDate}`
        : undefined

      return {
        status: `Återlämnad av den här hyresgästen`,
        date: dateString,
        isAvailable,
      }
    } else {
      // Was returned by someone else - check if available date is in the future
      const availableDate = availabilityDate ? new Date(availabilityDate) : null
      const isInFuture = availableDate && availableDate > new Date()
      const isAvailable = !isInFuture // Available (green) if date is in past or not set

      const formattedDate = formatSwedishDate(availabilityDate)
      const dateString = formattedDate
        ? `Tillgänglig fr.o.m: ${formattedDate}`
        : undefined

      return {
        status: `Återlämnad av ${key.prevLoanContact ?? 'okänd'}`,
        date: dateString,
        isAvailable,
      }
    }
  }
}

/**
 * Computes the full KeyWithStatus for a key with pre-fetched loan data and determines display status.
 * Fetches the latest event for the key to determine if it should show event status.
 *
 * @param key - The key with pre-fetched active loan data
 * @param tenantContactCodes - Contact codes of the current tenant(s) (used for matching against DB)
 * @returns KeyWithStatus
 */
export function computeKeyWithStatus(
  key: KeyWithLoanStatus,
  tenantContactCodes: string[]
): KeyWithStatus {
  const matchesTenant = matchesCurrentTenant(
    key,
    tenantContactCodes[0],
    tenantContactCodes[1]
  )

  const { status, date, isAvailable } = getKeyDisplayStatus(
    key,
    matchesTenant,
    key.latestEvent
  )

  return {
    ...key,
    matchesCurrentTenant: matchesTenant,
    displayStatus: status,
    displayDate: date,
    isAvailable,
  }
}

/**
 * Filters out keys that should not be visible in the main list.
 * A key should be hidden if:
 * - It's disposed AND not currently loaned out
 *
 * Keys with events are always shown (the event status is displayed but keys are visible)
 *
 * @param keysWithStatus - Array of keys with status information
 * @returns Filtered array containing only visible keys
 */
export function filterVisibleKeys(
  keysWithStatus: KeyWithStatus[]
): KeyWithStatus[] {
  return keysWithStatus.filter((key) => {
    // Show key if it's not disposed
    if (!key.disposed) return true
    // Show disposed key only if it's currently loaned
    return !!key.activeLoanId
  })
}
