import { contactDetailsMode } from '@onecore/utilities'

export const REDACTED = 'redacted'

/**
 * Trim any and all string values of a DB result row, as Xpand
 * has a bad habit of padding strings with spaces.
 *
 * @param obj The DB row to trim
 *
 * @returns The trimmed DB row
 */
export const trimRow = <T extends Record<string, any>>(obj: T): T => {
  return Object.fromEntries(
    Object.entries(obj ?? {}).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trimEnd() : value,
    ])
  ) as T
}

export const applyContactDetailsMode = <T>(
  details: T[],
  protectedIdentity: boolean,
  toRedacted: (item: T) => T,
  toPlaceholder: (item: T) => T
): T[] => {
  if (protectedIdentity) return []
  switch (contactDetailsMode()) {
    case 'real':
      return details
    case 'placeholder':
      return details.map(toPlaceholder)
    case 'redacted':
      return details.map(toRedacted)
  }
}
