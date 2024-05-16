/*
 * Service for:
 * Fetching and consolidating detailed information on applicants from internal database and xpand
 * Sorting applicants based on rental rules
 */

import {
  Applicant,
  Lease,
  Listing,
  ParkingSpaceApplicationCategory,
  parkingSpaceApplicationCategoryTranslation,
  WaitingList,
} from 'onecore-types'
import { getWaitingList } from './adapters/xpand/xpand-soap-adapter'
import {
  getContactByContactCode,
  getLeasesForContactCode,
  getResidentialAreaByRentalPropertyId,
} from './adapters/xpand/tenant-lease-adapter'
import { leaseTypes } from '../../constants/leaseTypes'

const getDetailedApplicantInformation = async (applicant: Applicant) => {
  try {
    const applicantFromXpand = await getContactByContactCode(
      applicant.contactCode,
      'false'
    )

    if (!applicantFromXpand) {
      throw new Error(
        `Applicant ${applicant.contactCode} not found in contact query`
      )
    }

    const applicantWaitingList = await getWaitingList(
      applicantFromXpand.nationalRegistrationNumber
    )
    const waitingListForInternalParkingSpace =
      parseWaitingListForInternalParkingSpace(applicantWaitingList)

    if (!waitingListForInternalParkingSpace) {
      throw new Error(
        `Waiting list for internal parking space not found for applicant ${applicant.contactCode}`
      )
    }

    const leases = await getLeasesForContactCode(
      applicant.contactCode,
      'true', //this filter does not consider upcoming leases
      undefined //do not include contacts
    )

    if (!leases) {
      throw new Error(`Leases not found for applicant ${applicant.contactCode}`)
    }

    const activeAndUpcomingLeases: Lease[] = leases.filter(
      isLeaseActiveOrUpcoming
    )

    for (const lease of activeAndUpcomingLeases) {
      lease.residentialArea = await getResidentialAreaByRentalPropertyId(
        lease.rentalPropertyId
      )
    }

    const housingContracts = parseLeasesForHousingContracts(
      activeAndUpcomingLeases
    )
    if (!housingContracts) {
      throw new Error(
        `Housing contracts not found for applicant ${applicant.contactCode}`
      )
    }

    const parkingSpaces = parseLeasesForParkingSpaces(activeAndUpcomingLeases)

    //todo: define the proper interface type to return
    return {
      ...applicant,
      queuePoints: waitingListForInternalParkingSpace.queuePoints,
      address: applicantFromXpand.address,
      currentHousingContract: housingContracts[0],
      upcomingHousingContract: housingContracts[1],
      parkingSpaceContracts: parkingSpaces,
    }
  } catch (error) {
    console.error('Error in getDetailedApplicantInformation:', error)
    throw error // Re-throw the error to propagate it upwards
  }
}

//todo: should use and return defined interface type
const addPriorityToApplicantsBasedOnRentalRules = (
  listing: Listing,
  applicants: any[]
) => {
  const applicantsWithAssignedPriority: any[] = [] //todo: use defined interface
  for (const applicant of applicants) {
    applicantsWithAssignedPriority.push(
      assignPriorityToApplicantBasedOnRentalRules(listing, applicant)
    )
  }

  return applicantsWithAssignedPriority
}

const sortApplicantsBasedOnRentalRules = (applicants: any[]): any[] => {
  return Array.from(applicants).sort((a, b) => {
    //sort by priority (ascending)
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }

    //sort by queue points (descending)
    return b.queuePoints - a.queuePoints
  })
}

//todo: should use and return defined interface type from onecore-types
const assignPriorityToApplicantBasedOnRentalRules = (
  listing: Listing,
  applicant: any
): any => {
  if (applicant.listingId !== listing.id) {
    throw new Error(
      `applicant ${applicant.contactCode} does not belong to listing ${listing.id}`
    )
  }

  //priority  1

  //Applicant has no active parking space contract and is tenant in same area as listing
  if (!applicant.parkingSpaceContracts.length) {
    if (applicant.currentHousingContract) {
      if (
        applicant.currentHousingContract.residentialArea.code ===
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
        applicant.upcomingHousingContract.residentialArea.code ===
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
    applicant.parkingSpaceContracts.length === 1 &&
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
    applicant.parkingSpaceContracts.length === 1 &&
    applicant.applicationType === 'Additional'
  ) {
    return {
      ...applicant,
      priority: 2,
    }
  }

  //Applicant has more than 1 active parking space contract and wishes to replace 1 parking space contract
  if (
    applicant.parkingSpaceContracts.length > 1 &&
    applicant.applicationType === 'Replace'
  ) {
    return {
      ...applicant,
      priority: 2,
    }
  }

  //priority 3

  //Applicant has more 2 or more active parking space and wishes to rent an additional parking space

  return {
    ...applicant,
    priority: 3,
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
      throw new Error('could not find any active lease')
    }

    const upcomingLease = leases.find((lease) => {
      const lastDebitDateNotSet =
        lease.lastDebitDate === null || lease.lastDebitDate === undefined
      const isLeaseUpcoming = lease.leaseStartDate > currentDate

      return lastDebitDateNotSet && isLeaseUpcoming
    })

    if (upcomingLease == undefined) {
      throw new Error('could not find any pending lease')
    }

    return [currentActiveLease, upcomingLease]
  }

  return undefined
}

const parseLeasesForParkingSpaces = (leases: Lease[]): Lease[] | undefined => {
  const parkingSpaces: Lease[] = []
  for (const lease of leases) {
    //use startsWith to handle whitespace issues from xpand
    if (lease.type.includes(leaseTypes.parkingspaceContract)) {
      parkingSpaces.push(lease)
    }
  }
  return parkingSpaces
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
