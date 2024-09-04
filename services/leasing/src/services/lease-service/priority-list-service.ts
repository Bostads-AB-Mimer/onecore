/*
 * Service for:
 * Fetching and consolidating detailed information on applicants from internal database and xpand
 * Sorting applicants based on rental rules
 */

import { logger } from 'onecore-utilities'
import {
  Applicant,
  DetailedApplicant,
  Lease,
  Listing,
  ParkingSpaceApplicationCategory,
  parkingSpaceApplicationCategoryTranslation,
  WaitingList,
} from 'onecore-types'

import { getWaitingList } from './adapters/xpand/xpand-soap-adapter'
import { leaseTypes } from '../../constants/leaseTypes'
import {
  getContactByContactCode,
  getLeasesForContactCode,
  getResidentialAreaByRentalPropertyId,
} from './adapters/xpand/tenant-lease-adapter'
import { AdapterResult } from './adapters/types'

type GetDetailedApplicantError =
  | 'get-contact'
  | 'contact-not-found'
  | 'contact-not-tenant'
  | 'get-waiting-lists'
  | 'waiting-list-internal-parking-space-not-found'
  | 'get-contact-leases'
  | 'contact-leases-not-found'
  | 'get-residential-area'
  | 'housing-contracts-not-found'
import {
  isHousingContractsOfApplicantInSameAreaAsListing,
  isListingInAreaWithSpecificRentalRules,
} from './residential-area-rental-rules-validator'

