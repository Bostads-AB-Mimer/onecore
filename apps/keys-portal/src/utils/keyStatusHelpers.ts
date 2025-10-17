import type { Key, KeyWithLoanStatus, KeyType } from '@/services/types'

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
 * Checks the flex status of a key relative to other keys with the same name/type
 * @param key - The key to check
 * @param allKeys - All keys to compare against
 * @returns 'NOT_FLEX' if not a flex key, 'FLEX_ORDERED' if lower flex keys exist and are not disposed, 'FLEX_INCOMING' if all lower flex keys are disposed
 */
function getFlexStatus(
  key: Key,
  allKeys: Key[]
): 'NOT_FLEX' | 'FLEX_ORDERED' | 'FLEX_INCOMING' {
  // Key must have a flex number
  if (key.flexNumber === undefined) return 'NOT_FLEX'

  // Find keys with same name/type and lower flex numbers
  const lowerFlexKeys = allKeys.filter(
    (k) =>
      k.keyName === key.keyName &&
      k.keyType === key.keyType &&
      k.id !== key.id &&
      k.flexNumber !== undefined &&
      k.flexNumber < key.flexNumber
  )

  // If no lower flex keys, not a flex key
  if (lowerFlexKeys.length === 0) return 'NOT_FLEX'

  // Check if any lower flex keys are NOT disposed
  const hasActiveLowerFlexKeys = lowerFlexKeys.some((k) => !k.disposed)

  return hasActiveLowerFlexKeys ? 'FLEX_ORDERED' : 'FLEX_INCOMING'
}

/**
 * Sorts keys by type (using KEY_TYPE_ORDER), then by sequence number, then by name
 * @param keys - Array of keys to sort
 * @returns New sorted array of keys
 */
export function sortKeysByTypeAndSequence<T extends Key>(keys: T[]): T[] {
  const getTypeRank = (t: KeyType) => KEY_TYPE_ORDER[t] ?? 999
  const getSeq = (k: T) =>
    k.keySequenceNumber == null
      ? Number.POSITIVE_INFINITY
      : Number(k.keySequenceNumber)

  return [...keys].sort((a, b) => {
    // First: sort by type
    const typeCmp =
      getTypeRank(a.keyType as KeyType) - getTypeRank(b.keyType as KeyType)
    if (typeCmp !== 0) return typeCmp

    // Second: sort by sequence number
    const seqCmp = getSeq(a) - getSeq(b)
    if (seqCmp !== 0) return seqCmp

    // Third: sort by name
    return (a.keyName || '').localeCompare(b.keyName || '')
  })
}

/**
 * Checks if a key is a "new flex" key (has the status "Ny beställd flex" or "Ny inkommen flex")
 * A key is "new flex" if it:
 * - Has never been loaned (activeLoanContact === null and prevLoanAvailableFrom === null)
 * - Is a flex key (has higher flex number than other keys with same name/type)
 * @param keyWithStatus - The key with status information
 * @param allKeys - All keys to compare against
 * @returns true if the key is a new flex key
 */
export function isNewFlexKey(
  keyWithStatus: KeyWithStatus,
  allKeys: Key[]
): boolean {
  const flexStatus = getFlexStatus(keyWithStatus, allKeys)
  return (
    keyWithStatus.activeLoanContact === null &&
    keyWithStatus.prevLoanAvailableFrom === undefined &&
    flexStatus === 'FLEX_ORDERED'
  )
}

/**
 * Computes the display status text and date for a key based on its loan information
 * @param key - The key with pre-fetched loan data
 * @param allKeys - All keys (needed to check if it's a flex key)
 * @param matchesTenant - Whether the active loan matches the current tenant
 * @returns Object with status text, optional formatted date string, and availability flag
 */
export function getKeyDisplayStatus(
  key: KeyWithLoanStatus,
  allKeys: KeyWithLoanStatus[],
  matchesTenant: boolean
): { status: string; date?: string; isAvailable?: boolean } {
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
      // Never been loaned - check flex status - always available (green)
      const flexStatus = getFlexStatus(key, allKeys)
      if (flexStatus === 'FLEX_ORDERED') {
        return { status: 'Ny beställd flex', isAvailable: true }
      } else if (flexStatus === 'FLEX_INCOMING') {
        return { status: 'Ny inkommen flex', isAvailable: true }
      } else {
        return { status: 'Ny', isAvailable: true }
      }
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
        status: `Återlämnad av ${key.activeLoanContact ?? 'okänd'}`,
        date: dateString,
        isAvailable,
      }
    }
  }
}

/**
 * Computes the full KeyWithStatus for a key with pre-fetched loan data and determines display status.
 * This is now a SYNCHRONOUS function - no async calls!
 *
 * @param key - The key with pre-fetched active loan data
 * @param allKeys - All keys (needed for flex key detection)
 * @param tenantContactCodes - Contact codes of the current tenant(s) (used for matching against DB)
 * @returns KeyWithStatus
 */
export function computeKeyWithStatus(
  key: KeyWithLoanStatus,
  allKeys: KeyWithLoanStatus[],
  tenantContactCodes: string[]
): KeyWithStatus {
  const matchesTenant = matchesCurrentTenant(
    key,
    tenantContactCodes[0],
    tenantContactCodes[1]
  )

  const { status, date, isAvailable } = getKeyDisplayStatus(
    key,
    allKeys,
    matchesTenant
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
 * Filters out disposed keys that don't have active loans.
 * A key should be visible if:
 * - It's not disposed, OR
 * - It's disposed but currently loaned out
 *
 * This ensures disposed keys remain visible until they are returned.
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
