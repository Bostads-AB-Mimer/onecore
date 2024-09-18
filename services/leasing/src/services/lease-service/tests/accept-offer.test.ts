import { ApplicantStatus, ListingStatus, OfferStatus } from 'onecore-types'
import assert from 'node:assert'

import * as factory from './factories'
import * as listingAdapter from '../adapters/listing-adapter'
import * as offerAdapter from '../adapters/offer-adapter'
import { db, migrate, teardown } from '../adapters/db'
import * as service from '../accept-offer'

beforeAll(migrate)

beforeEach(async () => {
  await db('offer').del()
  await db('applicant').del()
  await db('listing').del()
})

afterAll(teardown)

afterEach(jest.restoreAllMocks)

describe('acceptOffer', () => {
  it('returns gracefully if listing update fails', async () => {
    const updateListingStatusSpy = jest.spyOn(
      listingAdapter,
      'updateListingStatuses'
    )

    updateListingStatusSpy.mockRejectedValueOnce({ err: 'error' })
    const listing = await listingAdapter.createListing(
      factory.listing.build({ status: ListingStatus.Expired })
    )
    assert(listing.ok)
    const applicant = await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing.data.id })
    )

    const offer = await offerAdapter.create({
      status: OfferStatus.Active,
      listingId: listing.data.id,
      applicantId: applicant.id,
      selectedApplicants: [],
      expiresAt: new Date(),
    })

    const res = await service.acceptOffer({
      applicantId: applicant.id,
      listingId: listing.data.id,
      offerId: offer.id,
    })

    expect(updateListingStatusSpy).toHaveBeenCalled()
    expect(res).toEqual({ ok: false, err: 'update-listing' })
  })

  it('rollbacks listing status change if update applicant fails', async () => {
    const updateApplicantStatusSpy = jest.spyOn(
      listingAdapter,
      'updateApplicantStatus'
    )

    const listing = await listingAdapter.createListing(
      factory.listing.build({ status: ListingStatus.Expired })
    )
    assert(listing.ok)
    const applicant = await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing.data.id })
    )

    const offer = await offerAdapter.create({
      status: OfferStatus.Active,
      listingId: listing.data.id,
      applicantId: applicant.id,
      selectedApplicants: [],
      expiresAt: new Date(),
    })

    updateApplicantStatusSpy.mockRejectedValueOnce({ err: 'error' })
    const res = await service.acceptOffer({
      applicantId: applicant.id,
      listingId: listing.data.id,
      offerId: offer.id,
    })

    expect(updateApplicantStatusSpy).toHaveBeenCalled()
    expect(res).toEqual({ ok: false, err: 'update-applicant' })

    const listingFromDB = await listingAdapter.getListingById(listing.data.id)
    expect(listingFromDB?.status).toBe(listing.data.status)
  })

  it('rollbacks listing status change and applicant status change if update offer fails', async () => {
    const updateOfferSpy = jest.spyOn(offerAdapter, 'updateOfferStatus')
    const listing = await listingAdapter.createListing(
      factory.listing.build({ status: ListingStatus.Expired })
    )
    assert(listing.ok)
    const applicant = await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing.data.id })
    )

    const offer = await offerAdapter.create({
      status: OfferStatus.Active,
      listingId: listing.data.id,
      applicantId: applicant.id,
      selectedApplicants: [],
      expiresAt: new Date(),
    })

    updateOfferSpy.mockResolvedValueOnce({ ok: false, err: 'unknown' })
    const res = await service.acceptOffer({
      applicantId: applicant.id,
      listingId: listing.data.id,
      offerId: offer.id,
    })

    expect(updateOfferSpy).toHaveBeenCalled()
    expect(res).toEqual({ ok: false, err: 'update-offer' })

    const listingFromDB = await listingAdapter.getListingById(listing.data.id)
    const applicantFromDB = await listingAdapter.getApplicantById(applicant.id)
    expect(listingFromDB?.status).toBe(listing.data.status)
    expect(applicantFromDB?.status).toBe(applicant?.status)
  })

  it('updates listing, applicant and offer', async () => {
    const updateListingStatusSpy = jest.spyOn(
      listingAdapter,
      'updateListingStatuses'
    )

    const updateApplicantStatusSpy = jest.spyOn(
      listingAdapter,
      'updateApplicantStatus'
    )

    const updateOfferSpy = jest.spyOn(offerAdapter, 'updateOfferStatus')
    const listing = await listingAdapter.createListing(
      factory.listing.build({ status: ListingStatus.Expired })
    )
    assert(listing.ok)
    const applicant = await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing.data.id })
    )

    const offer = await offerAdapter.create({
      status: OfferStatus.Active,
      listingId: listing.data.id,
      applicantId: applicant.id,
      selectedApplicants: [],
      expiresAt: new Date(),
    })

    const res = await service.acceptOffer({
      applicantId: applicant.id,
      listingId: listing.data.id,
      offerId: offer.id,
    })

    expect(updateListingStatusSpy).toHaveBeenCalled()
    expect(updateApplicantStatusSpy).toHaveBeenCalled()
    expect(updateOfferSpy).toHaveBeenCalled()
    expect(res).toEqual({ ok: true, data: null })

    const updatedListing = await listingAdapter.getListingById(listing.data.id)
    const updatedApplicant = await listingAdapter.getApplicantById(applicant.id)
    const updatedOffer = await offerAdapter.getOfferByOfferId(offer.id)
    assert(updatedOffer.ok)

    expect(updatedListing?.status).toBe(ListingStatus.Assigned)
    expect(updatedApplicant?.status).toBe(ApplicantStatus.OfferAccepted)
    // TODO: Offer status is incorrectly a string because of db column type!!
    expect(Number(updatedOffer.data.status)).toBe(OfferStatus.Accepted)
  })
})
