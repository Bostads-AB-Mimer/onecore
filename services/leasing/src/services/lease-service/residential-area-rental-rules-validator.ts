import { DetailedApplicant, ResidentialArea } from 'onecore-types'

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

const doesApplicantHaveParkingSpaceContractsInSameAreaAsListing = (
  districtCode: string,
  applicant: Pick<DetailedApplicant, 'parkingSpaceContracts'>
) => {
  if (!applicant.parkingSpaceContracts) {
    return false
  }

  return applicant.parkingSpaceContracts.some(
    (parkingSpaceContract) =>
      parkingSpaceContract.residentialArea?.code === districtCode
  )
}

export {
  isListingInAreaWithSpecificRentalRules,
  isHousingContractsOfApplicantInSameAreaAsListing,
  doesApplicantHaveParkingSpaceContractsInSameAreaAsListing,
}
