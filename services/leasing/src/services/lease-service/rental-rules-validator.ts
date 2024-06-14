import { DetailedApplicant, Listing, ResidentialArea } from 'onecore-types'

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

const isListingInAreaWithSpecificRentalRules = (listing: Listing) => {
  return residentialAreasWithSpecificRentalRules.some(
    (area) => area.code === listing.districtCode
  )
}

const isHousingContractsOfApplicantInSameAreaAsListing = (
  listing: Listing,
  applicant: DetailedApplicant
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
    currentHousingContractDistrictCode != listing.districtCode
  ) {
    return false
  }

  //applicant has no current housing contract, but an upcoming housing contract
  if (
    !currentHousingContractDistrictCode &&
    upcomingHousingContractDistrictCode
  ) {
    //applicants upcoming housing contract area does not match listings area
    if (currentHousingContractDistrictCode != listing.districtCode) {
      return false
    }
  }

  return true
}

const doesApplicantHaveParkingSpaceContractsInSameAreaAsListing = (
  listing: Listing,
  applicant: DetailedApplicant
) => {
  if (!applicant.parkingSpaceContracts) {
    return false
  }

  return applicant.parkingSpaceContracts.some(
    (parkingSpaceContract) =>
      parkingSpaceContract.residentialArea?.code === listing.districtCode
  )
}

export {
  isListingInAreaWithSpecificRentalRules,
  isHousingContractsOfApplicantInSameAreaAsListing,
  doesApplicantHaveParkingSpaceContractsInSameAreaAsListing,
}
