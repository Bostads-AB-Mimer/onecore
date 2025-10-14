import type { Key, KeyType } from '@/services/types'

import type { KeyLoanInfo } from './keyLoanStatus'

/**
 * Extended Key type with loan information and display status
 */
export type KeyWithStatus = Key & {
  loanInfo: KeyLoanInfo
  displayStatus: string
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
 * Checks if a key is a "flex" key (has a higher flex number than other keys with same name/type)
 * @param key - The key to check
 * @param allKeys - All keys to compare against
 * @returns true if the key has a higher flex number than at least one other key with the same name and type
 */
export function isFlexKey(key: Key, allKeys: Key[]): boolean {
  // Key must have a flex number
  if (key.flexNumber === undefined) return false

  // Find other keys with same name and type but different flex numbers
  const sameNameTypeKeys = allKeys.filter(
    (k) =>
      k.keyName === key.keyName &&
      k.keyType === key.keyType &&
      k.flexNumber !== undefined &&
      k.id !== key.id
  )

  // If there are no other keys with same name/type, it's not a flex key
  if (sameNameTypeKeys.length === 0) return false

  // Check if this key has a higher flex number than at least one other key
  const hasLowerFlexKeys = sameNameTypeKeys.some(
    (k) => k.flexNumber! < key.flexNumber!
  )

  return hasLowerFlexKeys
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
 * Checks if a key is a "new flex" key (has the status "Ny beställd flex")
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
  return (
    keyWithStatus.loanInfo.contact === null && isFlexKey(keyWithStatus, allKeys)
  )
}

/**
 * Computes the display status text for a key based on its loan information
 * @param loanInfo - The loan information for the key
 * @param key - The key itself
 * @param allKeys - All keys (needed to check if it's a flex key)
 * @param tenantNames - Names of the current tenant(s)
 * @returns Human-readable status string in Swedish
 */
export function getKeyDisplayStatus(
  loanInfo: KeyLoanInfo,
  key: Key,
  allKeys: Key[],
  tenantNames: string[]
): string {
  // Check if key is disposed - show special status
  if (key.disposed) {
    if (loanInfo.contact && tenantNames.includes(loanInfo.contact)) {
      return `Kasserad, utlånad till den här hyresgästen`
    } else {
      return `Kasserad, utlånad till ${loanInfo.contact ?? 'Okänd'}`
    }
  }

  if (loanInfo.isLoaned) {
    // Key is currently loaned
    if (loanInfo.contact && tenantNames.includes(loanInfo.contact)) {
      return `Utlånat till den här hyresgästen`
    } else {
      return `Utlånad till ${loanInfo.contact ?? 'Okänd'}`
    }
  } else {
    // Key is not currently loaned
    if (loanInfo.contact === null) {
      // Never been loaned - check if it's a flex key
      if (isFlexKey(key, allKeys)) {
        return 'Ny beställd flex'
      } else {
        return 'Ny'
      }
    } else if (tenantNames.includes(loanInfo.contact)) {
      // Was returned by current tenant
      return `Återlämnad av den här hyresgästen`
    } else {
      // Was returned by someone else
      return `Återlämnad av ${loanInfo.contact}`
    }
  }
}

/**
 * Computes the full KeyWithStatus for a key by fetching loan info and determining display status
 * Handles errors gracefully by returning a KeyWithStatus with unknown status
 * @param key - The key to compute status for
 * @param allKeys - All keys (needed for flex key detection)
 * @param tenantNames - Names of the current tenant(s)
 * @param getKeyLoanStatusFn - Function to fetch loan status (injected for testability)
 * @returns Promise resolving to KeyWithStatus
 */
export async function computeKeyWithStatus(
  key: Key,
  allKeys: Key[],
  tenantNames: string[],
  getKeyLoanStatusFn: (
    keyId: string,
    contact1?: string,
    contact2?: string
  ) => Promise<KeyLoanInfo>
): Promise<KeyWithStatus> {
  try {
    const loanInfo = await getKeyLoanStatusFn(
      key.id,
      tenantNames[0],
      tenantNames[1]
    )

    const displayStatus = getKeyDisplayStatus(
      loanInfo,
      key,
      allKeys,
      tenantNames
    )

    return {
      ...key,
      loanInfo,
      displayStatus,
    }
  } catch {
    // Return key with unknown status on error
    return {
      ...key,
      loanInfo: { isLoaned: false, contact: null },
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
