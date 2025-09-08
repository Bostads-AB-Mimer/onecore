import { Tenant } from 'libs/types/dist'

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
