type GetListingWithApplicantFilterByType =
  | 'published'
  | 'ready-for-offer'
  | 'offered'
  | 'historical'
  | 'all'
  | 'closed'

type GetListingsWithApplicantsFilterParams = {
  by?: { type?: GetListingWithApplicantFilterByType }
}

export type {
  GetListingsWithApplicantsFilterParams,
  GetListingWithApplicantFilterByType,
}
