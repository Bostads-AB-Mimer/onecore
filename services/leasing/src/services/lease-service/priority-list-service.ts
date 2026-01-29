/*
 * Service for:
 * Fetching and consolidating detailed information on applicants from internal database and xpand
 * Sorting applicants based on rental rules
 */

import { logger } from '@onecore/utilities'
import { DetailedApplicant, Lease, LeaseStatus, Listing } from '@onecore/types'

import { leaseTypes } from '../../constants/leaseTypes'

import {
  isHousingContractsOfApplicantInSameAreaAsListing,
  isListingInAreaWithSpecificRentalRules,
} from './residential-area-rental-rules-validator'

const addPriorityToApplicantsBasedOnRentalRules = (
  listing: Listing,
  applicants: DetailedApplicant[]
) => {
  const applicantsWithAssignedPriority: DetailedApplicant[] = []
  logger.info(
    `Adding priority to applicants based on rental rules for listing ${listing.id}`
  )
  for (const applicant of applicants) {
    applicantsWithAssignedPriority.push(
      assignPriorityToApplicantBasedOnRentalRules(listing, applicant)
    )
  }
  logger.info(`Priority assigned to applicants for ${listing.id}`)
  return applicantsWithAssignedPriority
}

const sortApplicantsBasedOnRentalRules = (
  applicants: DetailedApplicant[]
): DetailedApplicant[] => {
  return Array.from(applicants).sort((a, b) => {
    // Nulls are the lowest priority
    const aPriority = a.priority !== null ? a.priority : Number.MAX_SAFE_INTEGER
    const bPriority = b.priority !== null ? b.priority : Number.MAX_SAFE_INTEGER

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
    listing.rentalObject.residentialAreaCode &&
    isListingInAreaWithSpecificRentalRules(
      listing.rentalObject.residentialAreaCode
    ) &&
    !isHousingContractsOfApplicantInSameAreaAsListing(
      listing.rentalObject.residentialAreaCode,
      applicant
    )
  ) {
    //special residential area rental rules apply to this listing
    //applicant is not allowed to rent this object, return priority:null
    logger.info(
      applicant.name +
        ': priority null - special residential area rental rules apply to this listing. applicant is not allowed to rent this object'
    )
    return {
      ...applicant,
      priority: null,
    }
  }

  const activeParkingspaceContracts = applicant.parkingSpaceContracts?.filter(
    (l) => l.status === LeaseStatus.Current || l.status === LeaseStatus.Upcoming
  )

  //todo: filter out terminated leases from parkingSpaceContracts so that an applicant with a terminated lease is prioritized correctly
  if (!activeParkingspaceContracts?.length) {
    //priority  1

    //Applicant has no active parking space contract and is tenant in same area as listing
    if (applicant.currentHousingContract) {
      if (
        applicant.currentHousingContract?.residentialArea?.code ===
        listing.rentalObject.residentialAreaCode
      ) {
        logger.info(
          applicant.name +
            ': priority 1 - Applicant has no active parking space contract and is tenant in same area as listing'
        )

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
        listing.rentalObject.residentialAreaCode
      ) {
        logger.info(
          applicant.name +
            ': priority 1 - Applicant has no active parking space contract and has upcoming housing contract in same area as listing'
        )
        return {
          ...applicant,
          priority: 1,
        }
      }
    }
  }

  //Applicant has 1 active contract for parking space and wishes to replace current parking space
  if (
    activeParkingspaceContracts?.length === 1 &&
    applicant.applicationType === 'Replace'
  ) {
    logger.info(
      applicant.name +
        ': priority 1  - Applicant has 1 active contract for parking space and wishes to replace current parking space'
    )
    return {
      ...applicant,
      priority: 1,
    }
  }

  //priority 2

  //Applicant has 1 active parking space contract and wishes to rent an additional parking space
  if (
    activeParkingspaceContracts?.length === 1 &&
    applicant.applicationType === 'Additional'
  ) {
    logger.info(
      applicant.name +
        ': priority 2 - Applicant has 1 active parking space contract and wishes to rent an additional parking space'
    )
    return {
      ...applicant,
      priority: 2,
    }
  }

  //Applicant has more than 1 active parking space contract and wishes to replace 1 parking space contract
  if (
    activeParkingspaceContracts &&
    activeParkingspaceContracts.length > 1 &&
    applicant.applicationType === 'Replace'
  ) {
    logger.info(
      applicant.name +
        ': priority 2 - Applicant has more than 1 active parking space contract and wishes to replace 1 parking space contract'
    )
    return {
      ...applicant,
      priority: 2,
    }
  }

  //priority 3

  //Applicant has 2 or more active parking space and wishes to rent an additional parking space
  if (activeParkingspaceContracts && activeParkingspaceContracts.length >= 2) {
    logger.info(
      applicant.name +
        ': priority 3 - Applicant has 2 or more active parking space and wishes to rent an additional parking space'
    )
    return {
      ...applicant,
      priority: 3,
    }
  }

  //Applicant is not in any of the 3 priority groups and is not eligible to rent the parking space. Ie because they don't have a housing contract
  logger.info(
    applicant.name +
      ": priority null - Applicant is not in any of the 3 priority groups and is not eligible to rent the parking space. Ie because they don't have a housing contract"
  )
  return {
    ...applicant,
    priority: null,
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

const parseLeasesForHousingContracts = (
  leases: Lease[]
):
  | [
      currentHousingContract: Lease | undefined,
      upcomingHousingContract: Lease | undefined,
    ]
  | undefined => {
  const currentDate = new Date()

  const isHousingContract = (lease: Lease) =>
    [leaseTypes.housingContract, leaseTypes.cooperativeTenancyContract].some(
      (v) => lease.type.includes(v)
    )
  const housingContracts = leases.filter(isHousingContract)
  if (!housingContracts.length) {
    return undefined
  }

  const activeLeases = housingContracts.filter((l) =>
    isCurrentLease(l, currentDate)
  )

  const activeLease =
    activeLeases.length > 1
      ? activeLeases.find((l) => !isLeaseAboutToEnd(l))
      : activeLeases[0]

  const upcomingLease = housingContracts.find((l) =>
    isUpcomingLease(l, currentDate)
  )

  return [activeLease, upcomingLease]
}

const isCurrentLease = (lease: Lease, currentDate: Date) => {
  const compatibleLastDebitDate =
    !lease.lastDebitDate || lease.lastDebitDate > currentDate
  const hasLeaseStarted = lease.leaseStartDate <= currentDate

  return hasLeaseStarted && compatibleLastDebitDate
}

const isUpcomingLease = (lease: Lease, currentDate: Date) => {
  const lastDebitDateNotSet =
    lease.lastDebitDate === null || lease.lastDebitDate === undefined
  const isLeaseUpcoming = lease.leaseStartDate > currentDate

  return lastDebitDateNotSet && isLeaseUpcoming
}

const isLeaseAboutToEnd = (lease: Lease) => {
  const currentDate = new Date()
  const lastDebitDate = lease.lastDebitDate
    ? new Date(lease.lastDebitDate)
    : null

  return !!lastDebitDate && currentDate <= lastDebitDate
}

const parseLeasesForParkingSpaces = (
  leases: Array<Lease & { propertyType?: string }>
): Array<Lease> => {
  return leases.filter((v) => v.propertyType === 'babps') // I think 'babps' is xpands name for "bilplats"
}

export {
  addPriorityToApplicantsBasedOnRentalRules,
  sortApplicantsBasedOnRentalRules,
  assignPriorityToApplicantBasedOnRentalRules,
  parseLeasesForHousingContracts,
  parseLeasesForParkingSpaces,
  isLeaseActiveOrUpcoming,
  isLeaseAboutToEnd,
}
