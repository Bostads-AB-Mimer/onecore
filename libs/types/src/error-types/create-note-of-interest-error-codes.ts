enum CreateNoteOfInterestErrorCodes {
  ParkingspaceNotFound = 'parkingspace-not-found',
  ParkingspaceNotInternal = 'parkingspace-not-internal',
  ApplicantNotFound = 'applicant-not-found',
  ApplicantNotTenant = 'applicant-not-tenant',
  // The applicant has given notice on their only housing contract and has no
  // upcoming one, so they may not rent a scored parking space.
  HousingContractTerminated = 'housing-contract-terminated',
  NotEligibleToRent = 'not-eligible-to-rent',
  InternalCreditCheckFailed = 'internal-credit-check-failed',
  InternalError = 'internal-error',
  // A service the process depends on is temporarily down, e.g. the parking
  // space's rent or the applicant's invoices; trying again later may work.
  ServiceUnavailable = 'service-unavailable',
  Unknown = 'unknown',
}

export { CreateNoteOfInterestErrorCodes }
