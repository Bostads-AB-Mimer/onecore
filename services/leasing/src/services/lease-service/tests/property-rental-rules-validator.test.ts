import * as propertyRentalRulesValidator from '../property-rental-rules-validator'
import * as estateCodeAdapter from '../adapters/xpand/estate-code-adapter'
import * as factory from './factories'

describe(propertyRentalRulesValidator.parkingSpaceNeedsValidation, () => {
  it('returns false if property does not have specific rental rules', () => {
    const estateCode = 'ESTATE_CODE_WITHOUT_SPECIFIC_RENTAL_RULES'
    const result =
      propertyRentalRulesValidator.parkingSpaceNeedsValidation(estateCode)

    expect(result).toBe(false)
  })

  it('returns true if property has specific rental rules', () => {
    const estateCode = '24104'

    const result =
      propertyRentalRulesValidator.parkingSpaceNeedsValidation(estateCode)

    expect(result).toBe(true)
  })
})

const listingEstateCode = '24104'

describe(propertyRentalRulesValidator.isParkingSpaceRentableForTenant, () => {
  it('returns false if housing contract is not same property as listing', async () => {
    const housingContractRentalObjectCode = '123'

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockResolvedValueOnce({ estateCode: 'NOT_APPLICABLE', type: 'foo' })

    const lease = factory.lease.build({
      rentalPropertyId: housingContractRentalObjectCode,
    })

    const result =
      await propertyRentalRulesValidator.isParkingSpaceRentableForTenant(
        lease,
        listingEstateCode
      )
    expect(result).toBe(false)
  })

  it('returns true if housing contract is same property as listing', async () => {
    const housingContractRentalObjectCode = '123'

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockResolvedValueOnce({
        type: 'foo',
        estateCode:
          propertyRentalRulesValidator.PROPERTIES_WITH_SPECIFIC_RENTAL_RULES
            .ISOLATORN_14,
      })

    const lease = factory.lease.build({
      rentalPropertyId: housingContractRentalObjectCode,
    })

    const result =
      await propertyRentalRulesValidator.isParkingSpaceRentableForTenant(
        lease,
        propertyRentalRulesValidator.PROPERTIES_WITH_SPECIFIC_RENTAL_RULES
          .ISOLATORN_14
      )

    expect(result).toBe(true)
  })

  describe('ROTORN', () => {
    it('returns true if housing contract is one of ROTORN estate codes', async () => {
      const housingContractRentalObjectCode = '123'

      jest
        .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
        .mockResolvedValueOnce({
          type: 'foo',
          estateCode:
            propertyRentalRulesValidator.PROPERTIES_WITH_SPECIFIC_RENTAL_RULES
              .ROTORN_13,
        })

      const lease = factory.lease.build({
        rentalPropertyId: housingContractRentalObjectCode,
      })

      const result =
        await propertyRentalRulesValidator.isParkingSpaceRentableForTenant(
          lease,
          propertyRentalRulesValidator.PROPERTIES_WITH_SPECIFIC_RENTAL_RULES
            .ROTORN_14
        )

      expect(result).toBe(true)
    })
  })
})