const getDetailedApplicantInformation = async (
  applicant: Applicant
): Promise<AdapterResult<DetailedApplicant, GetDetailedApplicantError>> => {
  const contact = await getContactByContactCode(applicant.contactCode, 'false')

  if (!contact.ok) {
    return { ok: false, err: 'get-contact' }
  }

  if (!contact.data) {
    return { ok: false, err: 'contact-not-found' }
  }

  const waitingList = await getWaitingList(
    contact.data.nationalRegistrationNumber
  )

  if (!waitingList.ok) {
    return { ok: false, err: 'get-waiting-lists' }
  }

  const waitingListForInternalParkingSpace =
    parseWaitingListForInternalParkingSpace(waitingList.data)

  if (!waitingListForInternalParkingSpace) {
    return {
      ok: false,
      err: 'waiting-list-internal-parking-space-not-found',
    }
  }

  const leases = await getLeasesForContactCode(
    contact.data.contactCode,
    'true', //this filter does not consider upcoming leases
    undefined //do not include contacts
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

  const activeAndUpcomingLeases = leases.data.filter(isLeaseActiveOrUpcoming)

  const leasesWithResidentialArea = await Promise.all(
    activeAndUpcomingLeases.map(async (lease) => {
      const residentialArea = await getResidentialAreaByRentalPropertyId(
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

  const housingContracts = parseLeasesForHousingContracts(
    leasesWithResidentialArea.data
  )

  if (!housingContracts) {
    return { ok: false, err: 'housing-contracts-not-found' }
  }

  const [currentHousingContract, upcomingHousingContract] = housingContracts

  if (!currentHousingContract && !upcomingHousingContract) {
    return { ok: false, err: 'housing-contracts-not-found' }
  }

  const parkingSpaceContracts = parseLeasesForParkingSpaces(
    leasesWithResidentialArea.data
  )

  return {
    ok: true,
    data: {
      ...applicant,
      queuePoints: waitingListForInternalParkingSpace.queuePoints,
      address: contact.data.address,
      currentHousingContract,
      upcomingHousingContract,
      parkingSpaceContracts,
    },
  }
}

const addPriorityToApplicantsBasedOnRentalRules = (
  listing: Listing,
  applicants: DetailedApplicant[]
) => {
  const applicantsWithAssignedPriority: DetailedApplicant[] = []
  for (const applicant of applicants) {
    applicantsWithAssignedPriority.push(
      assignPriorityToApplicantBasedOnRentalRules(listing, applicant)
    )
  }

  return applicantsWithAssignedPriority
}

const sortApplicantsBasedOnRentalRules = (
  applicants: DetailedApplicant[]
): DetailedApplicant[] => {
  return Array.from(applicants).sort((a, b) => {
    //undefined priority is the lowest priority
    const aPriority =
      a.priority !== undefined ? a.priority : Number.MAX_SAFE_INTEGER
    const bPriority =
      b.priority !== undefined ? b.priority : Number.MAX_SAFE_INTEGER

    //sort by priority (ascending)
    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }

    //sort by queue points (descending)
    return b.queuePoints - a.queuePoints
  })
}

const assignPriorityToApplicantBasedOnRentalRules = (
  listing: Listing,
  applicant: DetailedApplicant
): DetailedApplicant => {
  if (applicant.listingId !== listing.id) {
    throw new Error(
      `applicant ${applicant.contactCode} does not belong to listing ${listing.id}`
    )
  }

  if (
    listing.districtCode &&
    isListingInAreaWithSpecificRentalRules(listing.districtCode) &&
    !isHousingContractsOfApplicantInSameAreaAsListing(
      listing.districtCode,
      applicant
    )
  ) {
    //special residential area rental rules apply to this listing
    //applicant is not allowed to rent this object, return priority:undefined
    return {
      ...applicant,
      priority: undefined,
    }
  }

  //priority  1

  //Applicant has no active parking space contract and is tenant in same area as listing
  if (!applicant.parkingSpaceContracts?.length) {
    if (applicant.currentHousingContract) {
      if (
        applicant.currentHousingContract?.residentialArea?.code ===
        listing.districtCode
      ) {
        return {
          ...applicant,
          priority: 1,
        }
      }
    }

    //Applicant has no active parking space contract and has upcoming housing contract in same area as listing
    if (applicant.upcomingHousingContract) {
      if (
        applicant.upcomingHousingContract?.residentialArea?.code ===
        listing.districtCode
      ) {
        return {
          ...applicant,
          priority: 1,
        }
      }
    }
  }

  //Applicant has 1 active contract for parking space and wishes to replace current parking space
  if (
    applicant.parkingSpaceContracts?.length === 1 &&
    applicant.applicationType === 'Replace'
  ) {
    return {
      ...applicant,
      priority: 1,
    }
  }

  //priority 2

  //Applicant has 1 active parking space contract and wishes to rent an additional parking space
  if (
    applicant.parkingSpaceContracts?.length === 1 &&
    applicant.applicationType === 'Additional'
  ) {
    return {
      ...applicant,
      priority: 2,
    }
  }

  //Applicant has more than 1 active parking space contract and wishes to replace 1 parking space contract
  if (
    applicant.parkingSpaceContracts &&
    applicant.parkingSpaceContracts.length > 1 &&
    applicant.applicationType === 'Replace'
  ) {
    return {
      ...applicant,
      priority: 2,
    }
  }

  //priority 3

  //Applicant has 2 or more active parking space and wishes to rent an additional parking space
  if (
    applicant.parkingSpaceContracts &&
    applicant.parkingSpaceContracts.length >= 2
  ) {
    return {
      ...applicant,
      priority: 3,
    }
  }

  //Applicant is not in any of the 3 priority groups and is not eligible to rent the parking space. Ie because they doesn't have a housing contract
  return {
    ...applicant,
    priority: undefined,
  }
}

//helper function to filter all non-terminated and all still active contracts with a last debit date
const isLeaseActiveOrUpcoming = (lease: Lease): boolean => {
  const currentDate = new Date()
  const terminationDate = lease.terminationDate
    ? new Date(lease.terminationDate)
    : null

  const lastDebitDate = lease.lastDebitDate
    ? new Date(lease.lastDebitDate)
    : null

  //determine if lastDebitDate and terminationDate is set
  //if so, the date(s) needs to be in the future for the lease to be active
  const isCurrentDateEarlierThanLastDebitDate =
    !lastDebitDate || currentDate < lastDebitDate
  const isCurrentDateBeforeTerminationDate =
    !terminationDate || currentDate < terminationDate

  return (
    isCurrentDateEarlierThanLastDebitDate && isCurrentDateBeforeTerminationDate
  )
}

const parseWaitingListForInternalParkingSpace = (
  waitingLists: WaitingList[]
): WaitingList | undefined => {
  for (const waitingList of waitingLists) {
    if (
      parkingSpaceApplicationCategoryTranslation[
        waitingList.waitingListTypeCaption
      ] == ParkingSpaceApplicationCategory.internal
    ) {
      return waitingList
    }
  }
  return undefined
}

//this function is based on xpand rules that there can be max 1 current active contract and 1 upcoming contract
const parseLeasesForHousingContracts = (
  leases: Lease[]
):
  | [
      currentHousingContract: Lease | undefined,
      upcomingHousingContract: Lease | undefined,
    ]
  | undefined => {
  const currentDate = new Date()
  const housingContracts: Lease[] = []
  for (const lease of leases) {
    //use startsWith to handle whitespace issues from xpand
    if (lease.type.includes(leaseTypes.housingContract)) {
      housingContracts.push(lease)
    }
  }

  //only 1 active housing contract found
  if (housingContracts.length == 1) {
    const lease = housingContracts[0]
    const hasLeaseStarted = lease.leaseStartDate <= currentDate

    //if lease has started we have an active contract, otherwise an upcoming contract
    return hasLeaseStarted ? [lease, undefined] : [undefined, lease]
  }

  //applicant have 1 active and 1 upcoming contract
  if (housingContracts.length == 2) {
    const currentActiveLease = leases.find((lease) => {
      const lastDebitDateNotSet =
        lease.lastDebitDate === null || lease.lastDebitDate === undefined
      const hasLeaseStarted = lease.leaseStartDate <= currentDate

      return lastDebitDateNotSet && hasLeaseStarted
    })

    if (currentActiveLease == undefined) {
      logger.error(
        'Could not find active lease in parseLeasesForHousingContracts'
      )
      throw new Error('could not find any active lease')
    }

    const upcomingLease = leases.find((lease) => {
      const lastDebitDateNotSet =
        lease.lastDebitDate === null || lease.lastDebitDate === undefined
      const isLeaseUpcoming = lease.leaseStartDate > currentDate

      return lastDebitDateNotSet && isLeaseUpcoming
    })

    if (upcomingLease == undefined) {
      logger.error(
        'Could not find any pending lease in parseLeasesForHousingContracts'
      )
      throw new Error('Could not find any pending lease')
    }

    return [currentActiveLease, upcomingLease]
  }

  return undefined
}

const parseLeasesForParkingSpaces = (
  leases: Array<Lease & { propertyType?: string }>
): Array<Lease> => {
  return leases.filter((v) => v.propertyType === 'babps') // I think 'babps' is xpands name for "bilplats"
}

export {
  getDetailedApplicantInformation,
  addPriorityToApplicantsBasedOnRentalRules,
  sortApplicantsBasedOnRentalRules,
  assignPriorityToApplicantBasedOnRentalRules,
  parseWaitingListForInternalParkingSpace,
  parseLeasesForHousingContracts,
  parseLeasesForParkingSpaces,
  isLeaseActiveOrUpcoming,
}
