import { db, migrate, teardown } from '../../adapters/db'
import * as offerAdapter from '../../adapters/offer-adapter'
import * as factory from './../factories'
import * as listingAdapter from '../../adapters/listing-adapter'
import { OfferStatus } from 'onecore-types'

jest.mock('onecore-utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
    },
  }
})

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
      const applicant = await listingAdapter.createApplication(
        factory.applicant.build({ listingId: listing.id })
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
        listingId: listing.id,
        applicantId: applicant.id,
      })

      const row = await db('offer').first()
      expect(row).toBeDefined()
      expect(row.ListingId).toEqual(insertedOffer.listingId)
      expect(row.ApplicantId).toEqual(applicant.id)
    })
  })

  it('throws error if applicant not found', async () => {
    const listing = await listingAdapter.createListing(
      factory.listing.build({ rentalObjectCode: '1' })
    )

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
        listingId: listing.id,
        applicantId: -1,
      })
    ).rejects.toThrow('Applicant not found when creating offer')
  })
})
