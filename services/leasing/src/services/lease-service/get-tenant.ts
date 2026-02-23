import { Lease, Tenant } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { AdapterResult } from './adapters/types'
import * as estateCodeAdapter from './adapters/xpand/estate-code-adapter'
import * as tenantLeaseAdapter from './adapters/xpand/tenant-lease-adapter'
import * as tenfastAdapter from './adapters/tenfast/tenfast-adapter'
import * as priorityListService from './priority-list-service'
import { mapToOnecoreLease } from './helpers/tenfast'

type GetTenantError =
  | 'get-contact'
  | 'contact-not-found'
  | 'contact-not-tenant'
  | 'get-tenfast-tenant'
  | 'tenfast-tenant-not-found'
  | 'get-contact-leases'
  | 'contact-leases-not-found'
  | 'get-residential-area'
  | 'no-valid-housing-contract'
  | 'get-lease-property-info'

type NonEmptyArray<T> = [T, ...T[]]

export async function getTenant(params: {
  contactCode: string
}): Promise<AdapterResult<Tenant, GetTenantError>> {
  const result = await fetchTenant(params)
  if (!result.ok) {
    logger.error(
      { errorCode: result.err },
      `Failed to fetch tenant by contact code: ${params.contactCode}`
    )
  }

  return result
}

async function fetchTenant(params: {
  contactCode: string
}): Promise<AdapterResult<Tenant, GetTenantError>> {
  const contact = await tenantLeaseAdapter.getContactByContactCode(
    params.contactCode,
    true
  )

  if (!contact.ok) {
    return { ok: false, err: 'get-contact' }
  }

  if (!contact.data) {
    return { ok: false, err: 'contact-not-found' }
  }

  if (contact.data.isTenant !== true) {
    return { ok: false, err: 'contact-not-tenant' }
  }

  const tenfastTenant = await tenfastAdapter.getTenantByContactCode(
    contact.data.contactCode
  )

  if (!tenfastTenant.ok) {
    return { ok: false, err: 'get-tenfast-tenant' }
  }
  if (!tenfastTenant.data) {
    return { ok: false, err: 'tenfast-tenant-not-found' }
  }

  const tenfastLeases = await tenfastAdapter.getLeasesByTenantId(
    tenfastTenant.data._id
  )

  if (!tenfastLeases.ok) {
    return { ok: false, err: 'get-contact-leases' }
  }

  const onecoreLeases = tenfastLeases.data.map((lease) =>
    mapToOnecoreLease(lease)
  )

  if (!onecoreLeases.length) {
    return {
      ok: false,
      err: 'contact-leases-not-found',
    }
  }

  const activeAndUpcomingLeases = onecoreLeases.filter(
    priorityListService.isLeaseActiveOrUpcoming
  )

  const leasesWithResidentialArea = await Promise.all(
    activeAndUpcomingLeases.map(async (lease) => {
      const residentialArea =
        await tenantLeaseAdapter.getResidentialAreaByRentalPropertyId(
          lease.rentalPropertyId
        )

      if (!residentialArea.ok) {
        throw new Error('Err getting residential area')
      }

      return {
        ...lease,
        residentialArea: residentialArea.data,
      }
    })
  )
    .then((data) => ({ ok: true, data }) as const)
    .catch((err) => ({ ok: false, err }) as const)

  if (!leasesWithResidentialArea.ok) {
    return { ok: false, err: 'get-residential-area' }
  }

  const housingContracts = priorityListService.parseLeasesForHousingContracts(
    leasesWithResidentialArea.data
  )
  if (!housingContracts) {
    return { ok: false, err: 'no-valid-housing-contract' }
  }

  const [currentHousingContract, upcomingHousingContract] = housingContracts

  if (!currentHousingContract && !upcomingHousingContract) {
    return { ok: false, err: 'no-valid-housing-contract' }
  }

  const leasesWithPropertyType = await Promise.all(
    leasesWithResidentialArea.data.map(async (l) => {
      const type = await estateCodeAdapter
        .getEstateCodeFromXpandByRentalObjectCode(l.rentalPropertyId)
        .then((v) => v?.type)

      return { ...l, propertyType: type }
    })
  )
    .then((data) => ({ ok: true, data }) as const)
    .catch((err) => ({ ok: false, err }) as const)

  if (!leasesWithPropertyType.ok) {
    return { ok: false, err: 'get-lease-property-info' }
  }

  const parkingSpaceContracts = priorityListService.parseLeasesForParkingSpaces(
    leasesWithPropertyType.data
  )

  return {
    ok: true,
    data: {
      ...contact.data,
      address: contact.data.address,
      isAboutToLeave:
        !upcomingHousingContract &&
        !!currentHousingContract &&
        priorityListService.isLeaseAboutToEnd(currentHousingContract),
      currentHousingContract,
      upcomingHousingContract,
      parkingSpaceContracts,
      housingContracts: [
        currentHousingContract,
        upcomingHousingContract,
      ].filter(Boolean) as NonEmptyArray<Lease>,
    },
  }
}
