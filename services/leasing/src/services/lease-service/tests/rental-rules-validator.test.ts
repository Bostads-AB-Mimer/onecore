import {
  DetailedApplicantFactory,
  LeaseFactory,
  ListingFactory,
} from './factory'
import {
  isListingInAreaWithSpecificRentalRules,
  isHousingContractsOfApplicantInSameAreaAsListing,
  doesApplicantHaveParkingSpaceContractsInSameAreaAsListing,
} from '../rental-rules-validator'
import config from '../../../common/config'
import nock from 'nock'

describe('isListingInAreaWithSpecificRentalRules', () => {
  it('shouldReturnFalseIfListingIsNotInAreaWithSpecificRentalRules', () => {
    const listing = ListingFactory.build({
      districtCode: 'AREA_WHERE_RULES_DO_NOT_APPLY',
    })

    const result = isListingInAreaWithSpecificRentalRules(listing)

    expect(result).toBe(false)
  })

  it('shouldReturnTrueIfListingIsInAreaWithSpecificRentalRules', () => {
    const listing = ListingFactory.build({
      districtCode: 'OXB',
    })

    const result = isListingInAreaWithSpecificRentalRules(listing)

    expect(result).toBe(true)
  })
})

describe('isHousingContractsOfApplicantInSameAreaAsListing', () => {
  it('shouldReturnFalseIfNoHousingContracts', () => {
    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: undefined,
      upcomingHousingContract: undefined,
    })

    const result = isHousingContractsOfApplicantInSameAreaAsListing(
      ListingFactory.build(),
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('shouldReturnFalseIfCurrentHousingContractInOtherAreaThanListing', () => {
    const listing = ListingFactory.build({ districtCode: 'ABC' })
    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: LeaseFactory.build({
        residentialArea: { code: 'XYZ' },
      }),
    })

    const result = isHousingContractsOfApplicantInSameAreaAsListing(
      listing,
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('shouldReturnFalseIfUpcomingHousingContractInOtherAreaThanListing', () => {
    const listing = ListingFactory.build({ districtCode: 'ABC' })
    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: undefined,
      upcomingHousingContract: LeaseFactory.build({
        residentialArea: { code: 'XYZ' },
      }),
    })

    const result = isHousingContractsOfApplicantInSameAreaAsListing(
      listing,
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('shouldReturnTrueIfCurrentHousingContractInSameAreaAsListing', () => {
    const listing = ListingFactory.build({ districtCode: 'ABC' })
    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: LeaseFactory.build({
        residentialArea: { code: 'ABC' },
      }),
    })

    const result = isHousingContractsOfApplicantInSameAreaAsListing(
      listing,
      detailedApplicant
    )

    expect(result).toBe(true)
  })

  it('shouldReturnTrueIfUpcomingHousingContractInSameAreaAsListing', () => {
    const listing = ListingFactory.build({ districtCode: 'ABC' })
    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: undefined,
      upcomingHousingContract: LeaseFactory.build({
        residentialArea: { code: 'ABC' },
      }),
    })

    const result = isHousingContractsOfApplicantInSameAreaAsListing(
      listing,
      detailedApplicant
    )

    expect(result).toBe(false)
  })
})

describe('doesApplicantHaveParkingSpaceContractsInSameAreaAsListing', () => {
  it('shouldReturnFalseIfApplicantDoesNotHaveAnyParkingSpaceContracts', () => {
    const detailedApplicant = DetailedApplicantFactory.build({
      parkingSpaceContracts: undefined,
    })

    const result = doesApplicantHaveParkingSpaceContractsInSameAreaAsListing(
      ListingFactory.build(),
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('shouldReturnFalseIfApplicantDoesNotHaveParkingSpaceInSameAreaAsListing', () => {
    const listing = ListingFactory.build({ districtCode: 'ABC' })

    const detailedApplicant = DetailedApplicantFactory.build({
      parkingSpaceContracts: [
        LeaseFactory.build({ residentialArea: { code: 'XYZ' } }),
      ],
    })

    const result = doesApplicantHaveParkingSpaceContractsInSameAreaAsListing(
      listing,
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('shouldReturnTrueIfApplicantHaveParkingSpaceInSameAreaAsListing', () => {
    const listing = ListingFactory.build({ districtCode: 'ABC' })

    const detailedApplicant = DetailedApplicantFactory.build({
      parkingSpaceContracts: [
        LeaseFactory.build({ residentialArea: { code: 'XYZ' } }),
        LeaseFactory.build({ residentialArea: { code: 'ABC' } }),
      ],
    })

    const result = doesApplicantHaveParkingSpaceContractsInSameAreaAsListing(
      listing,
      detailedApplicant
    )

    expect(result).toBe(true)
  })
})
