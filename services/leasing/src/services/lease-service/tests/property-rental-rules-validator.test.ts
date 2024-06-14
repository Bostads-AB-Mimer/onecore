import { DetailedApplicantFactory, LeaseFactory } from './factory'

import {
  doesPropertyBelongingToParkingSpaceHaveSpecificRentalRules,
  doesUserHaveHousingContractInSamePropertyAsListing,
} from '../property-rental-rules-validator'
import * as estateCodeAdapter from '../adapters/xpand/estate-code-adapter'
import { getEstateCodeFromXpandByRentalObjectCode } from '../adapters/xpand/estate-code-adapter'

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
  it('shouldReturnFalseIfNoHousingContract', async () => {
    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: undefined,
      upcomingHousingContract: undefined,
    })

    const result = await doesUserHaveHousingContractInSamePropertyAsListing(
      detailedApplicant,
      listingEstateCode
    )
    expect(result).toBe(false)
  })

  it('shouldReturnFalseIfNoCurrentHousingContractAndUpcomingHousingContractInWrongProperty', async () => {
    const housingContractRentalObjectCode = '123'

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        const mockData: { [key: string]: string | undefined } = {
          [housingContractRentalObjectCode]: 'NON_MATCHING_ESTATE_CODE',
        }

        return mockData[rentalObjectCode]
      })

    await expect(
      getEstateCodeFromXpandByRentalObjectCode(housingContractRentalObjectCode)
    ).resolves.toBe('NON_MATCHING_ESTATE_CODE')

    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: undefined,
      upcomingHousingContract: LeaseFactory.build({
        rentalPropertyId: housingContractRentalObjectCode,
      }),
    })

    const result = await doesUserHaveHousingContractInSamePropertyAsListing(
      detailedApplicant,
      listingEstateCode
    )
    expect(result).toBe(false)
  })

  it('shouldReturnFalseIfNoUpcomingHousingContractAndCurrentHousingContractInWrongProperty', async () => {
    const housingContractRentalObjectCode = '123'

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        const mockData: { [key: string]: string | undefined } = {
          [housingContractRentalObjectCode]: 'NON_MATCHING_ESTATE_CODE',
        }

        return mockData[rentalObjectCode]
      })

    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: LeaseFactory.build({
        rentalPropertyId: housingContractRentalObjectCode,
      }),
      upcomingHousingContract: undefined,
    })

    const result = await doesUserHaveHousingContractInSamePropertyAsListing(
      detailedApplicant,
      listingEstateCode
    )
    expect(result).toBe(false)
  })

  it('shouldReturnTrueIfCurrentHousingContractInSameProperty', async () => {
    const housingContractRentalObjectCode = '123'

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        const mockData: { [key: string]: string | undefined } = {
          [housingContractRentalObjectCode]: '24104',
        }

        return mockData[rentalObjectCode]
      })

    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: LeaseFactory.build({
        rentalPropertyId: housingContractRentalObjectCode,
      }),
      upcomingHousingContract: undefined,
    })

    const result = await doesUserHaveHousingContractInSamePropertyAsListing(
      detailedApplicant,
      listingEstateCode
    )
    expect(result).toBe(true)
  })

  it('shouldReturnTrueIfUpcomingHousingContractInSameProperty', async () => {
    const housingContractRentalObjectCode = '123'

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        const mockData: { [key: string]: string | undefined } = {
          [housingContractRentalObjectCode]: '24104',
        }

        return mockData[rentalObjectCode]
      })

    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: undefined,
      upcomingHousingContract: LeaseFactory.build({
        rentalPropertyId: housingContractRentalObjectCode,
      }),
    })

    const result = await doesUserHaveHousingContractInSamePropertyAsListing(
      detailedApplicant,
      listingEstateCode
    )
    expect(result).toBe(true)
  })
})
