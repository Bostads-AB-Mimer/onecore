import assert from 'node:assert'
import { ListingStatus, OfferStatus } from 'onecore-types'

import { db, migrate, teardown } from '../../../adapters/db'
import * as listingAdapter from '../../../adapters/listing-adapter'
import * as offerAdapter from '../../../adapters/offer-adapter'
import * as factory from './../../factories'

beforeAll(async () => {
  await migrate()
})

afterEach(async () => {
  await db('offer_applicant').del()
  await db('offer').del()
  await db('applicant').del()
  await db('listing').del()
})

afterAll(async () => {
  await teardown()
})

describe(listingAdapter.getListingsWithApplicants, () => {
  it('returns a formatted list of listings and corresponding applicants', async () => {
    const listing1 = await listingAdapter.createListing(
      factory.listing.build({ rentalObjectCode: '1' })
    )
    const listing2 = await listingAdapter.createListing(
      factory.listing.build({ rentalObjectCode: '2' })
    )
    assert(listing1.ok)
    assert(listing2.ok)
    await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing1.data.id })
    )
    await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing2.data.id })
    )
    const listings = await listingAdapter.getListingsWithApplicants()
    assert(listings.ok)
    const [fst, snd] = listings.data

    expect(fst.applicants).toHaveLength(1)
    expect(fst.applicants?.[0]?.listingId).toBe(fst.id)

    expect(snd.applicants).toHaveLength(1)
    expect(snd.applicants?.[0]?.listingId).toBe(snd.id)
  })

  describe('filtering', () => {
    it('only gets published listings', async () => {
      const publishedListing = await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '1',
          status: ListingStatus.Active,
        })
      )

      const _expiredListing = await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '2',
          status: ListingStatus.Expired,
        })
      )

      assert(publishedListing.ok)
      const listings = await listingAdapter.getListingsWithApplicants({
        by: { type: 'published' },
      })
      assert(listings.ok)

      expect(listings.data).toEqual([
        expect.objectContaining({ id: publishedListing.data.id }),
      ])
    })

    it('only gets ready-for-offer listings', async () => {
      const listingWithoutOffer = await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '1',
          status: ListingStatus.Expired,
        })
      )

      assert(listingWithoutOffer.ok)
      const listingWithOffer = await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '2',
          status: ListingStatus.Expired,
        })
      )

      assert(listingWithOffer.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listingWithOffer.data.id })
      )

      const expiredListingOffer = await offerAdapter.create(db, {
        applicantId: applicant.id,
        expiresAt: new Date(),
        listingId: listingWithOffer.data.id,
        status: OfferStatus.Active,
        selectedApplicants: [
          factory.offerApplicant.build({
            applicantId: applicant.id,
            listingId: listingWithOffer.data.id,
          }),
        ],
      })

      assert(expiredListingOffer.ok)

      const listings = await listingAdapter.getListingsWithApplicants({
        by: { type: 'ready-for-offer' },
      })
      assert(listings.ok)

      expect(listings.data).toEqual([
        expect.objectContaining({ id: listingWithoutOffer.data.id }),
      ])
    })

    it('only gets offered listings', async () => {
      const listingWithoutOffer = await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '1',
          status: ListingStatus.Expired,
        })
      )

      assert(listingWithoutOffer.ok)
      const listingWithOffer = await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '2',
          status: ListingStatus.Expired,
        })
      )

      assert(listingWithOffer.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listingWithOffer.data.id })
      )

      const expiredListingOffer = await offerAdapter.create(db, {
        applicantId: applicant.id,
        expiresAt: new Date(),
        listingId: listingWithOffer.data.id,
        status: OfferStatus.Active,
        selectedApplicants: [
          factory.offerApplicant.build({
            applicantId: applicant.id,
            listingId: listingWithOffer.data.id,
          }),
        ],
      })

      assert(expiredListingOffer.ok)

      const listings = await listingAdapter.getListingsWithApplicants({
        by: { type: 'offered' },
      })
      assert(listings.ok)

      expect(listings.data).toEqual([
        expect.objectContaining({ id: listingWithOffer.data.id }),
      ])
    })

    it('only gets historical listings', async () => {
      const activeListing = await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '1',
          status: ListingStatus.Active,
        })
      )

      assert(activeListing.ok)
      const historicalListing = await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '2',
          status: ListingStatus.Assigned,
        })
      )

      assert(historicalListing.ok)

      const listings = await listingAdapter.getListingsWithApplicants({
        by: { type: 'historical' },
      })
      assert(listings.ok)

      expect(listings.data).toEqual([
        expect.objectContaining({ id: historicalListing.data.id }),
      ])
    })
  })
})
