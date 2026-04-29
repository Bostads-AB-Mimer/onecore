import { Knex } from 'knex'
import { logger } from '@onecore/utilities'

import { xpandDb } from './xpandDb'

export interface LeaseChange {
  leaseId: string
  contactCode: string
  rentalObjectId: string
}

const RELEVANT_CONTRACT_TYPES = [
  'Bostadskontrakt',
  'Lokalkontrakt',
  'Garagekontrakt',
]

/**
 * Queries cmlog for lease changes since the given timestamp.
 *
 * Only rows whose logmemo starts with "Hyreskontrakt " are returned.
 * If no timestamp is provided, returns all matching rows.
 */
export const cmlogLeaseChanges = (
  db: Knex,
  since: Date | null
): Promise<Record<string, unknown>[]> => {
  const base = db
    .from('cmlog')
    .whereLike('logmemo', 'Hyreskontrakt %')
    .orderBy('logtime', 'desc')

  return since
    ? base.andWhere('logtime', '>', since)
    : base
}

/**
 * Parses cmlog rows into deduplicated LeaseChange entries.
 *
 * Extracts leaseId from the first token after "Hyreskontrakt ",
 * contact code (P-prefixed or other known prefixes), and derives
 * rentalObjectId by stripping the /XX suffix from the leaseId.
 *
 * Only rows containing Bostadskontrakt, Lokalkontrakt, or
 * Garagekontrakt are included.
 */
export const parseLeaseChanges = (
  rows: { logmemo: string; logtime: Date }[]
): LeaseChange[] => {
  const seen = new Set<string>()
  const results: LeaseChange[] = []

  for (const row of rows) {
    const firstLine = row.logmemo.split('\n')[0]

    if (!RELEVANT_CONTRACT_TYPES.some((type) => firstLine.includes(type))) {
      continue
    }

    const leaseIdMatch = firstLine.match(/^Hyreskontrakt (\S+),/)
    if (!leaseIdMatch) continue
    const leaseId = leaseIdMatch[1]

    if (seen.has(leaseId)) continue
    seen.add(leaseId)

    const contactCodeMatch = firstLine.match(/,\s*([A-ZÖ]\d+),/)
    if (!contactCodeMatch) continue
    const contactCode = contactCodeMatch[1]

    const slashIndex = leaseId.lastIndexOf('/')
    const rentalObjectId =
      slashIndex !== -1 ? leaseId.substring(0, slashIndex) : leaseId

    results.push({ leaseId, contactCode, rentalObjectId })
  }

  return results
}

/**
 * Fetches and parses lease changes from cmlog.
 */
export const getLeaseChanges = async (
  since: Date | null
): Promise<LeaseChange[]> => {
  const rows = (await cmlogLeaseChanges(xpandDb, since)) as {
    logmemo: string
    logtime: Date
  }[]

  const changes = parseLeaseChanges(rows)

  logger.info(
    { count: changes.length, leaseIds: changes.map((c) => c.leaseId) },
    'cmlog lease changes since last sync'
  )

  return changes
}
