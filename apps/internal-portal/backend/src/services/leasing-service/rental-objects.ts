import KoaRouter from '@koa/router'
import * as coreAdapter from './adapters/core-adapter'
import { generateRouteMetadata } from '@onecore/utilities'
import { Listing, RentalObject } from '@onecore/types'

// Local extension of RentalObject for internal portal features
interface RentalObjectWithListingHistory extends RentalObject {
  previousListingsCount: number
}

const calculatePreviousListingsCount = (
  parkingSpace: RentalObject,
  closedListings: Listing[]
): number => {
  const scoredListings = closedListings.filter(
    (listing) =>
      listing.rentalObjectCode === parkingSpace.rentalObjectCode &&
      listing.rentalRule === 'SCORED'
  )

  if (parkingSpace.vacantFrom) {
    // Count SCORED listings published since the vacantFrom date
    return scoredListings.filter(
      (listing) =>
        listing.publishedFrom &&
        new Date(listing.publishedFrom) >= new Date(parkingSpace.vacantFrom!)
    ).length
  }

  // Fallback: count SCORED listings in the last 12 months
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

  return scoredListings.filter(
    (listing) =>
      listing.publishedFrom &&
      new Date(listing.publishedFrom) >= twelveMonthsAgo
  ).length
}

const getExcludedRentalObjectCodes = (
  publishedListings: Listing[],
  readyForOfferListings: Listing[]
): Set<string> => {
  return new Set([
    ...publishedListings.map((listing) => listing.rentalObjectCode),
    ...readyForOfferListings.map((listing) => listing.rentalObjectCode),
  ])
}

export const routes = (router: KoaRouter) => {
  router.get('(.*)/rental-objects/vacant-parkingspaces', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    // Run all requests in parallel for better performance
    const [
      vacantParkingSpaces,
      publishedListings,
      readyForOfferListings,
      closedListings,
    ] = await Promise.all([
      coreAdapter.getVacantParkingSpaces(),
      coreAdapter.getListingsWithApplicants('type=published'),
      coreAdapter.getListingsWithApplicants('type=ready-for-offer'),
      coreAdapter.getListingsWithApplicants('type=closed'),
    ])

    if (!vacantParkingSpaces.ok) {
      ctx.status = vacantParkingSpaces.statusCode
      ctx.body = { error: vacantParkingSpaces.err, ...metadata }
      return
    }

    const excludedRentalObjectCodes = getExcludedRentalObjectCodes(
      publishedListings.ok ? publishedListings.data || [] : [],
      readyForOfferListings.ok ? readyForOfferListings.data || [] : []
    )

    const unpublishedVacantParkingSpaces = (
      vacantParkingSpaces.data || []
    ).filter(
      (parkingSpace: RentalObject) =>
        !excludedRentalObjectCodes.has(parkingSpace.rentalObjectCode)
    )

    // Calculate previous listings count since vacant date based on closed listings
    const allClosedListings = closedListings.ok ? closedListings.data || [] : []
    const parkingSpacesWithListingHistory: RentalObjectWithListingHistory[] =
      unpublishedVacantParkingSpaces.map((parkingSpace: RentalObject) => ({
        ...parkingSpace,
        previousListingsCount: calculatePreviousListingsCount(
          parkingSpace,
          allClosedListings
        ),
      }))

    ctx.status = 200
    ctx.body = {
      content: parkingSpacesWithListingHistory,
      ...metadata,
    }
  })
}
