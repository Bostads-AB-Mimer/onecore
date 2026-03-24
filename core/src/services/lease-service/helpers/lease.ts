import { Tenant } from '@onecore/types'

export const isTenantAllowedToRentAParkingSpaceInThisResidentialArea = (
  residentialAreaCode: string,
  tenant: Tenant
) => {
  if (
    tenant.upcomingHousingContract &&
    tenant.upcomingHousingContract.residentialArea?.code === residentialAreaCode
  ) {
    return true
  }

  if (
    tenant.currentHousingContract &&
    tenant.currentHousingContract.residentialArea?.code === residentialAreaCode
  ) {
    return true
  }
}

export function getHomeInsuranceOfferMonthlyAmount(
  roomCount: number | null
): number | null {
  switch (roomCount) {
    case 1:
      return 69
    case 2:
      return 80
    case 3:
      return 93
    case 4:
      return 114
    case 5:
      return 125
    case 6:
      return 125
    case 7:
      return 125
    case 8:
      return 125
    default:
      return null
  }
}
