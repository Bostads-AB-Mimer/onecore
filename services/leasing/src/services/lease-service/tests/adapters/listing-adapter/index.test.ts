import { ApplicantStatus, ListingStatus } from 'onecore-types'
import assert from 'node:assert'

import { db, migrate, teardown } from '../../../adapters/db'
import * as listingAdapter from '../../../adapters/listing-adapter'
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

describe('listing-adapter', () => {
  describe(listingAdapter.getAllListingsWithApplicants, () => {
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
      const [fst, snd] = await listingAdapter.getAllListingsWithApplicants()
      expect(fst.applicants).toHaveLength(1)
      expect(fst.applicants?.[0]?.listingId).toBe(fst.id)

      expect(snd.applicants).toHaveLength(1)
      expect(snd.applicants?.[0]?.listingId).toBe(snd.id)
    })
  })

  describe(listingAdapter.createListing, () => {
    it('inserts a new listing in the database', async () => {
      const insertedListing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      assert(insertedListing.ok)
      const listingFromDatabase = await db('listing').first()
      expect(listingFromDatabase).toBeDefined()
      expect(listingFromDatabase.Id).toEqual(insertedListing.data.id)
    })

    it('fails on duplicate combination of ListingStatus.Active and RentalObjectCode', async () => {
      await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '1',
          status: ListingStatus.Active,
        })
      )

      const insertionResult = await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '1',
          status: ListingStatus.Active,
        })
      )

      expect(insertionResult).toEqual({
        ok: false,
        err: 'conflict-active-listing',
      })
    })

    it('allows duplicate combination of other Listing statuses and RentalObjectCode', async () => {
      await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '1',
          status: ListingStatus.Active,
        })
      )

      const insertionResult = await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '1',
          status: ListingStatus.Expired,
        })
      )

      expect(insertionResult).toMatchObject({
        ok: true,
      })
    })
  })

  describe(listingAdapter.getListingByRentalObjectCode, () => {
    it('returns a listing by rental object code', async () => {
      const insertedListing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      assert(insertedListing.ok)
      const listingFromDatabase =
        await listingAdapter.getListingByRentalObjectCode(
          insertedListing.data.rentalObjectCode
        )
      expect(listingFromDatabase?.rentalObjectCode).toBeDefined()
      expect(listingFromDatabase?.rentalObjectCode).toEqual(
        insertedListing.data.rentalObjectCode
      )
    })
  })

  describe(listingAdapter.getListingById, () => {
    it('returns a listing by id', async () => {
      const insertedListing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      expect(insertedListing).toBeDefined()
      assert(insertedListing.ok)
      const listingFromDatabase = await listingAdapter.getListingById(
        insertedListing.data.id
      )
      expect(listingFromDatabase?.id).toBeDefined()
      expect(listingFromDatabase?.id).toEqual(insertedListing.data.id)
    })
  })

  describe(listingAdapter.getApplicantById, () => {
    it('returns an applicant by id', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )

      assert(listing.ok)
      const insertedApplicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id })
      )
      const applicantFromDatabase = await listingAdapter.getApplicantById(
        insertedApplicant.id
      )
      expect(applicantFromDatabase).toBeDefined()
      expect(applicantFromDatabase?.id).toEqual(insertedApplicant.id)
    })
  })

  describe(listingAdapter.createApplication, () => {
    it('inserts a new application in the database', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      assert(listing.ok)
      const insertedApplicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id })
      )
      expect(insertedApplicant).toBeDefined()
      const applicantFromDatabase = await db('applicant').first()
      expect(applicantFromDatabase).toBeDefined()
      expect(applicantFromDatabase.Id).toEqual(insertedApplicant.id)
    })
  })

  describe(listingAdapter.updateApplicantStatus, () => {
    it('updates an applicants status', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      assert(listing.ok)
      const insertedApplicant = await listingAdapter.createApplication(
        factory.applicant.build({
          listingId: listing.data.id,
          status: ApplicantStatus.Active,
        })
      )

      const result = await listingAdapter.updateApplicantStatus(
        insertedApplicant.id,
        ApplicantStatus.OfferAccepted
      )
      expect(result.ok).toBe(true)
      const updatedApplicant = await listingAdapter.getApplicantById(
        insertedApplicant.id
      )
      expect(updatedApplicant?.status).toEqual(ApplicantStatus.OfferAccepted)
    })
  })

  describe(listingAdapter.getApplicantsByContactCode, () => {
    it('returns an applicant by contact code', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )

      assert(listing.ok)
      const insertedApplicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id })
      )
      const applicantFromDatabase =
        await listingAdapter.getApplicantsByContactCode(
          insertedApplicant.contactCode
        )

      expect(applicantFromDatabase).toBeDefined()
      expect(applicantFromDatabase).toHaveLength(1)
      if (applicantFromDatabase != undefined) {
        expect(applicantFromDatabase[0]).toBeDefined()
        expect(applicantFromDatabase[0].id).toEqual(insertedApplicant.id)
      }
    })

    it('returns empty list for non existing applicant', async () => {
      const applicantFromDatabase =
        await listingAdapter.getApplicantsByContactCode(
          'NON_EXISTING_CONTACT_CODE'
        )

      expect(applicantFromDatabase).toEqual([])
    })
  })

  describe(listingAdapter.getApplicantByContactCodeAndListingId, () => {
    it('returns an applicant by contact code and listing id', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )

      assert(listing.ok)
      const insertedApplicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id })
      )

      const applicantFromDatabase =
        await listingAdapter.getApplicantByContactCodeAndListingId(
          insertedApplicant.contactCode,
          listing.data.id
        )
      expect(applicantFromDatabase).toBeDefined()
      expect(applicantFromDatabase?.id).toEqual(insertedApplicant.id)
      expect(applicantFromDatabase?.listingId).toEqual(
        insertedApplicant.listingId
      )
    })

    it('returns undefined for non existing applicant', async () => {
      const applicantFromDatabase =
        await listingAdapter.getApplicantByContactCodeAndListingId(
          'NON_EXISTING_CONTACT_CODE',
          -1
        )

      expect(applicantFromDatabase).toBeUndefined()
    })
  })

  describe(listingAdapter.applicationExists, () => {
    it('returns true if application exists', async () => {
      const listing = await listingAdapter.createListing(
        factory.listing.build({ rentalObjectCode: '1' })
      )
      assert(listing.ok)
      const insertedApplicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.data.id })
      )

      const applicantExists = await listingAdapter.applicationExists(
        insertedApplicant.contactCode,
        listing.data.id
      )

      expect(applicantExists).toBe(true)
    })

    it('returns false if application does not exist', async () => {
      const applicantExists = await listingAdapter.applicationExists(
        'nonExistingContactCode',
        123456
      )

      expect(applicantExists).toBe(false)
    })
  })

  describe(listingAdapter.getExpiredListings, () => {
    it('returns expired listings', async () => {
      const today = new Date()
      const oneWeekInTheFuture = new Date(
        today.getTime() + 7 * 24 * 60 * 60 * 1000
      )
      //active listing
      await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '1',
          publishedTo: oneWeekInTheFuture,
        })
      )

      const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      const expiredListing = await listingAdapter.createListing(
        factory.listing.build({
          rentalObjectCode: '2',
          publishedTo: oneWeekAgo,
          status: ListingStatus.Active,
        })
      )

      assert(expiredListing.ok)
      const expiredListings = await listingAdapter.getExpiredListings()
      expect(expiredListings).toBeDefined()
      expect(expiredListings).toHaveLength(1)
      expect(expiredListings[0].Id).toEqual(expiredListing.data.id)
      expect(expiredListings[0].RentalObjectCode).toEqual(
        expiredListing.data.rentalObjectCode
      )
    })
  })

  describe(listingAdapter.updateListingStatuses, () => {
    it('updates the status of listings from an array of listing ids', async () => {
      const listing1 = await listingAdapter.createListing(
        factory.listing.build()
      )

      const listing2 = await listingAdapter.createListing(
        factory.listing.build()
      )

      assert(listing1.ok)
      assert(listing2.ok)
      await listingAdapter.createListing(factory.listing.build({}))

      const result = await listingAdapter.updateListingStatuses(
        [listing1.data.id, listing2.data.id],
        ListingStatus.Expired
      )
      expect(result.ok).toEqual(true)
      const listing1FromDatabase = await listingAdapter.getListingById(
        listing1.data.id
      )
      const listing2FromDatabase = await listingAdapter.getListingById(
        listing2.data.id
      )
      expect(listing1FromDatabase?.status).toEqual(ListingStatus.Expired)
      expect(listing2FromDatabase?.status).toEqual(ListingStatus.Expired)
    })
  })
})
