import { ApplicantStatus, ListingStatus, OfferStatus } from 'onecore-types'
import assert from 'node:assert'

import * as factory from './factories'
import * as listingAdapter from '../adapters/listing-adapter'
import * as offerAdapter from '../adapters/offer-adapter'
import { db, migrate, teardown } from '../adapters/db'
import * as service from '../offer-service'

beforeAll(async () => {
  await migrate()
})

beforeEach(async () => {
  await db('offer_applicant').del()
  await db('offer').del()
  await db('applicant').del()
  await db('listing').del()
})

afterAll(async () => {
  await teardown()
})

afterEach(jest.restoreAllMocks)

describe('acceptOffer', () => {
  it('returns gracefully if listing update fails', async () => {
    const updateListingStatusSpy = jest.spyOn(
      listingAdapter,
      'updateListingStatuses'
    )

    updateListingStatusSpy.mockResolvedValueOnce({ ok: false, err: 'unknown' })
    const listing = await listingAdapter.createListing(
      factory.listing.build({ status: ListingStatus.Expired })
    )
    assert(listing.ok)
    const applicant = await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing.data.id })
    )

    const offer = await offerAdapter.create(db, {
      status: OfferStatus.Active,
      listingId: listing.data.id,
      applicantId: applicant.id,
      selectedApplicants: [
        factory.offerApplicant.build({ applicantId: applicant.id }),
      ],
      expiresAt: new Date(),
    })

    assert(offer.ok)

    const res = await service.acceptOffer({
      applicantId: applicant.id,
      listingId: listing.data.id,
      offerId: offer.data.id,
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

    const offer = await offerAdapter.create(db, {
      status: OfferStatus.Active,
      listingId: listing.data.id,
      applicantId: applicant.id,
      selectedApplicants: [
        factory.offerApplicant.build({ applicantId: applicant.id }),
      ],
      expiresAt: new Date(),
    })

    updateApplicantStatusSpy.mockResolvedValueOnce({
      ok: false,
      err: 'unknown',
    })

    assert(offer.ok)

    const res = await service.acceptOffer({
      applicantId: applicant.id,
      listingId: listing.data.id,
      offerId: offer.data.id,
    })

    expect(updateApplicantStatusSpy).toHaveBeenCalled()
    expect(res).toEqual({ ok: false, err: 'update-applicant' })

    const listingFromDB = await listingAdapter.getListingById(listing.data.id)
    expect(listingFromDB?.status).toBe(listing.data.status)
  })

  it('rollbacks listing status change and applicant status change if update offer fails', async () => {
    const updateOfferSpy = jest.spyOn(offerAdapter, 'updateOfferAnsweredStatus')
    const listing = await listingAdapter.createListing(
      factory.listing.build({ status: ListingStatus.Expired })
    )
    assert(listing.ok)
    const applicant = await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing.data.id })
    )

    const offer = await offerAdapter.create(db, {
      status: OfferStatus.Active,
      listingId: listing.data.id,
      applicantId: applicant.id,
      selectedApplicants: [
        factory.offerApplicant.build({ applicantId: applicant.id }),
      ],
      expiresAt: new Date(),
    })

    updateOfferSpy.mockResolvedValueOnce({ ok: false, err: 'unknown' })

    assert(offer.ok)

    const res = await service.acceptOffer({
      applicantId: applicant.id,
      listingId: listing.data.id,
      offerId: offer.data.id,
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

    const updateOfferSpy = jest.spyOn(offerAdapter, 'updateOfferAnsweredStatus')
    const listing = await listingAdapter.createListing(
      factory.listing.build({ status: ListingStatus.Expired })
    )
    assert(listing.ok)
    const applicant = await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing.data.id })
    )

    const offer = await offerAdapter.create(db, {
      status: OfferStatus.Active,
      listingId: listing.data.id,
      applicantId: applicant.id,
      selectedApplicants: [
        factory.offerApplicant.build({ applicantId: applicant.id }),
      ],
      expiresAt: new Date(),
    })

    assert(offer.ok)

    const res = await service.acceptOffer({
      applicantId: applicant.id,
      listingId: listing.data.id,
      offerId: offer.data.id,
    })

    expect(updateListingStatusSpy).toHaveBeenCalled()
    expect(updateApplicantStatusSpy).toHaveBeenCalled()
    expect(updateOfferSpy).toHaveBeenCalled()
    expect(res).toEqual({ ok: true, data: null })

    assert(offer.ok)

    const updatedListing = await listingAdapter.getListingById(listing.data.id)
    const updatedApplicant = await listingAdapter.getApplicantById(applicant.id)
    const updatedOffer = await offerAdapter.getOfferByOfferId(offer.data.id)
    assert(updatedOffer.ok)

    expect(updatedListing?.status).toBe(ListingStatus.Assigned)
    expect(updatedApplicant?.status).toBe(ApplicantStatus.OfferAccepted)
    // TODO: Offer status is incorrectly a string because of db column type!!
    expect(Number(updatedOffer.data.status)).toBe(OfferStatus.Accepted)
  })

  it('updates offer applicant', async () => {
    const listing = await listingAdapter.createListing(
      factory.listing.build({ status: ListingStatus.Expired })
    )
    assert(listing.ok)
    const applicant = await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing.data.id })
    )

    const initialApplicantStatus = ApplicantStatus.Active
    const offeredApplicant = factory.offerApplicant.build({
      status: initialApplicantStatus,
      applicantId: applicant.id,
    })
    const offer = await offerAdapter.create(db, {
      status: OfferStatus.Active,
      listingId: listing.data.id,
      applicantId: applicant.id,
      selectedApplicants: [offeredApplicant],
      expiresAt: new Date(),
    })

    assert(offer.ok)

    const [offerApplicantInDbBeforeAccept] = await db('offer_applicant')

    expect(offerApplicantInDbBeforeAccept.applicantStatus).toEqual(
      initialApplicantStatus
    )

    const res = await service.acceptOffer({
      applicantId: applicant.id,
      listingId: listing.data.id,
      offerId: offer.data.id,
    })

    expect(res.ok).toBe(true)
    const [offerApplicantInDbAfterAccept] = await db('offer_applicant')

    expect(offerApplicantInDbAfterAccept.applicantStatus).toEqual(
      ApplicantStatus.OfferAccepted
    )
  })
})

