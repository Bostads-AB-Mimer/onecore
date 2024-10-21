import { Lease, Tenant } from 'onecore-types'

import { AdapterResult } from './adapters/types'
import * as estateCodeAdapter from './adapters/xpand/estate-code-adapter'
import * as tenantLeaseAdapter from './adapters/xpand/tenant-lease-adapter'
import * as xpandSoapAdapter from './adapters/xpand/xpand-soap-adapter'
import * as priorityListService from './priority-list-service'
import { logger } from 'onecore-utilities'

type GetTenantError =
  | 'get-contact'
  | 'contact-not-found'
  | 'contact-not-tenant'
  | 'get-waiting-lists'
  | 'waiting-list-internal-parking-space-not-found'
  | 'get-contact-leases'
  | 'contact-leases-not-found'
  | 'get-residential-area'
  | 'housing-contracts-not-found'
  | 'get-lease-property-info'

type NonEmptyArray<T> = [T, ...T[]]

export async function getTenant(params: { contactCode: string }) {
  const result = await fetchTenant(params)
  if (!result.ok) {
    logger.error(
      result,
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
    'false'
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

  const waitingList = await xpandSoapAdapter.getWaitingList(
    contact.data.nationalRegistrationNumber
  )

  if (!waitingList.ok) {
    return { ok: false, err: 'get-waiting-lists' }
  }

  const waitingListForInternalParkingSpace =
    priorityListService.parseWaitingListForInternalParkingSpace(
      waitingList.data
    )

  if (!waitingListForInternalParkingSpace) {
    return {
      ok: false,
      err: 'waiting-list-internal-parking-space-not-found',
    }
  }

  const leases = await tenantLeaseAdapter.getLeasesForContactCode(
    contact.data.contactCode,
    'true',
    undefined
  )

  if (!leases.ok) {
    return {
      ok: false,
      err: 'get-contact-leases',
    }
  }

  if (!leases.data.length) {
    return {
      ok: false,
      err: 'contact-leases-not-found',
    }
  }

  const activeAndUpcomingLeases = leases.data.filter(
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
    return { ok: false, err: 'housing-contracts-not-found' }
  }

  const [currentHousingContract, upcomingHousingContract] = housingContracts

  if (!currentHousingContract && !upcomingHousingContract) {
    return { ok: false, err: 'housing-contracts-not-found' }
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
      queuePoints: waitingListForInternalParkingSpace.queuePoints,
      address: contact.data.address,
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
