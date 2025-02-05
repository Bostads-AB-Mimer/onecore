/*
 * Service for:
 * Fetching and consolidating detailed information on applicants from internal database and xpand
 * Sorting applicants based on rental rules
 */

import { logger } from 'onecore-utilities'
import { DetailedApplicant, Lease, Listing } from 'onecore-types'

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
    listing.districtCode &&
    isListingInAreaWithSpecificRentalRules(listing.districtCode) &&
    !isHousingContractsOfApplicantInSameAreaAsListing(
      listing.districtCode,
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

  if (!applicant.parkingSpaceContracts?.length) {
    //priority  1

    //Applicant has no active parking space contract and is tenant in same area as listing
    if (applicant.currentHousingContract) {
      if (
        applicant.currentHousingContract?.residentialArea?.code ===
        listing.districtCode
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
        listing.districtCode
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
    applicant.parkingSpaceContracts?.length === 1 &&
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
    applicant.parkingSpaceContracts?.length === 1 &&
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
    applicant.parkingSpaceContracts &&
    applicant.parkingSpaceContracts.length > 1 &&
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
  if (
    applicant.parkingSpaceContracts &&
    applicant.parkingSpaceContracts.length >= 2
  ) {
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
    const isHousingContract = [
      leaseTypes.housingContract,
      leaseTypes.cooperativeTenancyContract,
    ].some((v) => lease.type.includes(v))

    if (isHousingContract) {
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
    const currentActiveLease = housingContracts.find((lease) => {
      const compatibleLastDebitDate =
        !lease.lastDebitDate || lease.lastDebitDate > currentDate
      const hasLeaseStarted = lease.leaseStartDate <= currentDate

      return hasLeaseStarted && compatibleLastDebitDate
    })

    if (currentActiveLease == undefined) {
      logger.error(
        'Could not find active lease in parseLeasesForHousingContracts'
      )
      throw new Error('could not find any active lease')
    }

    const upcomingLease = housingContracts.find((lease) => {
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
  addPriorityToApplicantsBasedOnRentalRules,
  sortApplicantsBasedOnRentalRules,
  assignPriorityToApplicantBasedOnRentalRules,
  parseLeasesForHousingContracts,
  parseLeasesForParkingSpaces,
  isLeaseActiveOrUpcoming,
}
