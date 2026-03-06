import KoaRouter from '@koa/router'
import * as coreAdapter from './adapters/core-adapter'
import { generateRouteMetadata } from '@onecore/utilities'
import { Listing, RentalObject, ListingStatus } from '@onecore/types'

// Local extension of RentalObject for internal portal features
interface RentalObjectWithListingHistory extends RentalObject {
  previousListingsCount: number
}

const calculatePreviousListingsCount = (
  parkingSpace: RentalObject,
  allListings: Listing[]
): number => {
  const parkingSpaceListings = allListings.filter(
    (listing) => listing.rentalObjectCode === parkingSpace.rentalObjectCode
  )

  // Find the most recent assigned listing
  const assignedListings = parkingSpaceListings
    .filter((listing) => listing.status === ListingStatus.Assigned)
    .sort((a, b) => {
      const dateA = new Date(a.publishedFrom || 0)
      const dateB = new Date(b.publishedFrom || 0)
      return dateB.getTime() - dateA.getTime()
    })

  const lastAssignedListing = assignedListings[0]

  // Count all closed SCORED listings since the last assigned listing
  const closedListings = parkingSpaceListings.filter(
    (listing) =>
      listing.status === ListingStatus.Closed &&
      listing.rentalRule === 'SCORED' &&
      (!lastAssignedListing ||
        (listing.publishedFrom &&
          lastAssignedListing.publishedFrom &&
          new Date(listing.publishedFrom) >
            new Date(lastAssignedListing.publishedFrom)))
  )

  return closedListings.length
}

export const routes = (router: KoaRouter) => {
  router.get('(.*)/rental-objects/vacant-parkingspaces', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    // Run requests in parallel for better performance
    const [vacantParkingSpaces, allListings] = await Promise.all([
      coreAdapter.getVacantParkingSpaces(),
      coreAdapter.getListingsWithApplicants('type=all'),
    ])

    if (!vacantParkingSpaces.ok) {
      ctx.status = vacantParkingSpaces.statusCode
      ctx.body = { error: vacantParkingSpaces.err, ...metadata }
      return
    }

    const allListingsData = allListings.ok ? allListings.data || [] : []

    // Get rental object codes that have active or expired listings (should be excluded)
    const excludedRentalObjectCodes = new Set(
      allListingsData
        .filter(
          (listing) =>
            listing.status === ListingStatus.Active ||
            listing.status === ListingStatus.Expired
        )
        .map((listing) => listing.rentalObjectCode)
    )

    // Filter out parking spaces that have active or expired listings
    const unpublishedVacantParkingSpaces = (
      vacantParkingSpaces.data || []
    ).filter(
      (parkingSpace: RentalObject) =>
        !excludedRentalObjectCodes.has(parkingSpace.rentalObjectCode)
    )

    // Calculate previous listings count since last assigned listing
    const parkingSpacesWithListingHistory: RentalObjectWithListingHistory[] =
      unpublishedVacantParkingSpaces.map((parkingSpace: RentalObject) => ({
        ...parkingSpace,
        previousListingsCount: calculatePreviousListingsCount(
          parkingSpace,
          allListingsData
        ),
      }))

    ctx.status = 200
    ctx.body = {
      content: parkingSpacesWithListingHistory,
      ...metadata,
    }
  })

  router.get('(.*)/rental-objects/by-code/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalObjectCode } = ctx.params

    const result = await coreAdapter.getRentalPropertyByCode(rentalObjectCode)

    if (result.ok) {
      ctx.status = 200
      ctx.body = {
        content: result.data,
        ...metadata,
      }
    } else {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { error: 'Rental object not found', ...metadata }
      } else {
        ctx.status = result.statusCode
        ctx.body = { error: result.err, ...metadata }
      }
    }
  })
}
