const REDACTED = 'redacted'

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

export const redact = <T, Prop extends keyof T>(
  details: T[],
  field: Prop,
  protectedIdentity: boolean
) => {
  return protectedIdentity
    ? details.map((pn) => ({ ...pn, [field]: REDACTED }))
    : details
}
