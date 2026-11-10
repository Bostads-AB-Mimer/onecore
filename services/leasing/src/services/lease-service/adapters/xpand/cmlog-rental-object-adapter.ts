import { Knex } from 'knex'
import { logger } from '@onecore/utilities'
import type {
  RentalObjectTypeChange,
  RentalObjectTypeChanges,
} from '@onecore/types'

import { xpandDb } from './xpandDb'
import { cmlogRowsSince } from './cmlog-rows'

const RENTAL_OBJECT_CODE_PATTERN = /^Hyresobjekt (\S+)/

const TYPE_CHANGE_PATTERN =
  /^Värdet i fältet 'Hyresobjekttyp' ändrat från '.*' till '(.*)'\.?$/

/**
 * Queries cmlog for rental object type changes after the given timestamp,
 * or all of them when it is null.
 */
export const cmlogRentalObjectTypeChanges = (db: Knex, since: Date | null) =>
  cmlogRowsSince(db, since, ['Hyresobjekt %', "%'Hyresobjekttyp'%"])

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

/**
 * Returns the parsed changes and `until`, the logtime of the newest row read
 * (parsed or skipped), so the caller can move past rows it cannot parse.
 */
export const getRentalObjectTypeChanges = async (
  since: Date | null
): Promise<RentalObjectTypeChanges> => {
  const rows = await cmlogRentalObjectTypeChanges(xpandDb, since)
  const changes = parseRentalObjectTypeChanges(rows)

  logger.info(
    { count: changes.length },
    'cmlog rental object type changes since last sync'
  )

  return { changes, until: rows.at(-1)?.logtime ?? null }
}
