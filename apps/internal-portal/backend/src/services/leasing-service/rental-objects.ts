import KoaRouter from '@koa/router'
import * as coreAdapter from './adapters/core-adapter'
import { generateRouteMetadata } from '@onecore/utilities'
import { Listing, RentalObject } from 'libs/types/dist'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/rental-objects/vacant-parkingspaces', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const vacantParkingSpaces = await coreAdapter.getVacantParkingSpaces()
    const publishedListings =
      await coreAdapter.getListingsWithApplicants('type=published')
    const readyForOfferListings = await coreAdapter.getListingsWithApplicants(
      'type=ready-for-offer'
    )
    const offeredListings =
      await coreAdapter.getListingsWithApplicants('type=offered')

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

    ctx.status = 200
    ctx.body = {
      content: unpublishedVacantParkingSpaces,
      ...metadata,
    }
  })
}
