import { logger } from '@onecore/utilities'

import { prisma } from './db'

/**
 * The companies whose stock is real, operating property.
 *
 * Xpand does NOT delete-mark or date-expire sold properties — it moves them
 * to company 999 "SÅLDA FASTIGHETER" (127 properties as of 2026-08, against
 * Mimer's 263), where they keep live rows, live rental ids and open validity
 * windows. Every property-resolving query must therefore filter on company,
 * or sold stock (with tenants still attached) leaks into live views.
 *
 * An allowlist rather than a denylist of 999: it also excludes the 007
 * dummy-data company and any future pseudo-company by construction.
 */
export const OPERATING_COMPANY_CODES = ['001', '006'] as const

/**
 * Narrow a set of property codes to those belonging to an operating company.
 * Also drops codes with no structure rows at all.
 */
export const filterToOperatingCompanies = async (
  propertyCodes: string[]
): Promise<string[]> => {
  const uniqueCodes = Array.from(new Set(propertyCodes))
  if (uniqueCodes.length === 0) return []

  const codesJson = JSON.stringify(uniqueCodes)
  const companiesJson = JSON.stringify(OPERATING_COMPANY_CODES)

  try {
    // cmpcode carries trailing spaces for some values, hence the trim.
    const rows = await prisma.$queryRaw<{ propertyCode: string }[]>`
      SELECT DISTINCT s.fstcode AS propertyCode
      FROM dbo.babuf s
      WHERE s.fstcode IN (SELECT value FROM OPENJSON(${codesJson}))
        AND s.deletemark = 0
        AND LTRIM(RTRIM(s.cmpcode)) IN
            (SELECT value FROM OPENJSON(${companiesJson}))
    `
    return rows.map((r) => r.propertyCode.trim())
  } catch (err) {
    logger.error({ err }, 'company-scope.filterToOperatingCompanies')
    throw err
  }
}
