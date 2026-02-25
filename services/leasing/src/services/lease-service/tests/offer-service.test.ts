import { ApplicantStatus, ListingStatus, OfferStatus } from '@onecore/types'
import assert from 'node:assert'

import * as factory from './factories'
import * as listingAdapter from '../adapters/listing-adapter'
import * as offerAdapter from '../adapters/offer-adapter'
import * as service from '../offer-service'
import { withContext } from './testUtils'

afterEach(jest.restoreAllMocks)

describe('acceptOffer', () => {
  it('returns gracefully if listing update fails', () =>
    withContext(async (ctx) => {
      const updateListingStatusSpy = jest.spyOn(
        listingAdapter,
        'updateListingStatuses'
      )

      updateListingStatusSpy.mockResolvedValueOnce({
        ok: false,
        err: 'unknown',
      })
      const listing = await listingAdapter.createListing(
        factory.listing.build({ status: ListingStatus.Expired }),
        ctx.db
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id }),
        ctx.db
      )

      const offer = await offerAdapter.create(ctx.db, {
        status: OfferStatus.Active,
        listingId: listing.data.id,
        applicantId: applicant.id,
        selectedApplicants: [
          factory.offerApplicant.build({ applicantId: applicant.id }),
        ],
        expiresAt: new Date(),
        sentAt: new Date(),
      })

      assert(offer.ok)

      const res = await service.acceptOffer(ctx.db, {
        applicantId: applicant.id,
        listingId: listing.data.id,
        offerId: offer.data.id,
      })

      expect(updateListingStatusSpy).toHaveBeenCalled()
      expect(res).toEqual({ ok: false, err: 'update-listing' })
    }))

  it('rollbacks listing status change if update applicant fails', () =>
    withContext(async (ctx) => {
      const updateApplicantStatusSpy = jest.spyOn(
        listingAdapter,
        'updateApplicantStatus'
      )

      const listing = await listingAdapter.createListing(
        factory.listing.build({ status: ListingStatus.Expired }),
        ctx.db
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id }),
        ctx.db
      )

      const offer = await offerAdapter.create(ctx.db, {
        status: OfferStatus.Active,
        listingId: listing.data.id,
        applicantId: applicant.id,
        selectedApplicants: [
          factory.offerApplicant.build({ applicantId: applicant.id }),
        ],
        expiresAt: new Date(),
        sentAt: new Date(),
      })

      updateApplicantStatusSpy.mockResolvedValueOnce({
        ok: false,
        err: 'unknown',
      })

      assert(offer.ok)

      const res = await service.acceptOffer(ctx.db, {
        applicantId: applicant.id,
        listingId: listing.data.id,
        offerId: offer.data.id,
      })

      expect(updateApplicantStatusSpy).toHaveBeenCalled()
      expect(res).toEqual({ ok: false, err: 'update-applicant' })

      const listingFromDB = await listingAdapter.getListingById(
        listing.data.id,
        ctx.db
      )
      expect(listingFromDB?.status).toBe(listing.data.status)
    }))

  it('rollbacks listing status change and applicant status change if update offer fails', () =>
    withContext(async (ctx) => {
      const updateOfferSpy = jest.spyOn(
        offerAdapter,
        'updateOfferAnsweredStatus'
      )
      const listing = await listingAdapter.createListing(
        factory.listing.build({ status: ListingStatus.Expired }),
        ctx.db
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id }),
        ctx.db
      )

      const offer = await offerAdapter.create(ctx.db, {
        status: OfferStatus.Active,
        listingId: listing.data.id,
        applicantId: applicant.id,
        selectedApplicants: [
          factory.offerApplicant.build({ applicantId: applicant.id }),
        ],
        expiresAt: new Date(),
        sentAt: new Date(),
      })

      updateOfferSpy.mockResolvedValueOnce({ ok: false, err: 'unknown' })

      assert(offer.ok)

      const res = await service.acceptOffer(ctx.db, {
        applicantId: applicant.id,
        listingId: listing.data.id,
        offerId: offer.data.id,
      })

      expect(updateOfferSpy).toHaveBeenCalled()
      expect(res).toEqual({ ok: false, err: 'update-offer' })

      const listingFromDB = await listingAdapter.getListingById(
        listing.data.id,
        ctx.db
      )
      const applicantFromDB = await listingAdapter.getApplicantById(
        applicant.id,
        ctx.db
      )
      expect(listingFromDB?.status).toBe(listing.data.status)
      expect(applicantFromDB?.status).toBe(applicant?.status)
    }))

  it('updates listing, applicant and offer', () =>
    withContext(async (ctx) => {
      const updateListingStatusSpy = jest.spyOn(
        listingAdapter,
        'updateListingStatuses'
      )

      const updateApplicantStatusSpy = jest.spyOn(
        listingAdapter,
        'updateApplicantStatus'
      )

      const updateOfferSpy = jest.spyOn(
        offerAdapter,
        'updateOfferAnsweredStatus'
      )
      const listing = await listingAdapter.createListing(
        factory.listing.build({ status: ListingStatus.Expired }),
        ctx.db
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id }),
        ctx.db
      )

      const offer = await offerAdapter.create(ctx.db, {
        status: OfferStatus.Active,
        listingId: listing.data.id,
        applicantId: applicant.id,
        selectedApplicants: [
          factory.offerApplicant.build({ applicantId: applicant.id }),
        ],
        expiresAt: new Date(),
        sentAt: new Date(),
      })

      assert(offer.ok)

      const res = await service.acceptOffer(ctx.db, {
        applicantId: applicant.id,
        listingId: listing.data.id,
        offerId: offer.data.id,
      })

      expect(updateListingStatusSpy).toHaveBeenCalled()
      expect(updateApplicantStatusSpy).toHaveBeenCalled()
      expect(updateOfferSpy).toHaveBeenCalled()
      expect(res).toEqual({ ok: true, data: null })

      assert(offer.ok)

      const updatedListing = await listingAdapter.getListingById(
        listing.data.id,
        ctx.db
      )
      const updatedApplicant = await listingAdapter.getApplicantById(
        applicant.id,
        ctx.db
      )
      const updatedOffer = await offerAdapter.getOfferByOfferId(
        offer.data.id,
        ctx.db
      )
      assert(updatedOffer.ok)

      expect(updatedListing?.status).toBe(ListingStatus.Assigned)
      expect(updatedApplicant?.status).toBe(ApplicantStatus.OfferAccepted)
      expect(Number(updatedOffer.data.status)).toBe(OfferStatus.Accepted)
    }))

  it('updates offer applicant', () =>
    withContext(async (ctx) => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ status: ListingStatus.Expired }),
        ctx.db
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id }),
        ctx.db
      )

      const initialApplicantStatus = ApplicantStatus.Active
      const offeredApplicant = factory.offerApplicant.build({
        status: initialApplicantStatus,
        applicantId: applicant.id,
      })
      const offer = await offerAdapter.create(ctx.db, {
        status: OfferStatus.Active,
        listingId: listing.data.id,
        applicantId: applicant.id,
        selectedApplicants: [offeredApplicant],
        expiresAt: new Date(),
        sentAt: new Date(),
      })

      assert(offer.ok)

      const [offerApplicantInDbBeforeAccept] = await ctx.db('offer_applicant')

      expect(offerApplicantInDbBeforeAccept.applicantStatus).toEqual(
        initialApplicantStatus
      )

      const res = await service.acceptOffer(ctx.db, {
        applicantId: applicant.id,
        listingId: listing.data.id,
        offerId: offer.data.id,
      })

      expect(res.ok).toBe(true)
      const [offerApplicantInDbAfterAccept] = await ctx.db('offer_applicant')

      expect(offerApplicantInDbAfterAccept.applicantStatus).toEqual(
        ApplicantStatus.OfferAccepted
      )
    }))
})

