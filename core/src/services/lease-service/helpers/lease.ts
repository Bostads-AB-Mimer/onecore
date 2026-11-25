import { leasing, Tenant } from '@onecore/types'

import { AdapterResult } from '../../../adapters/types'

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

/**
 * Decide VAT for a parking space lease from the tenant lookup. A tenant with
 * a current or upcoming housing contract in the parking space's residential
 * area gets it without VAT, everyone else with VAT. Only the two outcomes
 * that mean "no housing contract" count as such. Any other lookup failure
 * returns an error, so a technical failure never turns into VAT.
 */
export const decideParkingSpaceVat = (
  residentialAreaCode: string,
  tenantResult: AdapterResult<Tenant, string>
): AdapterResult<leasing.v1.ParkingSpaceVatDecision, 'get-tenant-failed'> => {
  if (tenantResult.ok) {
    return isTenantAllowedToRentAParkingSpaceInThisResidentialArea(
      residentialAreaCode,
      tenantResult.data
    )
      ? {
          ok: true,
          data: { includeVAT: false, reason: 'housing-contract-in-area' },
        }
      : {
          ok: true,
          data: { includeVAT: true, reason: 'no-housing-contract-in-area' },
        }
  }

  switch (tenantResult.err) {
    case 'no-valid-housing-contract':
      return {
        ok: true,
        data: { includeVAT: true, reason: 'no-housing-contract-in-area' },
      }
    case 'contact-not-tenant':
      return { ok: true, data: { includeVAT: true, reason: 'not-a-tenant' } }
    default:
      return { ok: false, err: 'get-tenant-failed' }
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
