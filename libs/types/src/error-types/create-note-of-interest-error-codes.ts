enum CreateNoteOfInterestErrorCodes {
  ParkingspaceNotFound = 'parkingspace-not-found',
  ParkingspaceNotInternal = 'parkingspace-not-internal',
  ApplicantNotFound = 'applicant-not-found',
  ApplicantNotTenant = 'applicant-not-tenant',
  NotEligibleToRent = 'not-eligible-to-rent',
  InternalCreditCheckFailed = 'internal-credit-check-failed',
  InternalError = 'internal-error',
  // A service the process depends on is temporarily down; trying again later may work.
  ServiceUnavailable = 'service-unavailable',
  Unknown = 'unknown',
}

export { CreateNoteOfInterestErrorCodes }
