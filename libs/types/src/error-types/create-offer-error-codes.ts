enum CreateOfferErrorCodes {
  NoListing = 'no-listing',
  ListingNotExpired = 'listing-not-expired',
  NoApplicants = 'no-applicants',
  UpdateListingStatusFailure = 'update-listing-status-failure',
  NoContact = 'no-contact',
  UpdateApplicantStatusFailure = 'update-applicant-status-failure',
  CreateOfferFailure = 'create-offer-failure',
  SendEmailFailure = 'send-email-failure',
  Unknown = 'unknown',
}

export { CreateOfferErrorCodes }
