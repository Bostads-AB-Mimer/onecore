import { LeaseType } from '@onecore/types'

/**
 * Parse a raw lease type string (e.g. from XPand DB, possibly padded with
 * trailing spaces) into the LeaseType enum.
 * Falls back to LeaseType.OtherContract for unknown values.
 */
export const parseLeaseType = (
  raw: string | undefined | null
): LeaseType => {
  const trimmed = (raw ?? '').trim()
  const match = Object.values(LeaseType).find((v) => v === trimmed)
  return match ?? LeaseType.OtherContract
}
