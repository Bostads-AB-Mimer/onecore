import { OfferStatus } from 'onecore-types'
import assert from 'node:assert'

import { db, migrate, teardown } from '../../adapters/db'
import * as offerAdapter from '../../adapters/offer-adapter'
import * as factory from './../factories'
import * as listingAdapter from '../../adapters/listing-adapter'
import { Knex } from 'knex'

beforeAll(async () => {
  await migrate()
})

afterEach(async () => {
  await db('offer').del()
  await db('applicant').del()
  await db('listing').del()
})

afterAll(async () => {
  await teardown()
})

describe('offer-adapter', () => {
  describe(offerAdapter.create, () => {
    it('inserts a new offer in the database', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id })
      )

      const insertedOffer = await offerAdapter.create({
        expiresAt: new Date(),
        status: OfferStatus.Active,
        selectedApplicants: [
          factory.detailedApplicant.build({
            id: applicant.id,
            contactCode: applicant.contactCode,
            nationalRegistrationNumber: applicant.nationalRegistrationNumber,
          }),
        ],
        listingId: listing.data.id,
        applicantId: applicant.id,
      })

      const row = await db('offer').first()
      expect(row).toBeDefined()
      expect(row.ListingId).toEqual(insertedOffer.listingId)
      expect(row.ApplicantId).toEqual(applicant.id)
    })

    it('throws error if applicant not found', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )

      assert(listing.ok)
      await expect(
        offerAdapter.create({
          expiresAt: new Date(),
          status: OfferStatus.Active,
          selectedApplicants: [
            factory.detailedApplicant.build({
              id: -1,
              contactCode: 'NON_EXISTING_APPLICANT',
              nationalRegistrationNumber: 'I_DO_NOT_EXIST',
            }),
          ],
          listingId: listing.data.id,
          applicantId: -1,
        })
      ).rejects.toThrow('Applicant not found when creating offer')
    })
  })

  describe(offerAdapter.getOffersForContact, () => {
    it('gets the offers a a contact', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id })
      )

      await offerAdapter.create({
        expiresAt: new Date(),
        status: OfferStatus.Active,
        selectedApplicants: [
          factory.detailedApplicant.build({
            id: applicant.id,
            contactCode: applicant.contactCode,
            nationalRegistrationNumber: applicant.nationalRegistrationNumber,
          }),
        ],
        listingId: listing.data.id,
        applicantId: applicant.id,
      })

      const offersFromDb = await offerAdapter.getOffersForContact(
        applicant.contactCode
      )
      expect(offersFromDb).toHaveLength(1)
      expect(offersFromDb[0].offeredApplicant.contactCode).toEqual(
        applicant.contactCode
      )
    })

    it('returns empty list if applicant has no offers', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id })
      )

      await offerAdapter.create({
        expiresAt: new Date(),
        status: OfferStatus.Active,
        selectedApplicants: [
          factory.detailedApplicant.build({
            id: applicant.id,
            contactCode: applicant.contactCode,
            nationalRegistrationNumber: applicant.nationalRegistrationNumber,
          }),
        ],
        listingId: listing.data.id,
        applicantId: applicant.id,
      })

      const offersFromDb = await offerAdapter.getOffersForContact(
        'NON_EXISTING_CONTACT_CODE'
      )

      expect(offersFromDb).toEqual([])
    })
  })

  describe(offerAdapter.getOfferByContactCodeAndOfferId, () => {
    it('gets the offer a a contact', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id })
      )

      const offer = await offerAdapter.create({
        expiresAt: new Date(),
        status: OfferStatus.Active,
        selectedApplicants: [
          factory.detailedApplicant.build({
            id: applicant.id,
            contactCode: applicant.contactCode,
            nationalRegistrationNumber: applicant.nationalRegistrationNumber,
          }),
        ],
        listingId: listing.data.id,
        applicantId: applicant.id,
      })

      const offersFromDb = await offerAdapter.getOfferByContactCodeAndOfferId(
        applicant.contactCode,
        offer.id
      )
      expect(offersFromDb).toBeDefined()
      expect(offersFromDb?.id).toEqual(offer.id)
      expect(offersFromDb?.offeredApplicant.contactCode).toEqual(
        applicant.contactCode
      )
    })

    it('returns empty object if offer does not exist', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id })
      )

      const offersFromDb = await offerAdapter.getOfferByContactCodeAndOfferId(
        applicant.contactCode,
        123456
      )
      expect(offersFromDb).toBeUndefined()
    })

    it('returns empty object if applicant does not exist', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      assert(listing.ok)
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id })
      )

      const offer = await offerAdapter.create({
        expiresAt: new Date(),
        status: OfferStatus.Active,
        selectedApplicants: [
          factory.detailedApplicant.build({
            id: applicant.id,
            contactCode: applicant.contactCode,
            nationalRegistrationNumber: applicant.nationalRegistrationNumber,
          }),
        ],
        listingId: listing.data.id,
        applicantId: applicant.id,
      })

      const offersFromDb = await offerAdapter.getOfferByContactCodeAndOfferId(
        'NON_EXISTING_CONTACT_CODE',
        offer.id
      )
      expect(offersFromDb).toBeUndefined()
    })
  })

  describe(offerAdapter.getOfferByOfferId, () => {
    it('gets an offer by id', async () => {
      const listingRes = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      if (!listingRes.ok) fail('Setup failed. Listing could not be completed')

      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listingRes.data.id })
      )

      const offer = await offerAdapter.create({
        expiresAt: new Date(),
        status: OfferStatus.Active,
        selectedApplicants: [
          factory.detailedApplicant.build({
            id: applicant.id,
            contactCode: applicant.contactCode,
            nationalRegistrationNumber: applicant.nationalRegistrationNumber,
          }),
        ],
        listingId: listingRes.data.id,
        applicantId: applicant.id,
      })

      const res = await offerAdapter.getOfferByOfferId(offer.id)

      expect(res.ok).toBeTruthy()
      if (res.ok) {
        expect(res.data.id).toEqual(offer.id)
        expect(res.data.offeredApplicant.contactCode).toEqual(
          applicant.contactCode
        )
      }
    })

    it('returns empty object if offer does not exist', async () => {
      const res = await offerAdapter.getOfferByOfferId(123456)
      expect(res.ok).toBeFalsy()
      if (!res.ok) expect(res.err).toBe('not-found')
    })
  })

  describe(offerAdapter.getOffersByListingId, () => {
    it('fails correctly', async () => {
      const res = await offerAdapter.getOffersByListingId(1, {
        select: jest.fn().mockRejectedValueOnce('boom'),
      } as unknown as Knex)

      expect(res).toEqual({ ok: false, err: 'unknown' })
    })

    it('gets offers by listing id', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      assert(listing.ok)

      const applicants = factory.applicant.buildList(2, {
        listingId: listing.data.id,
      })

      await Promise.all(applicants.map(listingAdapter.createApplication))

      // TODO: Should be a db constraint on multiple active offers per listing
      await offerAdapter.create({
        status: OfferStatus.Active,
        expiresAt: new Date(),
        listingId: listing.data.id,
        applicantId: applicants[0].id,
        selectedApplicants: [
          factory.detailedApplicant.build({ id: applicants[0].id }),
        ],
      })

      await offerAdapter.create({
        status: OfferStatus.Expired,
        expiresAt: new Date(),
        listingId: listing.data.id,
        applicantId: applicants[1].id,
        selectedApplicants: [
          factory.detailedApplicant.build({ id: applicants[1].id }),
        ],
      })

      const res = await offerAdapter.getOffersByListingId(listing.data.id)
      assert(res.ok)

      expect(res.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: OfferStatus.Active,
            listingId: listing.data.id,
            offeredApplicant: expect.objectContaining({ id: applicants[0].id }),
            selectedApplicants: [
              expect.objectContaining({ id: applicants[0].id }),
            ],
          }),
          expect.objectContaining({
            status: OfferStatus.Expired,
            listingId: listing.data.id,
            offeredApplicant: expect.objectContaining({ id: applicants[1].id }),
            selectedApplicants: [
              expect.objectContaining({ id: applicants[1].id }),
            ],
          }),
        ])
      )
    })
  })
})