describe('denyOffer', () => {
  it('returns gracefully if offer update fails', async () => {
    const updateOfferStatusSpy = jest.spyOn(
      offerAdapter,
      'updateOfferAnsweredStatus'
    )

    updateOfferStatusSpy.mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const listing = await listingAdapter.createListing(
      factory.listing.build({ status: ListingStatus.Expired })
    )
    assert(listing.ok)
    const applicant = await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing.data.id })
    )

    const offer = await offerAdapter.create(db, {
      status: OfferStatus.Active,
      listingId: listing.data.id,
      applicantId: applicant.id,
      selectedApplicants: [
        factory.offerApplicant.build({ applicantId: applicant.id }),
      ],
      expiresAt: new Date(),
    })
    assert(offer.ok)

    const res = await service.denyOffer({
      applicantId: applicant.id,
      offerId: offer.data.id,
      listingId: listing.data.id,
    })

    expect(updateOfferStatusSpy).toHaveBeenCalled()
    expect(res).toEqual({ ok: false, err: 'update-offer' })
  })

  it('rollbacks applicant status change if update offer fails', async () => {
    const updateOfferStatusSpy = jest.spyOn(
      offerAdapter,
      'updateOfferAnsweredStatus'
    )

    const listing = await listingAdapter.createListing(
      factory.listing.build({ status: ListingStatus.Expired })
    )
    assert(listing.ok)
    const applicant = await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing.data.id })
    )

    const offer = await offerAdapter.create(db, {
      status: OfferStatus.Active,
      listingId: listing.data.id,
      applicantId: applicant.id,
      selectedApplicants: [
        factory.offerApplicant.build({ applicantId: applicant.id }),
      ],
      expiresAt: new Date(),
    })

    assert(offer.ok)
    updateOfferStatusSpy.mockResolvedValueOnce({ ok: false, err: 'unknown' })
    const res = await service.denyOffer({
      applicantId: applicant.id,
      offerId: offer.data.id,
      listingId: listing.data.id,
    })

    expect(updateOfferStatusSpy).toHaveBeenCalled()
    expect(res).toEqual({ ok: false, err: 'update-offer' })

    const applicantFromDb = await listingAdapter.getApplicantById(
      listing.data.id
    )
    expect(applicantFromDb?.status).toBe(applicant.status)
  })

  it('updates applicant and offer', async () => {
    const updateApplicantStatusSpy = jest.spyOn(
      listingAdapter,
      'updateApplicantStatus'
    )

    const updateOfferSpy = jest.spyOn(offerAdapter, 'updateOfferAnsweredStatus')
    const listing = await listingAdapter.createListing(
      factory.listing.build({ status: ListingStatus.Expired })
    )
    assert(listing.ok)
    const applicant = await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing.data.id })
    )

    const offer = await offerAdapter.create(db, {
      status: OfferStatus.Active,
      listingId: listing.data.id,
      applicantId: applicant.id,
      selectedApplicants: [
        factory.offerApplicant.build({ applicantId: applicant.id }),
      ],
      expiresAt: new Date(),
    })

    assert(offer.ok)

    const res = await service.denyOffer({
      applicantId: applicant.id,
      offerId: offer.data.id,
      listingId: listing.data.id,
    })

    expect(updateApplicantStatusSpy).toHaveBeenCalled()
    expect(updateOfferSpy).toHaveBeenCalled()
    expect(res).toEqual({ ok: true, data: null })

    const updatedApplicant = await listingAdapter.getApplicantById(applicant.id)
    const updatedOffer = await offerAdapter.getOfferByOfferId(offer.data.id)
    assert(updatedOffer.ok)

    expect(updatedApplicant?.status).toBe(ApplicantStatus.OfferDeclined)
    expect(updatedOffer.data.status).toBe(OfferStatus.Declined)
  })

  it('updates offer applicant', async () => {
    const listing = await listingAdapter.createListing(
      factory.listing.build({ status: ListingStatus.Expired })
    )
    assert(listing.ok)
    const applicant = await listingAdapter.createApplication(
      factory.applicant.build({ listingId: listing.data.id })
    )

    const initialApplicantStatus = ApplicantStatus.Active
    const offeredApplicant = factory.offerApplicant.build({
      status: initialApplicantStatus,
      applicantId: applicant.id,
    })
    const offer = await offerAdapter.create(db, {
      status: OfferStatus.Active,
      listingId: listing.data.id,
      applicantId: applicant.id,
      selectedApplicants: [offeredApplicant],
      expiresAt: new Date(),
    })

    assert(offer.ok)

    const [offerApplicantInDbBeforeAccept] = await db('offer_applicant')

    expect(offerApplicantInDbBeforeAccept.applicantStatus).toEqual(
      initialApplicantStatus
    )

    const res = await service.denyOffer({
      applicantId: applicant.id,
      listingId: listing.data.id,
      offerId: offer.data.id,
    })

    expect(res.ok).toBe(true)
    const [offerApplicantInDbAfterAccept] = await db('offer_applicant')

    expect(offerApplicantInDbAfterAccept.applicantStatus).toEqual(
      ApplicantStatus.OfferDeclined
    )
  })
})
