enum ReplyToOfferErrorCodes {
  NoOffer = 'no-offer',
  NoActiveOffer = 'no-active-offer',
  NoListing = 'no-listing',
  CreateLeaseFailure = 'create-lease-failure',
  CloseOfferFailure = 'close-offer-failure',
  Unknown = 'unknown',
  ApplicantNotTenant = 'applicant-not-tenant',
  NotEligibleToRent = 'not-eligible-to-rent',
  RentalObjectNotAvailable = 'rental-object-not-available',
  // A service the process depends on is temporarily down; trying again later may work.
  ServiceUnavailable = 'service-unavailable',
}

export { ReplyToOfferErrorCodes }
