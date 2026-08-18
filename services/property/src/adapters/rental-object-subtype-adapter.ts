import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import { cachedPromise } from '@src/utils/promise-cache'
import type { RentalObjectSubtype } from '@src/types/rental-object'

import { OPERATING_COMPANY_CODES } from './company-scope'
import { prisma } from './db'

/**
 * The subtype captions ("3 rum och kök", "Centralgarage", "3G Antenner") that
 * rental objects carry, grouped by the object type they belong to.
 *
 * Only subtypes actually in use by operating-company stock are returned — the
 * caption tables hold plenty of historical entries that would otherwise show
 * up as filter options matching nothing.
 */
const fetchRentalObjectSubtypes = async (): Promise<RentalObjectSubtype[]> => {
  const companiesJson = JSON.stringify(OPERATING_COMPANY_CODES)

  try {
    const rows = await prisma.$queryRaw<RentalObjectSubtype[]>`
      SELECT DISTINCT
        'residence' AS type, t.code AS code, t.caption AS name
      FROM dbo.babuf s
      INNER JOIN dbo.balgh o ON o.keycmobj = s.keycmobj
      INNER JOIN dbo.balgt t ON t.keybalgt = o.keybalgt
      WHERE s.deletemark = 0 AND t.caption IS NOT NULL AND t.code IS NOT NULL
        AND LTRIM(RTRIM(s.cmpcode)) IN
            (SELECT value FROM OPENJSON(${companiesJson}))

      UNION ALL
      SELECT DISTINCT
        'parkingSpace', t.code, t.caption
      FROM dbo.babuf s
      INNER JOIN dbo.babps o ON o.keycmobj = s.keycmobj
      INNER JOIN dbo.babpt t ON t.keybabpt = o.keybabpt
      WHERE s.deletemark = 0 AND t.caption IS NOT NULL AND t.code IS NOT NULL
        AND LTRIM(RTRIM(s.cmpcode)) IN
            (SELECT value FROM OPENJSON(${companiesJson}))

      UNION ALL
      SELECT DISTINCT
        'facility', t.code, t.caption
      FROM dbo.babuf s
      INNER JOIN dbo.balok o ON o.keycmobj = s.keycmobj
      INNER JOIN dbo.balot t ON t.keybalot = o.keybalot
      WHERE s.deletemark = 0 AND t.caption IS NOT NULL AND t.code IS NOT NULL
        AND LTRIM(RTRIM(s.cmpcode)) IN
            (SELECT value FROM OPENJSON(${companiesJson}))

      UNION ALL
      SELECT DISTINCT
        'other', t.code, t.caption
      FROM dbo.babuf s
      INNER JOIN dbo.bahyr o ON o.keycmobj = s.keycmobj
      INNER JOIN dbo.bahyt t ON t.keybahyt = o.keybahyt
      WHERE s.deletemark = 0 AND t.caption IS NOT NULL AND t.code IS NOT NULL
        AND LTRIM(RTRIM(s.cmpcode)) IN
            (SELECT value FROM OPENJSON(${companiesJson}))

      ORDER BY type, name
    `.then(trimStrings)

    return rows
  } catch (err) {
    logger.error({ err }, 'rental-object-subtype-adapter.list')
    throw err
  }
}

// Captions change about as rarely as the hierarchy does, but the query is four
// scans of babuf and the filter panel asks for them on every mount. Cached the
// same way the market areas are — the promise, so concurrent callers share one
// query instead of each starting their own.
const SUBTYPE_CACHE_TTL_MS = 60 * 60 * 1000

const subtypeCache = cachedPromise(
  SUBTYPE_CACHE_TTL_MS,
  fetchRentalObjectSubtypes
)

export const clearRentalObjectSubtypeCache = (): void => subtypeCache.clear()

export const listRentalObjectSubtypes = (): Promise<RentalObjectSubtype[]> =>
  subtypeCache.get()