describe('denyOffer', () => {
  it('returns gracefully if offer update fails', () =>
    withContext(async (ctx) => {
      const updateOfferStatusSpy = jest.spyOn(
        offerAdapter,
        'updateOfferAnsweredStatus'
      )

      updateOfferStatusSpy.mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const listing = await listingAdapter.createListing(
        factory.listing.build({ status: ListingStatus.Expired }),
        ctx.db
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id }),
        ctx.db
      )

      const offer = await offerAdapter.create(ctx.db, {
        status: OfferStatus.Active,
        listingId: listing.data.id,
        applicantId: applicant.id,
        selectedApplicants: [
          factory.offerApplicant.build({ applicantId: applicant.id }),
        ],
        expiresAt: new Date(),
        sentAt: new Date(),
      })
      assert(offer.ok)

      const res = await service.denyOffer(ctx.db, {
        applicantId: applicant.id,
        offerId: offer.data.id,
        listingId: listing.data.id,
      })

      expect(updateOfferStatusSpy).toHaveBeenCalled()
      expect(res).toEqual({ ok: false, err: 'update-offer' })
    }))

  it('rollbacks applicant status change if update offer fails', () =>
    withContext(async (ctx) => {
      const updateOfferStatusSpy = jest.spyOn(
        offerAdapter,
        'updateOfferAnsweredStatus'
      )

      const listing = await listingAdapter.createListing(
        factory.listing.build({ status: ListingStatus.Expired }),
        ctx.db
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id }),
        ctx.db
      )

      const offer = await offerAdapter.create(ctx.db, {
        status: OfferStatus.Active,
        listingId: listing.data.id,
        applicantId: applicant.id,
        selectedApplicants: [
          factory.offerApplicant.build({ applicantId: applicant.id }),
        ],
        expiresAt: new Date(),
        sentAt: new Date(),
      })

      assert(offer.ok)
      updateOfferStatusSpy.mockResolvedValueOnce({ ok: false, err: 'unknown' })
      const res = await service.denyOffer(ctx.db, {
        applicantId: applicant.id,
        offerId: offer.data.id,
        listingId: listing.data.id,
      })

      expect(updateOfferStatusSpy).toHaveBeenCalled()
      expect(res).toEqual({ ok: false, err: 'update-offer' })

      const applicantFromDb = await listingAdapter.getApplicantById(
        applicant.id,
        ctx.db
      )
      expect(applicantFromDb?.status).toBe(applicant.status)
    }))

  it('updates applicant and offer', () =>
    withContext(async (ctx) => {
      const updateApplicantStatusSpy = jest.spyOn(
        listingAdapter,
        'updateApplicantStatus'
      )

      const updateOfferSpy = jest.spyOn(
        offerAdapter,
        'updateOfferAnsweredStatus'
      )
      const listing = await listingAdapter.createListing(
        factory.listing.build({ status: ListingStatus.Expired }),
        ctx.db
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id }),
        ctx.db
      )

      const offer = await offerAdapter.create(ctx.db, {
        status: OfferStatus.Active,
        listingId: listing.data.id,
        applicantId: applicant.id,
        selectedApplicants: [
          factory.offerApplicant.build({ applicantId: applicant.id }),
        ],
        expiresAt: new Date(),
        sentAt: new Date(),
      })

      assert(offer.ok)

      const res = await service.denyOffer(ctx.db, {
        applicantId: applicant.id,
        offerId: offer.data.id,
        listingId: listing.data.id,
      })

      expect(updateApplicantStatusSpy).toHaveBeenCalled()
      expect(updateOfferSpy).toHaveBeenCalled()
      expect(res).toEqual({ ok: true, data: null })

      const updatedApplicant = await listingAdapter.getApplicantById(
        applicant.id,
        ctx.db
      )
      const updatedOffer = await offerAdapter.getOfferByOfferId(
        offer.data.id,
        ctx.db
      )
      assert(updatedOffer.ok)

      expect(updatedApplicant?.status).toBe(ApplicantStatus.OfferDeclined)
      expect(updatedOffer.data.status).toBe(OfferStatus.Declined)
    }))

  it('updates offer applicant', () =>
    withContext(async (ctx) => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ status: ListingStatus.Expired }),
        ctx.db
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id }),
        ctx.db
      )

      const initialApplicantStatus = ApplicantStatus.Active
      const offeredApplicant = factory.offerApplicant.build({
        status: initialApplicantStatus,
        applicantId: applicant.id,
      })
      const offer = await offerAdapter.create(ctx.db, {
        status: OfferStatus.Active,
        listingId: listing.data.id,
        applicantId: applicant.id,
        selectedApplicants: [offeredApplicant],
        expiresAt: new Date(),
        sentAt: new Date(),
      })

      assert(offer.ok)

      const [offerApplicantInDbBeforeAccept] = await ctx.db('offer_applicant')

      expect(offerApplicantInDbBeforeAccept.applicantStatus).toEqual(
        initialApplicantStatus
      )

      const res = await service.denyOffer(ctx.db, {
        applicantId: applicant.id,
        listingId: listing.data.id,
        offerId: offer.data.id,
      })

      expect(res.ok).toBe(true)
      const [offerApplicantInDbAfterAccept] = await ctx.db('offer_applicant')

      expect(offerApplicantInDbAfterAccept.applicantStatus).toEqual(
        ApplicantStatus.OfferDeclined
      )
    }))
})
