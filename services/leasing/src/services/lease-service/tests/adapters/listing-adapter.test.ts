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
  from: jest.fn().mockReturnThis(),
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
        PublishedFrom: new Date('2023-02-28T00:00:00.000Z'),
        PublishedTo: new Date('2023-02-28T00:00:00.000Z'),
        VacantFrom: new Date('2023-02-28T00:00:00.000Z'),
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
        ObjectTypeCode: null,
        RentalObjectTypeCaption: null,
        RentalObjectTypeCode: null,
        PublishedFrom: new Date('2023-02-28T00:00:00.000Z'),
        PublishedTo: new Date('2023-02-28T00:00:00.000Z'),
        VacantFrom: new Date('2023-02-28T00:00:00.000Z'),
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
    expect(fst).toEqual({
      id: 1,
      rentalObjectCode: '705-025-03-0205/01',
      address: 'Testgatan 12',
      monthlyRent: 123,
      districtCaption: undefined,
      districtCode: undefined,
      blockCaption: undefined,
      blockCode: undefined,
      objectTypeCaption: undefined,
      objectTypeCode: undefined,
      rentalObjectTypeCaption: undefined,
      rentalObjectTypeCode: undefined,
      publishedFrom: expect.any(Date),
      publishedTo: expect.any(Date),
      vacantFrom: expect.any(Date),
      status: ListingStatus.Active,
      waitingListType: undefined,
      applicants: [
        {
          id: 1,
          name: 'Test Testsson',
          contactCode: '1234',
          applicationDate: expect.any(Date),
          applicationType: undefined,
          status: ApplicantStatus.Active,
          listingId: 1,
          nationalRegistrationNumber: undefined,
        },
      ],
    })

    expect(snd.applicants).toHaveLength(1)
    expect(snd.applicants?.[0]?.listingId).toBe(snd.id)
  })
})
