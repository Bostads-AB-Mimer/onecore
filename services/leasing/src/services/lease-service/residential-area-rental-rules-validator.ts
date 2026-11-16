import {
  DetailedApplicant,
  Lease,
  LeaseStatus,
  ResidentialArea,
} from '@onecore/types'

//todo: we might need to consider and validate if a housing contract is ending
//todo: if so we need datetime logic for checkin contract end dates etc

const residentialAreasWithSpecificRentalRules: ResidentialArea[] = [
  {
    code: 'CEN',
    caption: 'Centrum',
  },
  {
    code: 'OXB',
    caption: 'Oxbacken',
  },
  {
    code: 'GRY',
    caption: 'Gryta',
  },
]

const isListingInAreaWithSpecificRentalRules = (districtCode: string) => {
  return residentialAreasWithSpecificRentalRules.some(
    (area) => area.code === districtCode
  )
}

const isHousingContractsOfApplicantInSameAreaAsListing = (
  districtCode: string,
  applicant: Pick<
    DetailedApplicant,
    'currentHousingContract' | 'upcomingHousingContract'
  >
): boolean => {
  const { currentHousingContract, upcomingHousingContract } = applicant

  if (upcomingHousingContract) {
    return upcomingHousingContract.residentialArea?.code === districtCode
  }

  if (currentHousingContract) {
    return currentHousingContract.residentialArea?.code === districtCode
  }

  return false
}

// A parking space lease under notice, given notice on or ended does not count
// when the rental rules choose between Additional and Replace. Replace means
// "I will give notice on my current space", so a space the tenant has already
// given notice on must not force it.
const parkingSpaceLeaseStatusesNotCounted = [
  LeaseStatus.PreliminaryTerminated,
  LeaseStatus.AboutToEnd,
  LeaseStatus.Ended,
]

const getParkingSpaceContractsCountedByRentalRules = (
  parkingSpaceContracts: Lease[] | undefined
): Lease[] =>
  (parkingSpaceContracts ?? []).filter(
    (lease) => !parkingSpaceLeaseStatusesNotCounted.includes(lease.status)
  )

const doesApplicantHaveParkingSpaceContractsInSameAreaAsListing = (
  districtCode: string,
  applicant: Pick<DetailedApplicant, 'parkingSpaceContracts'>
) => {
  return getParkingSpaceContractsCountedByRentalRules(
    applicant.parkingSpaceContracts
  ).some(
    (parkingSpaceContract) =>
      parkingSpaceContract.residentialArea?.code === districtCode
  )
}

export {
  isListingInAreaWithSpecificRentalRules,
  isHousingContractsOfApplicantInSameAreaAsListing,
  doesApplicantHaveParkingSpaceContractsInSameAreaAsListing,
  getParkingSpaceContractsCountedByRentalRules,
}
