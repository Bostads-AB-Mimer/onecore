import { DbContactName } from '@xpand/db-model'
import { REDACTED, trimRow } from './common'

export type ContactName = {
  fullName: string
  firstName: string
  lastName: string
}

/**
 * The display name of a `cmctc` row. `lagsokt` is a presence sentinel, not a
 * truthy flag: any non-null value means the identity is protected, and then
 * every name field is replaced wholesale.
 */
export const toContactName = (dbRow: DbContactName): ContactName => {
  const row = trimRow(dbRow)
  const protectedIdentity = row.protectedIdentity !== null

  return {
    fullName: protectedIdentity ? REDACTED : (row.fullName ?? ''),
    firstName: protectedIdentity ? REDACTED : (row.firstName ?? ''),
    lastName: protectedIdentity ? REDACTED : (row.lastName ?? ''),
  }
}
