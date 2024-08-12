import {
  doesPropertyBelongingToParkingSpaceHaveSpecificRentalRules,
  doesTenantHaveHousingContractInSamePropertyAsListing,
} from '../property-rental-rules-validator'
import * as estateCodeAdapter from '../adapters/xpand/estate-code-adapter'
import * as factory from './factories'

describe('doesPropertyHaveSpecificRentalRules', () => {
  it('shouldReturnFalseIfPropertyDoesNotHaveSpecificRentalRules', () => {
    const estateCode = 'ESTATE_CODE_WITHOUT_SPECIFIC_RENTAL_RULES'
    const result =
      doesPropertyBelongingToParkingSpaceHaveSpecificRentalRules(estateCode)

    expect(result).toBe(false)
  })

  it('shouldReturnTrueIfPropertyHaveSpecificRentalRules', () => {
    const estateCode = '24104'

    const result =
      doesPropertyBelongingToParkingSpaceHaveSpecificRentalRules(estateCode)

    expect(result).toBe(true)
  })
})

const listingEstateCode = '24104'

describe('doesUserHaveHousingContractInSamePropertyAsListing', () => {
  it('should returns false if no housing contract', async () => {
    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: undefined,
      upcomingHousingContract: undefined,
    })

    const result = await doesTenantHaveHousingContractInSamePropertyAsListing(
      detailedApplicant,
      listingEstateCode
    )
    expect(result).toBe(false)
  })

  it('should return false if no current housing contract and upcoming housing contract in wrong property', async () => {
    const housingContractRentalObjectCode = '123'

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockResolvedValueOnce({
        estateCode: 'NON_MATCHING_ESTATE_CODE',
        type: 'foo',
      })

    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: undefined,
      upcomingHousingContract: factory.lease.build({
        rentalPropertyId: housingContractRentalObjectCode,
      }),
    })

    const result = await doesTenantHaveHousingContractInSamePropertyAsListing(
      detailedApplicant,
      listingEstateCode
    )
    expect(result).toBe(false)
  })

  it('should return false if no upcoming housing contract and current housing contract in wrong property', async () => {
    const housingContractRentalObjectCode = '123'

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockResolvedValueOnce({
        estateCode: 'NON_MATCHING_ESTATE_CODE',
        type: 'foo',
      })

    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: factory.lease.build({
        rentalPropertyId: housingContractRentalObjectCode,
      }),
      upcomingHousingContract: undefined,
    })

    const result = await doesTenantHaveHousingContractInSamePropertyAsListing(
      detailedApplicant,
      listingEstateCode
    )
    expect(result).toBe(false)
  })

  it('should return true if curent housing contract in same property', async () => {
    const housingContractRentalObjectCode = '123'

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockResolvedValueOnce({ estateCode: '24104', type: 'foo' })

    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: factory.lease.build({
        rentalPropertyId: housingContractRentalObjectCode,
      }),
      upcomingHousingContract: undefined,
    })

    const result = await doesTenantHaveHousingContractInSamePropertyAsListing(
      detailedApplicant,
      listingEstateCode
    )
    expect(result).toBe(true)
  })

  it('should return true if upcoming housing contract in same property', async () => {
    const housingContractRentalObjectCode = '123'

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockResolvedValueOnce({ estateCode: '24104', type: 'foo' })

    const detailedApplicant = factory.detailedApplicant.build({
      currentHousingContract: undefined,
      upcomingHousingContract: factory.lease.build({
        rentalPropertyId: housingContractRentalObjectCode,
      }),
    })

    const result = await doesTenantHaveHousingContractInSamePropertyAsListing(
      detailedApplicant,
      listingEstateCode
    )
    expect(result).toBe(true)
  })
})
