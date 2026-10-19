import { Knex } from 'knex'
import { logger } from '@onecore/utilities'
import type { RentalObjectTypeChange } from '@onecore/types'

import { xpandDb } from './xpandDb'

const RENTAL_OBJECT_CODE_PATTERN = /^Hyresobjekt (\S+)/

const TYPE_CHANGE_PATTERN =
  /^Värdet i fältet 'Hyresobjekttyp' ändrat från '.*' till '(.*)'\.?$/

/**
 * Queries cmlog for rental object type changes after the given timestamp.
 *
 * cmlog.logtime is Swedish local time without a zone; see the note on
 * cmlogLeaseChanges in cmlog-lease-adapter.ts.
 */
export const cmlogRentalObjectTypeChanges = (
  db: Knex,
  since: Date
): Promise<{ logmemo: string; logtime: Date }[]> =>
  db
    .from('cmlog')
    .whereLike('logmemo', 'Hyresobjekt %')
    .andWhereLike('logmemo', "%'Hyresobjekttyp'%")
    .andWhere('logtime', '>', since)
    .orderBy('logtime', 'asc')
    .select('logmemo', 'logtime')

const toCodeAndLabel = (
  target: string
): Pick<RentalObjectTypeChange, 'code' | 'label'> => {
  if (target === '') return { code: null, label: null }
  const spaceIndex = target.indexOf(' ')
  if (spaceIndex === -1) return { code: target, label: null }
  return {
    code: target.substring(0, spaceIndex),
    label: target.substring(spaceIndex + 1),
  }
}

/**
 * Parses cmlog rows into one change per rental object: its latest type
 * change in `rows`, ordered by that change's timestamp. Callers pass rows
 * oldest first.
 */
export const parseRentalObjectTypeChanges = (
  rows: { logmemo: string; logtime: Date }[]
): RentalObjectTypeChange[] => {
  const latestByRentalObject = new Map<string, RentalObjectTypeChange>()

  for (const row of rows) {
    const lines = row.logmemo.split('\n').map((line) => line.trim())
    const codeMatch = lines[0].match(RENTAL_OBJECT_CODE_PATTERN)
    const typeMatch = lines
      .slice(1)
      .map((line) => line.match(TYPE_CHANGE_PATTERN))
      .find((match) => match !== null)

    if (!codeMatch || !typeMatch) {
      logger.warn(
        { firstLine: lines[0] },
        'parseRentalObjectTypeChanges: row without rental object code or type line, skipping'
      )
      continue
    }

    const rentalObjectCode = codeMatch[1]
    // Delete before set so the Map keeps insertion order by latest change.
    latestByRentalObject.delete(rentalObjectCode)
    latestByRentalObject.set(rentalObjectCode, {
      rentalObjectCode,
      ...toCodeAndLabel(typeMatch[1].trim()),
      timestamp: row.logtime,
    })
  }

  return Array.from(latestByRentalObject.values())
}

export const getRentalObjectTypeChanges = async (
  since: Date
): Promise<RentalObjectTypeChange[]> => {
  const rows = await cmlogRentalObjectTypeChanges(xpandDb, since)
  const changes = parseRentalObjectTypeChanges(rows)

  logger.info(
    { count: changes.length },
    'cmlog rental object type changes since last sync'
  )

  return changes
}
