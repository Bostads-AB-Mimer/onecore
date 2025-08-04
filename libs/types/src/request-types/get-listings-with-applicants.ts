type GetListingWithApplicantFilterByType =
  | 'published'
  | 'ready-for-offer'
  | 'offered'
  | 'historical'
  | 'needs-republish'

type GetListingsWithApplicantsFilterParams = {
  by?: { type?: GetListingWithApplicantFilterByType }
}

export type {
  GetListingsWithApplicantsFilterParams,
  GetListingWithApplicantFilterByType,
}
