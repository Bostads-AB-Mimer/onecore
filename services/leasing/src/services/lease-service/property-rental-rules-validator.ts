import { Lease } from 'onecore-types'
import { match, P } from 'ts-pattern'

import { getEstateCodeFromXpandByRentalObjectCode } from './adapters/xpand/estate-code-adapter'

export const PROPERTIES_WITH_SPECIFIC_RENTAL_RULES = {
  SJOODJURET_2: '24104',
  ROTORN_13: '23002',
  ROTORN_14: '23001',
  ISOLATORN_14: '23003',
}

const parkingSpaceNeedsValidation = (estateCode: string) =>
  Object.values(PROPERTIES_WITH_SPECIFIC_RENTAL_RULES).includes(estateCode)

async function isParkingSpaceRentableForTenant(
  lease: Lease,
  listingEstateCode: string
) {
  const propertyInfo = await getEstateCodeFromXpandByRentalObjectCode(
    lease.rentalPropertyId
  )

  if (!propertyInfo) return false

  /**
   * ROTORN 13 and ROTORN 14 are considered the same property
   * in the context of rental rules.
   *
   * So we need to check if both the listing estate code and
   * property estate code are either ROTORN 13 or ROTORN 14.
   * If they are, we can consider them the same property.
   *
   * Otherwise we expect them to be the same.
   */
  const { ROTORN_13, ROTORN_14 } = PROPERTIES_WITH_SPECIFIC_RENTAL_RULES

  return match([listingEstateCode, propertyInfo.estateCode])
    .with(
      [P.union(ROTORN_13, ROTORN_14), P.union(ROTORN_13, ROTORN_14)],
      () => true
    )
    .otherwise(([a, b]) => a === b)
}

export { parkingSpaceNeedsValidation, isParkingSpaceRentableForTenant }
