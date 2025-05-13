import { ListingStatus } from 'onecore-types'

import * as listingAdapter from '../../../adapters/listing-adapter'
import * as factory from '../../factories'
import { withContext } from '../../testUtils'

describe(listingAdapter.getListings, () => {
  it('should filter on published', () =>
    withContext(async (ctx) => {
      const today = new Date()
      const oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const threeDaysFromNow = new Date(
        today.getTime() + 3 * 24 * 60 * 60 * 1000
      )
      const fiveDaysFromNow = new Date(
        today.getTime() + 5 * 24 * 60 * 60 * 1000
      )

      // matching publish dates and status
      await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '1',
          publishedFrom: oneDayAgo,
          publishedTo: threeDaysFromNow,
          status: ListingStatus.Active,
        }),
        ctx.db
      )

      //matching publish dates only
      await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '2',
          publishedFrom: oneDayAgo,
          publishedTo: threeDaysFromNow,
          status: ListingStatus.Closed,
        }),
        ctx.db
      )

      //matching status only
      await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '2',
          publishedFrom: threeDaysFromNow,
          publishedTo: fiveDaysFromNow,
          status: ListingStatus.Active,
        }),
        ctx.db
      )

      const result = await listingAdapter.getListings(true, undefined, ctx.db)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].rentalObjectCode).toEqual('1')
      }
    }))

  it('should filter on rentalRule', () =>
    withContext(async (ctx) => {
      // Create listings
      await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '1',
          waitingListType: 'Scored',
          status: ListingStatus.Active,
        }),
        ctx.db
      )

      await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '2',
          waitingListType: 'NonScored',
          status: ListingStatus.Active,
        }),
        ctx.db
      )

      const result = await listingAdapter.getListings(
        undefined,
        'Scored',
        ctx.db
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].rentalObjectCode).toEqual('1')
      }
    }))

  it('should return a list of listings', () =>
    withContext(async (ctx) => {
      // Create listings
      await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '1',
          status: ListingStatus.Active,
        }),
        ctx.db
      )

      await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '2',
          status: ListingStatus.Closed,
        }),
        ctx.db
      )

      const result = await listingAdapter.getListings(
        undefined,
        undefined,
        ctx.db
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(2)
        expect(result.data.map((listing) => listing.rentalObjectCode)).toEqual(
          expect.arrayContaining(['1', '2'])
        )
      }
    }))
})
