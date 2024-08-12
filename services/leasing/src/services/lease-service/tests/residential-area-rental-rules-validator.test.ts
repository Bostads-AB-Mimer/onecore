import {
  isListingInAreaWithSpecificRentalRules,
  isHousingContractsOfApplicantInSameAreaAsListing,
  doesApplicantHaveParkingSpaceContractsInSameAreaAsListing,
} from '../residential-area-rental-rules-validator'
import * as factory from './factories'

describe('isListingInAreaWithSpecificRentalRules', () => {
  it('should returns false if listing is not in area with specific rental rules', () => {
    const result = isListingInAreaWithSpecificRentalRules(
      'AREA_WHERE_RULES_DO_NOT_APPLY'
    )
    expect(result).toBe(false)
  })

  it('should return true if listing is in area with specific rental rules', () => {
    const result = isListingInAreaWithSpecificRentalRules('OXB')
    expect(result).toBe(true)
  })
})

describe('isHousingContractsOfApplicantInSameAreaAsListing', () => {
  it('should return false if no housing contracts', () => {
    const result = isHousingContractsOfApplicantInSameAreaAsListing('MAL', {
      currentHousingContract: undefined,
      upcomingHousingContract: undefined,
    })

    expect(result).toBe(false)
  })

  it('shouldReturnFalseIfCurrentHousingContractInOtherAreaThanListing', () => {
    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: factory.lease.build({
        residentialArea: { code: 'XYZ' },
      }),
    })

    const result = isHousingContractsOfApplicantInSameAreaAsListing(
      'ABC',
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('shouldReturnFalseIfUpcomingHousingContractInOtherAreaThanListing', () => {
    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: undefined,
      upcomingHousingContract: factory.lease.build({
        residentialArea: { code: 'XYZ' },
      }),
    })

    const result = isHousingContractsOfApplicantInSameAreaAsListing(
      'ABC',
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('shouldReturnTrueIfCurrentHousingContractInSameAreaAsListing', () => {
    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: factory.lease.build({
        residentialArea: { code: 'ABC' },
      }),
    })

    const result = isHousingContractsOfApplicantInSameAreaAsListing(
      'ABC',
      detailedApplicant
    )

    expect(result).toBe(true)
  })

  it('shouldReturnTrueIfUpcomingHousingContractInSameAreaAsListing', () => {
    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: undefined,
      upcomingHousingContract: factory.lease.build({
        residentialArea: { code: 'ABC' },
      }),
    })

    const result = isHousingContractsOfApplicantInSameAreaAsListing(
      'ABC',
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
      'MAL',
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('shouldReturnFalseIfApplicantDoesNotHaveParkingSpaceInSameAreaAsListing', () => {
    const detailedApplicant = factory.detailedApplicant.build({
      parkingSpaceContracts: [
        factory.lease.build({ residentialArea: { code: 'XYZ' } }),
      ],
    })

    const result = doesApplicantHaveParkingSpaceContractsInSameAreaAsListing(
      'ABC',
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('shouldReturnTrueIfApplicantHaveParkingSpaceInSameAreaAsListing', () => {
    const detailedApplicant = factory.detailedApplicant.build({
      parkingSpaceContracts: [
        factory.lease.build({ residentialArea: { code: 'XYZ' } }),
        factory.lease.build({ residentialArea: { code: 'ABC' } }),
      ],
    })

    const result = doesApplicantHaveParkingSpaceContractsInSameAreaAsListing(
      'ABC',
      detailedApplicant
    )

    expect(result).toBe(true)
  })
})
