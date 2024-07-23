import * as offerAdapter from '../adapters/offer-adapter'

jest.mock('knex', () => () => ({
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  then: jest.fn().mockImplementation((callback: any) =>
    callback([
      //offer for stina with rental object code
      {
        Id: 3,
        SentAt: null,
        ExpiresAt: '2024-05-15T13:19:27.000Z',
        AnsweredAt: null,
        SelectionSnapshot: '{"foo":"bar"}',
        Status: '1',
        ListingId: 3,
        ApplicantId: 1010,
        CreatedAt: '2024-05-31T06:04:17.286Z',
        RentalObjectCode: '705-808-00-0009',
        ApplicantApplicantId: 1010,
        ApplicantName: 'Testsson Stina',
        ApplicantNationalRegistrationNumber: '195001182046',
        ApplicantContactCode: 'P174965',
        ApplicantApplicationDate: '2024-05-29T06:01:17.323Z',
        ApplicantApplicationType: 'Replace',
        ApplicantStatus: 1,
        ApplicantListingId: 3,
      },
      // End of scenario
    ])
  ),
}))

describe(offerAdapter.getOffersForContact, () => {
  it('returns a formatted list of offers with rental object codes', async () => {
    const result = await offerAdapter.getOffersForContact('P174965')

    expect(result).toBeDefined()
    expect(result).toEqual([
      {
        id: 3,
        sentAt: null,
        expiresAt: '2024-05-15T13:19:27.000Z',
        answeredAt: null,
        selectedApplicants: {
          foo: 'bar',
        },
        status: '1',
        listingId: 3,
        offeredApplicant: {
          id: 1010,
          name: 'Testsson Stina',
          nationalRegistrationNumber: '195001182046',
          contactCode: 'P174965',
          applicationDate: '2024-05-29T06:01:17.323Z',
          applicationType: 'Replace',
          status: 1,
          listingId: 3,
        },
        createdAt: '2024-05-31T06:04:17.286Z',
        rentalObjectCode: '705-808-00-0009',
      },
    ])
  })
})
