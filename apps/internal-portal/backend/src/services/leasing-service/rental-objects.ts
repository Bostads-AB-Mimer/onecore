import KoaRouter from '@koa/router'
import * as coreAdapter from './adapters/core-adapter'
import { generateRouteMetadata } from '@onecore/utilities'
import { Listing, RentalObject } from '@onecore/types'

// Local extension of RentalObject for internal portal features
interface RentalObjectWithAttempts extends RentalObject {
  listingAttemptsCount: number
}

export const routes = (router: KoaRouter) => {
  router.get('(.*)/rental-objects/vacant-parkingspaces', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    // Run all requests in parallel for better performance
    const [
      vacantParkingSpaces,
      publishedListings,
      readyForOfferListings,
      offeredListings,
      needsRepublishListings,
    ] = await Promise.all([
      coreAdapter.getVacantParkingSpaces(),
      coreAdapter.getListingsWithApplicants('type=published'),
      coreAdapter.getListingsWithApplicants('type=ready-for-offer'),
      coreAdapter.getListingsWithApplicants('type=offered'),
      coreAdapter.getListingsWithApplicants('type=needs-republish'),
    ])

    if (!vacantParkingSpaces.ok) {
      ctx.status = vacantParkingSpaces.statusCode
      ctx.body = { error: vacantParkingSpaces.err, ...metadata }
      return
    }

    const excludedRentalObjectCodesSet = new Set([
      ...(publishedListings.ok
        ? (publishedListings.data || []).map(
            (listing: Listing) => listing.rentalObjectCode
          )
        : []),
      ...(readyForOfferListings.ok
        ? (readyForOfferListings.data || []).map(
            (listing: Listing) => listing.rentalObjectCode
          )
        : []),
      ...(offeredListings.ok
        ? (offeredListings.data || []).map(
            (listing: Listing) => listing.rentalObjectCode
          )
        : []),
    ])

    const unpublishedVacantParkingSpaces = (
      vacantParkingSpaces.data || []
    ).filter(
      (parkingSpace: RentalObject) =>
        !excludedRentalObjectCodesSet.has(parkingSpace.rentalObjectCode)
    )

    // Calculate listing attempts count based on needs-republish listings
    const parkingSpacesWithAttemptsCount: RentalObjectWithAttempts[] =
      unpublishedVacantParkingSpaces.map(
        (parkingSpace: RentalObject): RentalObjectWithAttempts => {
          let listingAttemptsCount = 0

          if (needsRepublishListings.ok) {
            const parkingSpaceRepublishListings =
              needsRepublishListings.data.filter(
                (listing: Listing) =>
                  listing.rentalObjectCode === parkingSpace.rentalObjectCode &&
                  listing.rentalRule === 'SCORED' // Only count SCORED listings
              )

            if (parkingSpace.vacantFrom) {
              // Count SCORED listings that were published since the vacantFrom date and need republishing
              listingAttemptsCount = parkingSpaceRepublishListings.filter(
                (listing: Listing) =>
                  listing.publishedFrom &&
                  new Date(listing.publishedFrom) >=
                    new Date(parkingSpace.vacantFrom!)
              ).length
            } else {
              // Fallback: count SCORED listing attempts in the last 12 months
              const twelveMonthsAgo = new Date()
              twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

              listingAttemptsCount = parkingSpaceRepublishListings.filter(
                (listing: Listing) =>
                  listing.publishedFrom &&
                  new Date(listing.publishedFrom) >= twelveMonthsAgo
              ).length
            }
          }

          return {
            ...parkingSpace,
            listingAttemptsCount,
          }
        }
      )
    console.log('needsRepublishListings', needsRepublishListings)
    console.log(parkingSpacesWithAttemptsCount)

    ctx.status = 200
    ctx.body = {
      content: parkingSpacesWithAttemptsCount,
      ...metadata,
    }
  })
}
