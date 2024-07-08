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

import { ApplicantStatus, ListingStatus } from 'onecore-types'
import * as listingAdapter from '../../adapters/listing-adapter'

jest.mock('knex', () => () => ({
  raw: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  then: jest.fn().mockImplementation((callback) =>
    callback([
      {
        Id: 1,
        RentalObjectCode: '705-025-03-0205/01',
        Address: 'Testgatan 12',
        MonthlyRent: 123,
        DisctrictCaption: null,
        DistrictCode: null,
        BlockCaption: null,
        BlockCode: null,
        ObjectTypeCaption: null,
        RentalObjectTypeCaption: null,
        RentalObjectTypeCode: null,
        PublishedFrom: new Date('2023-02-28T00:00:00.000Z').toISOString(),
        PublishedTo: new Date('2023-02-28T00:00:00.000Z').toISOString(),
        VacantFrom: new Date('2023-02-28T00:00:00.000Z').toISOString(),
        Status: ListingStatus.Active,
        WaitingListType: null,
        applicants: JSON.stringify([
          {
            Id: 1,
            Name: 'Test Testsson',
            ContactCode: '1234',
            ApplicationDate: new Date('2023-02-28T00:00:00.000Z').toISOString(),
            ApplicationType: null,
            Status: ApplicantStatus.Active,
            ListingId: 1,
          },
        ]),
      },
      {
        Id: 2,
        RentalObjectCode: '705-025-03-0205/01',
        Address: 'Testgatan 13',
        MonthlyRent: 123,
        DisctrictCaption: null,
        DistrictCode: null,
        BlockCaption: null,
        BlockCode: null,
        ObjectTypeCaption: null,
        RentalObjectTypeCaption: null,
        RentalObjectTypeCode: null,
        PublishedFrom: new Date('2023-02-28T00:00:00.000Z').toISOString(),
        PublishedTo: new Date('2023-02-28T00:00:00.000Z').toISOString(),
        VacantFrom: new Date('2023-02-28T00:00:00.000Z').toISOString(),
        Status: ListingStatus.Active,
        WaitingListType: null,
        applicants: JSON.stringify([
          {
            Id: 3,
            Name: 'Test Testsson',
            ContactCode: '1234',
            ApplicationDate: new Date('2023-02-28T00:00:00.000Z').toISOString(),
            ApplicationType: null,
            Status: ApplicantStatus.Active,
            ListingId: 2,
          },
        ]),
      },
    ])
  ),
}))

describe(listingAdapter.getAllListingsWithApplicants, () => {
  it('returns a formatted list of listings and corresponding applicants', async () => {
    const [fst, snd] = await listingAdapter.getAllListingsWithApplicants()
    expect(fst.applicants).toHaveLength(1)
    expect(fst.applicants?.[0]?.listingId).toBe(fst.id)

    expect(snd.applicants).toHaveLength(1)
    expect(snd.applicants?.[0]?.listingId).toBe(snd.id)
  })
})
