enum CreateNoteOfInterestErrorCodes {
  ParkingspaceNotFound = 'parkingspace-not-found',
  ParkingspaceNotInternal = 'parkingspace-not-internal',
  ApplicantNotFound = 'applicant-not-found',
  ApplicantNotTenant = 'applicant-not-tenant',
  NotEligibleToRent = 'not-eligible-to-rent',
  InternalCreditCheckFailed = 'internal-credit-check-failed',
  InternalError = 'internal-error',
  Unknown = 'unknown'
}

export {
  CreateNoteOfInterestErrorCodes
}