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
  const currentHousingContractDistrictCode =
    applicant.currentHousingContract?.residentialArea?.code
  const upcomingHousingContractDistrictCode =
    applicant.upcomingHousingContract?.residentialArea?.code

  //applicant has no housing contracts
  if (
    !currentHousingContractDistrictCode &&
    !upcomingHousingContractDistrictCode
  ) {
    return false
  }

  //applicants current housing contract area does not match listings area
  if (
    currentHousingContractDistrictCode &&
    currentHousingContractDistrictCode !== districtCode
  ) {
    return false
  }

  //applicant has no current housing contract, but an upcoming housing contract
  if (
    !currentHousingContractDistrictCode &&
    upcomingHousingContractDistrictCode
  ) {
    //applicants upcoming housing contract area does not match listings area
    if (currentHousingContractDistrictCode !== districtCode) {
      return false
    }
  }

  return true
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
