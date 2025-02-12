import {
  isListingInAreaWithSpecificRentalRules,
  isHousingContractsOfApplicantInSameAreaAsListing,
  doesApplicantHaveParkingSpaceContractsInSameAreaAsListing,
} from '../residential-area-rental-rules-validator'
import * as factory from './factories'

describe(isListingInAreaWithSpecificRentalRules, () => {
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

describe(isHousingContractsOfApplicantInSameAreaAsListing, () => {
  it('should return false if no housing contracts', () => {
    const result = isHousingContractsOfApplicantInSameAreaAsListing('MAL', {
      currentHousingContract: undefined,
      upcomingHousingContract: undefined,
    })

    expect(result).toBe(false)
  })

  it('should return false if current housing contract is in other area than listing', () => {
    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: factory.lease.build({
        residentialArea: { code: 'XYZ' },
      }),
      upcomingHousingContract: undefined,
    })

    const result = isHousingContractsOfApplicantInSameAreaAsListing(
      'ABC',
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('should return false if upcoming housing contract is in other area than listing', () => {
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

  it('should return true if upcoming contract missing and current housing contract is in same area as listing', () => {
    const detailedApplicant = factory.detailedApplicant.build({
      upcomingHousingContract: undefined,
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

  it('should return true if upcoming housing contract is in same area as listing', () => {
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

    expect(result).toBe(true)
  })
})

describe(doesApplicantHaveParkingSpaceContractsInSameAreaAsListing, () => {
  it('should return false if applicant does not have any parking space contracts', () => {
    const detailedApplicant = factory.detailedApplicant.build({
      parkingSpaceContracts: undefined,
    })

    const result = doesApplicantHaveParkingSpaceContractsInSameAreaAsListing(
      'MAL',
      detailedApplicant
    )

    expect(result).toBe(false)
  })

  it('should return false if applicant does not have parking space in same area as listing', () => {
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

  it('should return true if applicant have parking space in same area as listing', () => {
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
