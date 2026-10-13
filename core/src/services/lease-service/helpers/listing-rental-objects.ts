import { logger } from '@onecore/utilities'
import { Listing, RentalObject } from '@onecore/types'

import * as leasingAdapter from '../../../adapters/leasing-adapter'
import { AdapterResult } from '../../../adapters/types'
import { getApartments } from './apartment-rental-objects'

type ListingRef = Pick<Listing, 'rentalObjectCode' | 'listingCategory'>

/**
 * The rental object behind a listing, fetched from the lookup for its category.
 * Categories without a lookup (storage) are not found.
 */
export const getRentalObjectForListing = async (
  listing: ListingRef
): Promise<AdapterResult<RentalObject, 'not-found' | 'unknown'>> => {
  switch (listing.listingCategory) {
    case 'PARKING_SPACE':
      return leasingAdapter.getParkingSpaceByCode(listing.rentalObjectCode)
    case 'APARTMENT': {
      const result = await getApartments([listing.rentalObjectCode])
      if (!result.ok) return result
      const [apartment] = result.data
      return apartment
        ? { ok: true, data: apartment }
        : { ok: false, err: 'not-found' }
    }
    default:
      return { ok: false, err: 'not-found' }
  }
}

/**
 * Rental objects for a set of listings, keyed by rental object code. Each
 * category is fetched only if some listing has it: an empty list would make
 * the parking space lookup return every parking space. A category with no
 * matches is simply absent from the map. A category whose lookup fails is
 * logged and left out too, so apartments failing doesn't take parking spaces
 * down with them; only when every lookup fails is it an error.
 */
export const getRentalObjectsForListings = async (
  listings: ListingRef[]
): Promise<AdapterResult<Map<string, RentalObject>, 'unknown'>> => {
  const codesFor = (category: Listing['listingCategory']) => [
    ...new Set(
      listings
        .filter((listing) => listing.listingCategory === category)
        .map((listing) => listing.rentalObjectCode)
    ),
  ]
  const parkingSpaceCodes = codesFor('PARKING_SPACE')
  const apartmentCodes = codesFor('APARTMENT')

  const lookups = await Promise.all([
    parkingSpaceCodes.length
      ? leasingAdapter
          .getParkingSpaces(parkingSpaceCodes)
          .then((result) => ({ category: 'PARKING_SPACE', result }))
      : null,
    apartmentCodes.length
      ? getApartments(apartmentCodes).then((result) => ({
          category: 'APARTMENT',
          result,
        }))
      : null,
  ])

  const rentalObjects = new Map<string, RentalObject>()
  let failed = 0
  let requested = 0
  for (const lookup of lookups) {
    if (!lookup) continue
    requested++
    const { category, result } = lookup
    if (!result.ok) {
      if (result.err === 'not-found') continue
      failed++
      logger.error(
        { category },
        'Could not get rental objects for listings of this category'
      )
      continue
    }
    for (const rentalObject of result.data) {
      rentalObjects.set(rentalObject.rentalObjectCode, rentalObject)
    }
  }
  if (requested > 0 && failed === requested) {
    return { ok: false, err: 'unknown' }
  }
  return { ok: true, data: rentalObjects }
}

/** Listings with their rental object; listings whose object wasn't found are left out. */
export const withRentalObjects = <T extends ListingRef>(
  listings: T[],
  rentalObjects: Map<string, RentalObject>
): (T & { rentalObject: RentalObject })[] =>
  listings.flatMap((listing) => {
    const rentalObject = rentalObjects.get(listing.rentalObjectCode)
    return rentalObject ? [{ ...listing, rentalObject }] : []
  })
