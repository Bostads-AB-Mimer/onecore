import assert from 'node:assert'
import { ApplicantStatus, ListingStatus, OfferStatus } from '@onecore/types'

import * as listingAdapter from '../../../adapters/listing-adapter'
import * as offerAdapter from '../../../adapters/offer-adapter'
import * as factory from './../../factories'
import { withContext } from '../../testUtils'

describe(listingAdapter.getListingsWithApplicants, () => {
  it('returns a formatted list of listings and corresponding applicants', () =>
    withContext(async (ctx) => {
      const listing1 = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' }),
        ctx.db
      )
      const listing2 = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '2' }),
        ctx.db
      )
      assert(listing1.ok)
      assert(listing2.ok)
      await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing1.data.id }),
        ctx.db
      )
      await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing2.data.id }),
        ctx.db
      )
      const listings = await listingAdapter.getListingsWithApplicants(ctx.db)
      assert(listings.ok)
      const [fst, snd] = listings.data

      expect(fst.applicants).toHaveLength(1)
      expect(fst.applicants?.[0]?.listingId).toBe(fst.id)

      expect(snd.applicants).toHaveLength(1)
      expect(snd.applicants?.[0]?.listingId).toBe(snd.id)
    }))

  describe('filtering', () => {
    it('only gets published listings', () =>
      withContext(async (ctx) => {
        const publishedListing = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '1',
            status: ListingStatus.Active,
          }),
          ctx.db
        )

        await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '2',
            status: ListingStatus.Expired,
          }),
          ctx.db
        )

        assert(publishedListing.ok)
        const listings = await listingAdapter.getListingsWithApplicants(
          ctx.db,
          {
            by: { type: 'published' },
          }
        )
        assert(listings.ok)

        expect(listings.data).toEqual([
          expect.objectContaining({ id: publishedListing.data.id }),
        ])
      }))

    it('only gets ready-for-offer listings', () =>
      withContext(async (ctx) => {
        const listingWithoutOffer = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '1',
            status: ListingStatus.Expired,
          }),
          ctx.db
        )

        assert(listingWithoutOffer.ok)
        const listingWithOffer = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '2',
            status: ListingStatus.Expired,
          }),
          ctx.db
        )

        assert(listingWithOffer.ok)
        const applicant = await listingAdapter.createApplication(
          factory.applicant.build({ listingId: listingWithoutOffer.data.id }),
          ctx.db
        )

        const expiredListingOffer = await offerAdapter.create(ctx.db, {
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

        const listings = await listingAdapter.getListingsWithApplicants(
          ctx.db,
          {
            by: { type: 'ready-for-offer' },
          }
        )
        assert(listings.ok)

        expect(listings.data).toEqual([
          expect.objectContaining({ id: listingWithoutOffer.data.id }),
        ])
      }))

    it('ready-for-offer listings has applicants', () =>
      withContext(async (ctx) => {
        const listingWithApplicants = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '1',
            status: ListingStatus.Expired,
          }),
          ctx.db
        )

        assert(listingWithApplicants.ok)
        const listingWithoutApplicants = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '2',
            status: ListingStatus.Expired,
          }),
          ctx.db
        )

        assert(listingWithoutApplicants.ok)
        const applicant = await listingAdapter.createApplication(
          factory.applicant.build({ listingId: listingWithApplicants.data.id }),
          ctx.db
        )

        assert(applicant)

        const listings = await listingAdapter.getListingsWithApplicants(
          ctx.db,
          {
            by: { type: 'ready-for-offer' },
          }
        )

        assert(listings.ok)

        expect(listings.data).toEqual([
          expect.objectContaining({ id: listingWithApplicants.data.id }),
        ])
      }))

    it('only gets offered listings', () =>
      withContext(async (ctx) => {
        const listingWithoutOffer = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '1',
            status: ListingStatus.Expired,
          }),
          ctx.db
        )

        assert(listingWithoutOffer.ok)
        const listingWithOffer = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '2',
            status: ListingStatus.Expired,
          }),
          ctx.db
        )

        assert(listingWithOffer.ok)
        const applicant = await listingAdapter.createApplication(
          factory.applicant.build({ listingId: listingWithOffer.data.id }),
          ctx.db
        )

        const expiredListingOffer = await offerAdapter.create(ctx.db, {
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

        const listings = await listingAdapter.getListingsWithApplicants(
          ctx.db,
          {
            by: { type: 'offered' },
          }
        )
        assert(listings.ok)

        expect(listings.data).toEqual([
          expect.objectContaining({ id: listingWithOffer.data.id }),
        ])
      }))

    it('offered listings has active offer', () =>
      withContext(async (ctx) => {
        const listingWithExpiredOffer = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '1',
            status: ListingStatus.Expired,
          }),
          ctx.db
        )
        assert(listingWithExpiredOffer.ok)

        const listingWithActiveOffer = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '2',
            status: ListingStatus.Expired,
          }),
          ctx.db
        )
        assert(listingWithActiveOffer.ok)

        const applicant = await listingAdapter.createApplication(
          factory.applicant.build({
            listingId: listingWithActiveOffer.data.id,
          }),
          ctx.db
        )

        const expiredOffer = await offerAdapter.create(ctx.db, {
          applicantId: applicant.id,
          expiresAt: new Date('1970-01-01'),
          listingId: listingWithExpiredOffer.data.id,
          status: OfferStatus.Expired,
          selectedApplicants: [
            factory.offerApplicant.build({
              applicantId: applicant.id,
              listingId: listingWithExpiredOffer.data.id,
            }),
          ],
        })

        const activeOffer = await offerAdapter.create(ctx.db, {
          applicantId: applicant.id,
          expiresAt: new Date(),
          listingId: listingWithActiveOffer.data.id,
          status: OfferStatus.Active,
          selectedApplicants: [
            factory.offerApplicant.build({
              applicantId: applicant.id,
              listingId: listingWithActiveOffer.data.id,
            }),
          ],
        })

        assert(expiredOffer.ok)
        assert(activeOffer.ok)

        const listings = await listingAdapter.getListingsWithApplicants(
          ctx.db,
          {
            by: { type: 'offered' },
          }
        )
        assert(listings.ok)

        expect(listings.data).toEqual([
          expect.objectContaining({ id: listingWithActiveOffer.data.id }),
        ])
      }))

    it('only gets historical listings', () =>
      withContext(async (ctx) => {
        const activeListing = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '1',
            status: ListingStatus.Active,
          }),
          ctx.db
        )

        assert(activeListing.ok)
        const assignedListing = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '2',
            status: ListingStatus.Assigned,
          }),
          ctx.db
        )

        assert(assignedListing.ok)
        await listingAdapter.createApplication(
          factory.applicant.build({ listingId: assignedListing.data.id }),
          ctx.db
        )

        const closedListing = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '2',
            status: ListingStatus.Closed,
          }),
          ctx.db
        )

        assert(closedListing.ok)
        await listingAdapter.createApplication(
          factory.applicant.build({ listingId: closedListing.data.id }),
          ctx.db
        )

        const listings = await listingAdapter.getListingsWithApplicants(
          ctx.db,
          {
            by: { type: 'historical' },
          }
        )
        assert(listings.ok)
        expect(listings.data).toEqual([
          expect.objectContaining({ id: assignedListing.data.id }),
          expect.objectContaining({ id: closedListing.data.id }),
        ])
      }))

    it('only gets closed listings', () =>
      withContext(async (ctx) => {
        const activeListing = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '1',
            status: ListingStatus.Active,
          }),
          ctx.db
        )

        assert(activeListing.ok)
        const closedListing = await listingAdapter.createListing(
          factory.listing.build({
            rentalObjectCode: '2',
            status: ListingStatus.Closed,
          }),
          ctx.db
        )

        assert(closedListing.ok)

        const listings = await listingAdapter.getListingsWithApplicants(
          ctx.db,
          {
            by: { type: 'closed' },
          }
        )

        assert(listings.ok)

        expect(listings.data).toEqual([
          expect.objectContaining({ id: closedListing.data.id }),
        ])
      }))
  })
})
