import { logger } from '@onecore/utilities'
import { xpandDb } from './xpandDb'

/**
 * Xpand hyobj.keyhyobt code for "Avtalsmall" (agreement template).
 * Template rows are not real contracts and have all dates NULL. Xpand's own
 * UI hides them; queries that read leases from hyobj exclude them.
 */
export const XPAND_HYOBT_AVTALSMALL = '1'

export const getParkingSpaceTypes = async (): Promise<
  { code: string; caption: string }[]
> => {
  try {
    const rows = await xpandDb
      .from('babpt')
      .select('babpt.code as code', 'babpt.caption as caption')
      .orderBy('babpt.caption')

    return rows.map((row: { code: string; caption: string }) => ({
      code: row.code.trim(),
      caption: row.caption.trim(),
    }))
  } catch (err) {
    logger.error({ err }, 'getParkingSpaceTypes')
    throw err
  }
}

// Xpand does not delete-mark or date-expire sold properties, and company 999
// ("SÅLDA FASTIGHETER") can carry more than one type per parking space.
// Limiting to the operating companies means every code has exactly one type.
const PARKING_SPACE_OPERATING_COMPANIES = ['001', '006']

/**
 * Rental object code (babuf.hyresid) -> parking-space type caption
 * (babpt.caption), for parking spaces in the operating companies.
 *
 * Pass typeCodes to limit the lookup to those type(s) — used to resolve the
 * set of rental object codes for a chosen filter. Called with no argument,
 * it returns every parking space's type, for the export column.
 */
export const getParkingSpaceTypesByRentalObjectCode = async (
  typeCodes?: string[]
): Promise<Map<string, string>> => {
  try {
    const query = xpandDb
      .from('babuf')
      .innerJoin('babps', 'babps.keycmobj', 'babuf.keycmobj')
      .innerJoin('babpt', 'babpt.keybabpt', 'babps.keybabpt')
      .select('babuf.hyresid as rentalObjectCode', 'babpt.caption as typeName')
      .where('babuf.deletemark', '=', 0)
      .whereIn('babuf.cmpcode', PARKING_SPACE_OPERATING_COMPANIES)
      .whereNotNull('babuf.hyresid')
      .where('babuf.hyresid', '!=', '')

    if (typeCodes && typeCodes.length > 0) {
      query.whereIn(
        'babpt.code',
        typeCodes.map((code) => code.trim())
      )
    }

    const rows: { rentalObjectCode: string; typeName: string }[] = await query

    const map = new Map<string, string>()
    for (const row of rows) {
      map.set(row.rentalObjectCode.trim(), row.typeName.trim())
    }
    return map
  } catch (err) {
    logger.error({ err }, 'getParkingSpaceTypesByRentalObjectCode')
    throw err
  }
}

/**
 * Get distinct rental object codes (hyresid) managed by
 * the given building manager name(s).
 *
 * Used by the Tenfast search adapter to post-filter leases
 * by building manager. Returns Xpand rental object IDs that
 * match Tenfast's hyresobjekt externalId.
 */
export const getRentalObjectCodesByBuildingManager = async (
  buildingManagers: string[]
): Promise<string[]> => {
  const rows = await xpandDb
    .from('bafen')
    .innerJoin('babuf', 'babuf.fencode', 'bafen.code')
    .select('babuf.hyresid')
    .distinct()
    .whereIn('bafen.omrade', buildingManagers)
    .whereNotNull('babuf.hyresid')
    .where('babuf.hyresid', '!=', '')

  return rows.map((row: { hyresid: string }) => row.hyresid.trim())
}

/**
 * Get distinct rental object codes (hyresid) belonging to
 * the given kvv-area code(s) (bafen.code, kvartersvärdsområde).
 */
export const getRentalObjectCodesByKvvAreaCodes = async (
  kvvAreaCodes: string[]
): Promise<string[]> => {
  const rows = await xpandDb
    .from('bafen')
    .innerJoin('babuf', 'babuf.fencode', 'bafen.code')
    .select('babuf.hyresid')
    .distinct()
    .whereIn('bafen.code', kvvAreaCodes)
    .whereNotNull('babuf.hyresid')
    .where('babuf.hyresid', '!=', '')

  return rows.map((row: { hyresid: string }) => row.hyresid.trim())
}

/**
 * Get distinct rental object codes (hyresid) belonging to
 * the given building code(s).
 */
export const getRentalObjectCodesByBuildingCodes = async (
  buildingCodes: string[]
): Promise<string[]> => {
  const rows = await xpandDb
    .from('babuf')
    .select('babuf.hyresid')
    .distinct()
    .whereIn('babuf.bygcode', buildingCodes)
    .whereNotNull('babuf.hyresid')
    .where('babuf.hyresid', '!=', '')

  return rows.map((row: { hyresid: string }) => row.hyresid.trim())
}

/**
 * Get distinct rental object codes (hyresid) belonging to
 * the given area code(s) (område).
 *
 * Join chain: babuf → bafst (property) → babya (area)
 */
export const getRentalObjectCodesByAreaCodes = async (
  areaCodes: string[]
): Promise<string[]> => {
  const rows = await xpandDb
    .from('babuf')
    .innerJoin('bafst', 'bafst.keycmobj', 'babuf.keyobjfst')
    .innerJoin('babya', 'babya.keybabya', 'bafst.keybabya')
    .select('babuf.hyresid')
    .distinct()
    .whereIn('babya.code', areaCodes)
    .whereNotNull('babuf.hyresid')
    .where('babuf.hyresid', '!=', '')

  return rows.map((row: { hyresid: string }) => row.hyresid.trim())
}

/**
 * Get distinct rental object codes (hyresid) belonging to
 * the given district name(s).
 *
 * Join chain: babuf → bafen (neighborhood manager, which has district)
 */
export const getRentalObjectCodesByDistrictNames = async (
  districtNames: string[]
): Promise<string[]> => {
  const rows = await xpandDb
    .from('babuf')
    .innerJoin('bafen', 'bafen.code', 'babuf.fencode')
    .select('babuf.hyresid')
    .distinct()
    .whereIn('bafen.distrikt', districtNames)
    .whereNotNull('babuf.hyresid')
    .where('babuf.hyresid', '!=', '')

  return rows.map((row: { hyresid: string }) => row.hyresid.trim())
}
