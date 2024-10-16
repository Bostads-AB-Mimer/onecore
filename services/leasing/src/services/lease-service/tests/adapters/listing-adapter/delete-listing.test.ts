import assert from 'node:assert'

import { migrate, db, teardown } from '../../../adapters/db'
import * as listingAdapter from '../../../adapters/listing-adapter'
import * as factory from '../../factories'

beforeAll(migrate)
afterEach(async () => {
  await db('applicant').del()
  await db('listing').del()
})
afterAll(teardown)

describe(listingAdapter.deleteListing, () => {
  it('does not delete if listing has applicants', async () => {
    const listing = await listingAdapter.createListing(factory.listing.build())
    assert(listing.ok)

    await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing.data.id })
    )

    const deletion = await listingAdapter.deleteListing(listing.data.id)
    const deletedListing = await listingAdapter.getListingById(listing.data.id)

    expect(deletion).toEqual({ ok: false, err: 'conflict' })
    expect(deletedListing).not.toBe(undefined)
  })

  it('deletes if there are no other entities relying on it', async () => {
    const listing = await listingAdapter.createListing(factory.listing.build())
    assert(listing.ok)

    const deletion = await listingAdapter.deleteListing(listing.data.id)
    const deletedListing = await listingAdapter.getListingById(listing.data.id)

    expect(deletion).toMatchObject({ ok: true })
    expect(deletedListing).toBe(undefined)
  })

  it('only deletes one', async () => {
    const listing_1 = await listingAdapter.createListing(
      factory.listing.build()
    )
    const listing_2 = await listingAdapter.createListing(
      factory.listing.build()
    )
    assert(listing_1.ok)
    assert(listing_2.ok)

    const deletion = await listingAdapter.deleteListing(listing_1.data.id)
    const remainingListings = await listingAdapter.getListingsWithApplicants()
    assert(remainingListings.ok)

    expect(deletion).toMatchObject({ ok: true })
    expect(remainingListings.data).toHaveLength(1)
  })
})
