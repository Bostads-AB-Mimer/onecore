import KoaRouter from '@koa/router'
import * as coreAdapter from './adapters/core-adapter'
import { generateRouteMetadata } from '@onecore/utilities'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/rental-objects/vacant-parkingspaces', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const vacantParkingSpaces = await coreAdapter.getVacantParkingSpaces()
    const publishedListings =
      await coreAdapter.getListingsWithApplicants('type=published')

    if (!vacantParkingSpaces.ok) {
      ctx.status = vacantParkingSpaces.statusCode
      ctx.body = { error: vacantParkingSpaces.err, ...metadata }
      return
    }

    const publishedRentalObjectCodesSet = new Set(
      publishedListings.ok
        ? (publishedListings.data || []).map(
            (listing: any) => listing.rentalObjectCode
          )
        : []
    )

    const unpublishedVacantParkingSpaces = (
      vacantParkingSpaces.data || []
    ).filter(
      (parkingSpace: any) =>
        !publishedRentalObjectCodesSet.has(parkingSpace.rentalObjectCode)
    )

    ctx.status = 200
    ctx.body = {
      content: unpublishedVacantParkingSpaces,
      ...metadata,
    }
  })
}
