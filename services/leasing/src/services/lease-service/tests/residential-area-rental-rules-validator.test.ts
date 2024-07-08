import {
  isListingInAreaWithSpecificRentalRules,
  isHousingContractsOfApplicantInSameAreaAsListing,
  doesApplicantHaveParkingSpaceContractsInSameAreaAsListing,
} from '../residential-area-rental-rules-validator'
import * as factory from './factories'

describe('isListingInAreaWithSpecificRentalRules', () => {
  it('shouldReturnFalseIfListingIsNotInAreaWithSpecificRentalRules', () => {
    const listing = factory.listing.build({
      districtCode: 'AREA_WHERE_RULES_DO_NOT_APPLY',
    })

    const result = isListingInAreaWithSpecificRentalRules(listing)

    expect(result).toBe(false)
  })

  it('shouldReturnTrueIfListingIsInAreaWithSpecificRentalRules', () => {
    const listing = factory.listing.build({
      districtCode: 'OXB',
    })

    const result = isListingInAreaWithSpecificRentalRules(listing)

    expect(result).toBe(true)
  })
})

describe('isHousingContractsOfApplicantInSameAreaAsListing', () => {
  it('shouldReturnFalseIfNoHousingContracts', () => {
    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: undefined,
      upcomingHousingContract: undefined,
    })

    const result = isHousingContractsOfApplicantInSameAreaAsListing(
      factory.listing.build(),
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('shouldReturnFalseIfCurrentHousingContractInOtherAreaThanListing', () => {
    const listing = factory.listing.build({ districtCode: 'ABC' })
    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: factory.lease.build({
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
    const listing = factory.listing.build({ districtCode: 'ABC' })
    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: undefined,
      upcomingHousingContract: factory.lease.build({
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
    const listing = factory.listing.build({ districtCode: 'ABC' })
    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: factory.lease.build({
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
    const listing = factory.listing.build({ districtCode: 'ABC' })
    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: undefined,
      upcomingHousingContract: factory.lease.build({
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
    const detailedApplicant = factory.detailedApplicant.build({
      parkingSpaceContracts: undefined,
    })

    const result = doesApplicantHaveParkingSpaceContractsInSameAreaAsListing(
      factory.listing.build(),
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('shouldReturnFalseIfApplicantDoesNotHaveParkingSpaceInSameAreaAsListing', () => {
    const listing = factory.listing.build({ districtCode: 'ABC' })

    const detailedApplicant = factory.detailedApplicant.build({
      parkingSpaceContracts: [
        factory.lease.build({ residentialArea: { code: 'XYZ' } }),
      ],
    })

    const result = doesApplicantHaveParkingSpaceContractsInSameAreaAsListing(
      listing,
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('shouldReturnTrueIfApplicantHaveParkingSpaceInSameAreaAsListing', () => {
    const listing = factory.listing.build({ districtCode: 'ABC' })

    const detailedApplicant = factory.detailedApplicant.build({
      parkingSpaceContracts: [
        factory.lease.build({ residentialArea: { code: 'XYZ' } }),
        factory.lease.build({ residentialArea: { code: 'ABC' } }),
      ],
    })

    const result = doesApplicantHaveParkingSpaceContractsInSameAreaAsListing(
      listing,
      detailedApplicant
    )

    expect(result).toBe(true)
  })
})
