import { Knex } from 'knex'
import { logger } from '@onecore/utilities'

import { xpandDb } from './xpandDb'

export interface LeaseChange {
  leaseId: string
  contactCode: string
  rentalObjectId: string
  action: 'create' | 'terminate' | 'void'
  // Source cmlog.logtime — used by sync-leases to checkpoint after each
  // successful sync so the next run resumes at the right place.
  timestamp: Date
}

const UNDERTECKNAT_CREATE_PATTERN =
  /Värdet i fältet 'Undertecknat' ändrat från '' till '\d{4}-\d{2}-\d{2}'/

const UPPSAGT_PATCH_PATTERN =
  /Värdet i fältet 'Uppsagt datum' ändrat från '' till '\d{4}-\d{2}-\d{2}'/

const MAKULERAT_PATCH_PATTERN =
  /Värdet i fältet 'Makulerat datum' ändrat från '' till '\d{4}-\d{2}-\d{2}'/

// Extracts the pre-M original leaseId from the rename line present in Makulerat logmemos.
const KONTRAKTSNUMMER_RENAME_PATTERN =
  /Värdet i fältet 'Kontraktsnummer' ändrat från '(\S+)' till '\S+'/

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
 *
 * Note: cmlog.logtime is a naive SQL Server `datetime` populated by xpand
 * with Swedish local time. Knex/mssql passes our JS Date as UTC; the driver
 * converts to the SQL Server session's local time for comparison. On a
 * machine running in Sweden this matches the column's wall clock, so the
 * `since` threshold lands where it reads.
 */
export const cmlogLeaseChanges = (
  db: Knex,
  since: Date | null
): Promise<Record<string, unknown>[]> => {
  const base = db
    .from('cmlog')
    .whereLike('logmemo', 'Hyreskontrakt %')
    .orderBy('logtime', 'asc')

  return since ? base.andWhere('logtime', '>', since) : base
}

/**
 * Parses cmlog rows into deduplicated LeaseChange entries.
 *
 * Extracts leaseId from the first token after "Hyreskontrakt ", contact code
 * (P-prefixed or other known prefixes), and derives rentalObjectId by stripping
 * the /XX suffix from the leaseId.
 *
 * Classifies action as:
 * - 'create'    — Undertecknat field set from empty to a date
 * - 'terminate' — Uppsagt datum field set from empty to a date
 * - 'void'      — Makulerat datum field set from empty to a date; the emitted
 *                 leaseId is overridden with the pre-M original parsed from the
 *                 Kontraktsnummer rename line in the same memo. Rows missing
 *                 the rename line are skipped with a warning.
 *
 * Only rows containing Bostadskontrakt, Lokalkontrakt, or Garagekontrakt are
 * included. Expects rows in chronological order (oldest first); when the same
 * leaseId has multiple events, the latest is kept.
 */
export const parseLeaseChanges = (
  rows: { logmemo: string; logtime: Date }[]
): LeaseChange[] => {
  const byLeaseId = new Map<string, LeaseChange>()

  for (const row of rows) {
    const firstLine = row.logmemo.split('\n')[0]

    if (!RELEVANT_CONTRACT_TYPES.some((type) => firstLine.includes(type))) {
      continue
    }

    const leaseIdMatch = firstLine.match(/^Hyreskontrakt (\S+),/)
    if (!leaseIdMatch) continue
    const leaseId = leaseIdMatch[1]

    const contactCodeMatch = firstLine.match(/,\s*([A-ZÖ]\d+),/)
    if (!contactCodeMatch) continue
    const contactCode = contactCodeMatch[1]

    let action: 'create' | 'terminate' | 'void'
    if (UNDERTECKNAT_CREATE_PATTERN.test(row.logmemo)) action = 'create'
    else if (UPPSAGT_PATCH_PATTERN.test(row.logmemo)) action = 'terminate'
    else if (MAKULERAT_PATCH_PATTERN.test(row.logmemo)) action = 'void'
    else continue

    let effectiveLeaseId = leaseId
    if (action === 'void') {
      const renameMatch = row.logmemo.match(KONTRAKTSNUMMER_RENAME_PATTERN)
      if (!renameMatch) {
        logger.warn(
          { leaseId, logmemo: row.logmemo },
          'parseLeaseChanges: Makulerat row missing Kontraktsnummer rename line, skipping'
        )
        continue
      }
      effectiveLeaseId = renameMatch[1]
    }

    const slashIndex = effectiveLeaseId.lastIndexOf('/')
    const rentalObjectId =
      slashIndex !== -1
        ? effectiveLeaseId.substring(0, slashIndex)
        : effectiveLeaseId

    byLeaseId.set(effectiveLeaseId, {
      leaseId: effectiveLeaseId,
      contactCode,
      rentalObjectId,
      action,
      timestamp: row.logtime,
    })
  }

  return Array.from(byLeaseId.values())
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
