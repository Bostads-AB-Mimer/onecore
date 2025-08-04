import assert from 'node:assert'

import * as listingAdapter from '../../../adapters/listing-adapter'
import * as factory from '../../factories'
import { withContext } from '../../testUtils'

describe(listingAdapter.deleteListing, () => {
  it('does not delete if listing has applicants', () =>
    withContext(async (ctx) => {
      const listing = await listingAdapter.createListing(
        factory.listing.build(),
        ctx.db
      )
      assert(listing.ok)

      await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id }),
        ctx.db
      )

      const deletion = await listingAdapter.deleteListing(
        listing.data.id,
        ctx.db
      )
      const deletedListing = await listingAdapter.getListingById(
        listing.data.id,
        ctx.db
      )

      expect(deletion).toEqual({ ok: false, err: 'conflict' })
      expect(deletedListing).not.toBe(undefined)
    }))

  it('deletes if there are no other entities relying on it', () =>
    withContext(async (ctx) => {
      const listing = await listingAdapter.createListing(
        factory.listing.build(),
        ctx.db
      )
      assert(listing.ok)

      const deletion = await listingAdapter.deleteListing(
        listing.data.id,
        ctx.db
      )
      const deletedListing = await listingAdapter.getListingById(
        listing.data.id,
        ctx.db
      )

      expect(deletion).toMatchObject({ ok: true })
      expect(deletedListing).toBe(undefined)
    }))

  it('only deletes one', () =>
    withContext(async (ctx) => {
      const listing_1 = await listingAdapter.createListing(
        factory.listing.build(),
        ctx.db
      )
      const listing_2 = await listingAdapter.createListing(
        factory.listing.build(),
        ctx.db
      )
      assert(listing_1.ok)
      assert(listing_2.ok)

      const deletion = await listingAdapter.deleteListing(
        listing_1.data.id,
        ctx.db
      )
      const remainingListings = await listingAdapter.getListingsWithApplicants(
        ctx.db
      )
      assert(remainingListings.ok)

      expect(deletion).toMatchObject({ ok: true })
      expect(remainingListings.data).toHaveLength(1)
    }))
})
