import type { Key, KeyType } from '@/services/types'

import type { KeyLoanInfo } from './keyLoanStatus'

/**
 * Extended Key type with loan information and display status
 */
export type KeyWithStatus = Key & {
  loanInfo: KeyLoanInfo
  displayStatus: string
  displayDate?: string // Formatted date string to display (e.g., "Hämtad: 15/10/2025")
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
 * - Has never been loaned (loanInfo.contact === null)
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
    keyWithStatus.loanInfo.contact === null && flexStatus === 'FLEX_ORDERED'
  )
}

/**
 * Computes the display status text and date for a key based on its loan information
 * @param loanInfo - The loan information for the key
 * @param key - The key itself
 * @param allKeys - All keys (needed to check if it's a flex key)
 * @returns Object with status text and optional formatted date string
 */
export function getKeyDisplayStatus(
  loanInfo: KeyLoanInfo,
  key: Key,
  allKeys: Key[]
): { status: string; date?: string } {
  // Check if key is disposed - show special status
  if (key.disposed) {
    if (loanInfo.matchesCurrentTenant) {
      return { status: `Kasserad, utlånad till den här hyresgästen` }
    } else {
      return { status: `Kasserad, utlånad till ${loanInfo.contact ?? 'Okänd'}` }
    }
  }

  if (loanInfo.isLoaned) {
    // Check if key has been picked up (has signed receipt OR pickedUpAt date)
    const isPickedUp = loanInfo.hasSignedLoanReceipt || !!loanInfo.pickedUpAt

    if (isPickedUp) {
      // Key is currently loaned and picked up - show pickup date
      const formattedDate = formatSwedishDate(loanInfo.pickedUpAt)
      const dateString = formattedDate ? `Hämtad: ${formattedDate}` : undefined

      if (loanInfo.matchesCurrentTenant) {
        return {
          status: `Utlånat till den här hyresgästen`,
          date: dateString,
        }
      } else {
        return {
          status: `Utlånad till ${loanInfo.contact ?? 'Okänd'}`,
          date: dateString,
        }
      }
    } else {
      // Key is loaned but not yet picked up - show "ready to pick up"
      if (loanInfo.matchesCurrentTenant) {
        return {
          status: `Redo att hämtas`,
        }
      } else {
        return {
          status: `Redo att hämtas (${loanInfo.contact ?? 'Okänd'})`,
        }
      }
    }
  } else {
    // Key is not currently loaned
    if (loanInfo.contact === null) {
      // Never been loaned - check flex status
      const flexStatus = getFlexStatus(key, allKeys)
      if (flexStatus === 'FLEX_ORDERED') {
        return { status: 'Ny beställd flex' }
      } else if (flexStatus === 'FLEX_INCOMING') {
        return { status: 'Ny inkommen flex' }
      } else {
        return { status: 'Ny' }
      }
    } else if (loanInfo.matchesCurrentTenant) {
      // Was returned by current tenant - show availability date
      const formattedDate = formatSwedishDate(
        loanInfo.availableToNextTenantFrom
      )
      const dateString = formattedDate
        ? `Tillgänglig fr.o.m: ${formattedDate}`
        : undefined

      return {
        status: `Återlämnad av den här hyresgästen`,
        date: dateString,
      }
    } else {
      // Was returned by someone else - show availability date
      const formattedDate = formatSwedishDate(
        loanInfo.availableToNextTenantFrom
      )
      const dateString = formattedDate
        ? `Tillgänglig fr.o.m: ${formattedDate}`
        : undefined

      return {
        status: `Återlämnad av ${loanInfo.contact}`,
        date: dateString,
      }
    }
  }
}

/**
 * Computes the full KeyWithStatus for a key by fetching loan info and determining display status
 * Handles errors gracefully by returning a KeyWithStatus with unknown status
 * @param key - The key to compute status for
 * @param allKeys - All keys (needed for flex key detection)
 * @param tenantContactCodes - Contact codes of the current tenant(s) (used for matching against DB)
 * @param getKeyLoanStatusFn - Function to fetch loan status (injected for testability)
 * @returns Promise resolving to KeyWithStatus
 */
export async function computeKeyWithStatus(
  key: Key,
  allKeys: Key[],
  tenantContactCodes: string[],
  getKeyLoanStatusFn: (
    keyId: string,
    contactCode1?: string,
    contactCode2?: string
  ) => Promise<KeyLoanInfo>
): Promise<KeyWithStatus> {
  try {
    const loanInfo = await getKeyLoanStatusFn(
      key.id,
      tenantContactCodes[0],
      tenantContactCodes[1]
    )

    const { status, date } = getKeyDisplayStatus(loanInfo, key, allKeys)

    return {
      ...key,
      loanInfo,
      displayStatus: status,
      displayDate: date,
    }
  } catch {
    // Return key with unknown status on error
    return {
      ...key,
      loanInfo: { isLoaned: false, contact: null, matchesCurrentTenant: false },
      displayStatus: 'Okänd status',
    }
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
    return key.loanInfo.isLoaned
  })
}
