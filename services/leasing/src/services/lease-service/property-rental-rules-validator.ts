import { Tenant } from 'onecore-types'
import { getEstateCodeFromXpandByRentalObjectCode } from './adapters/xpand/estate-code-adapter'

const propertiesWithSpecificRentalRules = [
  {
    estateCode: '24104', //Sjöodjuret 2
  },
  {
    estateCode: '23002', //ROTORN 13
  },
  {
    estateCode: '23003', //ISOLATORN 14
  },
]

const doesPropertyBelongingToParkingSpaceHaveSpecificRentalRules = (
  estateCode: string
) => {
  return propertiesWithSpecificRentalRules.some(
    (property) => estateCode == property.estateCode
  )
}

async function doesTenantHaveHousingContractInSamePropertyAsListing(
  data: Pick<Tenant, 'currentHousingContract' | 'upcomingHousingContract'>,
  listingEstateCode: string
): Promise<boolean> {
  const propertyInfo = data.upcomingHousingContract
    ? await getEstateCodeFromXpandByRentalObjectCode(
        data.upcomingHousingContract.rentalPropertyId
      )
    : data.currentHousingContract
      ? await getEstateCodeFromXpandByRentalObjectCode(
          data.currentHousingContract.rentalPropertyId
        )
      : undefined

  if (!propertyInfo) return false

  return propertyInfo.estateCode === listingEstateCode
}

export {
  doesPropertyBelongingToParkingSpaceHaveSpecificRentalRules,
  doesTenantHaveHousingContractInSamePropertyAsListing,
}
