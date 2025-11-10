import { RentInfo } from '@onecore/types'
import { logger } from '@onecore/utilities'
import { XPandRentRow } from '../adapters/xpand/types'

const MONTHS_PER_YEAR = 12

/**
 * Private helper to calculate total yearly rent from yearrentrows JSON array
 */
function calculateTotalYearlyRent(yearRentRows: unknown): number {
  if (!Array.isArray(yearRentRows) || yearRentRows.length === 0) {
    return 0
  }

  return yearRentRows
    .map((r: XPandRentRow) => {
      const yearRent = typeof r.yearrent === 'number' ? r.yearrent : 0
      return !isNaN(yearRent) ? yearRent : 0
    })
    .reduce((sum: number, val: number) => sum + val, 0)
}

/**
 * Calculates full rent information structure from XPand yearrentrows JSON string
 * Used by lease adapters that need complete RentInfo structure
 *
 * @param yearrentrows - JSON string containing array of rent rows from XPand
 * @returns RentInfo object with currentRent details, or undefined if parsing fails
 */
export function calculateRentInfo(
  yearrentrows: string | null | undefined
): RentInfo | undefined {
  if (!yearrentrows) {
    return undefined
  }

  try {
    const yearRentRows: unknown = JSON.parse(yearrentrows)
    const totalYearRent = calculateTotalYearlyRent(yearRentRows)

    if (totalYearRent === 0) {
      return undefined
    }

    const monthlyRent = totalYearRent / MONTHS_PER_YEAR

    return {
      currentRent: {
        currentRent: monthlyRent,
        vat: 0, // VAT information not available in XPand data source
        additionalChargeDescription: undefined,
        additionalChargeAmount: undefined,
        rentStartDate: undefined,
        rentEndDate: undefined,
      },
      futureRents: undefined,
    }
  } catch (err) {
    logger.warn({ error: err }, 'Failed to parse yearrentrows')
    return undefined
  }
}

/**
 * Calculates monthly rent amount from XPand yearrentrows JSON string
 * Used by rental object adapters that only need the monthly rent number
 *
 * @param yearrentrows - JSON string containing array of rent rows from XPand
 * @returns Monthly rent amount, or 0 if parsing fails or no rent data available
 */
export function calculateMonthlyRent(
  yearrentrows: string | null | undefined
): number {
  if (!yearrentrows) {
    return 0
  }

  try {
    const yearRentRows: unknown = JSON.parse(yearrentrows)
    const totalYearRent = calculateTotalYearlyRent(yearRentRows)
    return totalYearRent / MONTHS_PER_YEAR
  } catch (err) {
    logger.warn({ error: err }, 'Failed to parse yearrentrows')
    return 0
  }
}
