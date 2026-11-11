import { ApplicantStatus, ListingStatus } from '@onecore/types'
import assert from 'node:assert'

import * as listingAdapter from '../../../adapters/listing-adapter'
import * as factory from './../../factories'
import { withContext } from '../../testUtils'

describe('listing-adapter', () => {
  describe(listingAdapter.createListing, () => {
    it('inserts a new listing in the database', () =>
      withContext(async (ctx) => {
        const insertedListing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({ rentalObjectCode: '1' }),
          ctx.db
        )
        assert(insertedListing.ok)
        const listingFromDatabase = await ctx.db('listing').first()
        expect(listingFromDatabase).toBeDefined()
        expect(listingFromDatabase.Id).toEqual(insertedListing.data.id)
      }))

    it('fails on duplicate combination of ListingStatus.Active and RentalObjectCode', () =>
      withContext(async (ctx) => {
        await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({
            rentalObjectCode: '1',
            status: ListingStatus.Active,
          }),
          ctx.db
        )

        const insertionResult = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({
            rentalObjectCode: '1',
            status: ListingStatus.Active,
          }),
          ctx.db
        )

        expect(insertionResult).toEqual({
          ok: false,
          err: 'conflict-active-listing',
        })
      }))

    it('allows duplicate combination of Listing status Assigned and RentalObjectCode', () =>
      withContext(async (ctx) => {
        await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({
            rentalObjectCode: '1',
            status: ListingStatus.Assigned,
          }),
          ctx.db
        )

        const insertionResult = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({
            rentalObjectCode: '1',
            status: ListingStatus.Active,
          }),
          ctx.db
        )

        expect(insertionResult).toMatchObject({
          ok: true,
        })
      }))

    it('allows duplicate combination of Listing status Closed and RentalObjectCode', () =>
      withContext(async (ctx) => {
        await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({
            rentalObjectCode: '1',
            status: ListingStatus.Closed,
          }),
          ctx.db
        )

        const insertionResult = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({
            rentalObjectCode: '1',
            status: ListingStatus.Active,
          }),
          ctx.db
        )

        expect(insertionResult).toMatchObject({
          ok: true,
        })
      }))
  })

  describe(listingAdapter.getActiveListingByRentalObjectCode, () => {
    it('returns an active listing by rental object code', () =>
      withContext(async (ctx) => {
        const insertedListing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({
            rentalObjectCode: '1',
            status: ListingStatus.Active,
          }),
          ctx.db
        )
        assert(insertedListing.ok)
        const insertedListing2 = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({
            rentalObjectCode: '1',
            status: ListingStatus.Closed,
          }),
          ctx.db
        )
        assert(insertedListing2.ok)

        const listingFromDatabase =
          await listingAdapter.getActiveListingByRentalObjectCode(
            insertedListing.data.rentalObjectCode,
            ctx.db
          )
        expect(listingFromDatabase?.rentalObjectCode).toBeDefined()
        expect(listingFromDatabase?.rentalObjectCode).toEqual(
          insertedListing.data.rentalObjectCode
        )
        expect(listingFromDatabase?.status).toEqual(ListingStatus.Active)
      }))
  })

  describe(listingAdapter.getListingById, () => {
    it('returns a listing by id', () =>
      withContext(async (ctx) => {
        const insertedListing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({ rentalObjectCode: '1' }),
          ctx.db
        )
        expect(insertedListing).toBeDefined()
        assert(insertedListing.ok)
        const listingFromDatabase = await listingAdapter.getListingById(
          insertedListing.data.id,
          ctx.db
        )
        expect(listingFromDatabase?.id).toBeDefined()
        expect(listingFromDatabase?.id).toEqual(insertedListing.data.id)
      }))
  })

  describe(listingAdapter.getApplicantById, () => {
    it('returns an applicant by id', () =>
      withContext(async (ctx) => {
        const listing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({ rentalObjectCode: '1' }),
          ctx.db
        )

        assert(listing.ok)
        const insertedApplicant = await listingAdapter.createApplication(
          factory.applicant.build({ listingId: listing.data.id }),
          ctx.db
        )
        const applicantFromDatabase = await listingAdapter.getApplicantById(
          insertedApplicant.id,
          ctx.db
        )
        expect(applicantFromDatabase).toBeDefined()
        expect(applicantFromDatabase?.id).toEqual(insertedApplicant.id)
      }))
  })

  describe(listingAdapter.createApplication, () => {
    it('inserts a new application in the database', () =>
      withContext(async (ctx) => {
        const listing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({ rentalObjectCode: '1' }),
          ctx.db
        )
        assert(listing.ok)
        const insertedApplicant = await listingAdapter.createApplication(
          factory.applicant.build({ listingId: listing.data.id }),
          ctx.db
        )
        expect(insertedApplicant).toBeDefined()
        const applicantFromDatabase = await ctx.db('applicant').first()
        expect(applicantFromDatabase).toBeDefined()
        expect(applicantFromDatabase.Id).toEqual(insertedApplicant.id)
      }))
  })

  describe(listingAdapter.updateApplicantStatus, () => {
    it('updates an applicants status', () =>
      withContext(async (ctx) => {
        const listing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({ rentalObjectCode: '1' }),
          ctx.db
        )
        assert(listing.ok)
        const insertedApplicant = await listingAdapter.createApplication(
          factory.applicant.build({
            listingId: listing.data.id,
            status: ApplicantStatus.Active,
          }),
          ctx.db
        )

        const result = await listingAdapter.updateApplicantStatus(ctx.db, {
          applicantId: insertedApplicant.id,
          status: ApplicantStatus.OfferAccepted,
        })
        expect(result.ok).toBe(true)
        const updatedApplicant = await listingAdapter.getApplicantById(
          insertedApplicant.id,
          ctx.db
        )
        expect(updatedApplicant?.status).toEqual(ApplicantStatus.OfferAccepted)
      }))
  })

  describe(listingAdapter.getApplicantsByContactCode, () => {
    it('returns an applicant by contact code', () =>
      withContext(async (ctx) => {
        const listing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({ rentalObjectCode: '1' }),
          ctx.db
        )

        assert(listing.ok)
        const insertedApplicant = await listingAdapter.createApplication(
          factory.applicant.build({ listingId: listing.data.id }),
          ctx.db
        )
        const applicantFromDatabase =
          await listingAdapter.getApplicantsByContactCode(
            insertedApplicant.contactCode,
            ctx.db
          )

        expect(applicantFromDatabase).toBeDefined()
        expect(applicantFromDatabase).toHaveLength(1)
        if (applicantFromDatabase != undefined) {
          expect(applicantFromDatabase[0]).toBeDefined()
          expect(applicantFromDatabase[0].id).toEqual(insertedApplicant.id)
        }
      }))

    it('returns empty list for non existing applicant', () =>
      withContext(async (ctx) => {
        const applicantFromDatabase =
          await listingAdapter.getApplicantsByContactCode(
            'NON_EXISTING_CONTACT_CODE',
            ctx.db
          )

        expect(applicantFromDatabase).toEqual([])
      }))
  })

  describe(listingAdapter.getApplicantByContactCodeAndListingId, () => {
    it('returns an applicant by contact code and listing id', () =>
      withContext(async (ctx) => {
        const listing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({ rentalObjectCode: '1' }),
          ctx.db
        )

        assert(listing.ok)
        const insertedApplicant = await listingAdapter.createApplication(
          factory.applicant.build({ listingId: listing.data.id }),
          ctx.db
        )

        const applicantFromDatabase =
          await listingAdapter.getApplicantByContactCodeAndListingId(
            insertedApplicant.contactCode,
            listing.data.id,
            ctx.db
          )
        expect(applicantFromDatabase).toBeDefined()
        expect(applicantFromDatabase?.id).toEqual(insertedApplicant.id)
        expect(applicantFromDatabase?.listingId).toEqual(
          insertedApplicant.listingId
        )
      }))

    it('returns undefined for non existing applicant', () =>
      withContext(async (ctx) => {
        const applicantFromDatabase =
          await listingAdapter.getApplicantByContactCodeAndListingId(
            'NON_EXISTING_CONTACT_CODE',
            -1,
            ctx.db
          )

        expect(applicantFromDatabase).toBeUndefined()
      }))
  })

  describe(listingAdapter.applicationExists, () => {
    it('returns true if application exists', () =>
      withContext(async (ctx) => {
        const listing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({ rentalObjectCode: '1' }),
          ctx.db
        )
        assert(listing.ok)
        const insertedApplicant = await listingAdapter.createApplication(
          factory.applicant.build({ listingId: listing.data.id }),
          ctx.db
        )

        const applicantExists = await listingAdapter.applicationExists(
          insertedApplicant.contactCode,
          listing.data.id,
          ctx.db
        )

        expect(applicantExists).toBe(true)
      }))

    it('returns false if application does not exist', () =>
      withContext(async (ctx) => {
        const applicantExists = await listingAdapter.applicationExists(
          'nonExistingContactCode',
          123456,
          ctx.db
        )

        expect(applicantExists).toBe(false)
      }))
  })

  describe(listingAdapter.getExpiredListings, () => {
    it('returns expired listings', () =>
      withContext(async (ctx) => {
        const today = new Date()
        const oneWeekInTheFuture = new Date(
          today.getTime() + 7 * 24 * 60 * 60 * 1000
        )
        //active listing
        await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({
            rentalObjectCode: '1',
            publishedTo: oneWeekInTheFuture,
          }),
          ctx.db
        )

        const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        const expiredListing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({
            rentalObjectCode: '2',
            publishedTo: oneWeekAgo,
            status: ListingStatus.Active,
          }),
          ctx.db
        )

        assert(expiredListing.ok)
        const expiredListings = await listingAdapter.getExpiredListings(ctx.db)
        expect(expiredListings).toBeDefined()
        expect(expiredListings).toHaveLength(1)
        expect(expiredListings[0].Id).toEqual(expiredListing.data.id)
        expect(expiredListings[0].RentalObjectCode).toEqual(
          expiredListing.data.rentalObjectCode
        )
      }))
  })

  describe(listingAdapter.updateListingStatuses, () => {
    it('updates the status of listings from an array of listing ids', () =>
      withContext(async (ctx) => {
        const listing1 = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build(),
          ctx.db
        )

        const listing2 = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build(),
          ctx.db
        )

        assert(listing1.ok)
        assert(listing2.ok)
        await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build(),
          ctx.db
        )

        const result = await listingAdapter.updateListingStatuses(
          [listing1.data.id, listing2.data.id],
          ListingStatus.Expired,
          ctx.db
        )
        expect(result.ok).toEqual(true)
        const listing1FromDatabase = await listingAdapter.getListingById(
          listing1.data.id,
          ctx.db
        )
        const listing2FromDatabase = await listingAdapter.getListingById(
          listing2.data.id,
          ctx.db
        )
        expect(listing1FromDatabase?.status).toEqual(ListingStatus.Expired)
        expect(listing2FromDatabase?.status).toEqual(ListingStatus.Expired)
      }))
  })

  describe(listingAdapter.updateListing, () => {
    it('returns not-found for a listing that does not exist', () =>
      withContext(async (ctx) => {
        const result = await listingAdapter.updateListing(
          1337,
          { reviewedAt: new Date() },
          ctx.db
        )
        expect(result).toEqual({ ok: false, err: 'not-found' })
      }))

    it('returns no-fields when the update has no recognized fields', () =>
      withContext(async (ctx) => {
        const listing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build(),
          ctx.db
        )
        assert(listing.ok)

        const result = await listingAdapter.updateListing(
          listing.data.id,
          {},
          ctx.db
        )
        expect(result).toEqual({ ok: false, err: 'no-fields' })
      }))

    it('clears reviewedAt/reviewedBy when publishedTo changes without re-confirming the review', () =>
      withContext(async (ctx) => {
        const listing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({
            publishedTo: new Date('2027-01-31'),
          }),
          ctx.db
        )
        assert(listing.ok)

        const reviewed = await listingAdapter.updateListing(
          listing.data.id,
          {
            reviewedAt: new Date('2027-01-01'),
            reviewedBy: 'someone@mimer.se',
          },
          ctx.db
        )
        assert(reviewed.ok)
        expect(reviewed.data.reviewedAt).not.toBeNull()

        const result = await listingAdapter.updateListing(
          listing.data.id,
          { publishedTo: new Date('2027-02-28') },
          ctx.db
        )
        assert(result.ok)
        expect(result.data.reviewedAt).toBeNull()
        expect(result.data.reviewedBy).toBeNull()
      }))

    it('keeps reviewedAt/reviewedBy when publishedTo is sent but unchanged', () =>
      withContext(async (ctx) => {
        const listing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({
            publishedTo: new Date('2027-01-10'),
          }),
          ctx.db
        )
        assert(listing.ok)

        const reviewed = await listingAdapter.updateListing(
          listing.data.id,
          {
            reviewedAt: new Date('2027-01-01'),
            reviewedBy: 'someone@mimer.se',
          },
          ctx.db
        )
        assert(reviewed.ok)

        // Same calendar day, different time-of-day — should not count as a change.
        const result = await listingAdapter.updateListing(
          listing.data.id,
          { publishedTo: new Date('2027-01-10T08:00:00Z') },
          ctx.db
        )
        assert(result.ok)
        expect(result.data.reviewedAt).not.toBeNull()
        expect(result.data.reviewedBy).toEqual('someone@mimer.se')
      }))

    it('keeps the new reviewedAt/reviewedBy when the same request re-confirms the review alongside a date change', () =>
      withContext(async (ctx) => {
        const listing = await listingAdapter.createListing(
          factory.listingWithoutRentalObject.build({
            publishedTo: new Date('2027-01-10'),
          }),
          ctx.db
        )
        assert(listing.ok)

        const reviewed = await listingAdapter.updateListing(
          listing.data.id,
          {
            reviewedAt: new Date('2027-01-01'),
            reviewedBy: 'first@mimer.se',
          },
          ctx.db
        )
        assert(reviewed.ok)

        const result = await listingAdapter.updateListing(
          listing.data.id,
          {
            publishedTo: new Date('2027-03-01'),
            reviewedAt: new Date('2027-03-02'),
            reviewedBy: 'second@mimer.se',
          },
          ctx.db
        )
        assert(result.ok)
        expect(result.data.reviewedAt).toEqual(new Date('2027-03-02'))
        expect(result.data.reviewedBy).toEqual('second@mimer.se')
      }))
  })
})
