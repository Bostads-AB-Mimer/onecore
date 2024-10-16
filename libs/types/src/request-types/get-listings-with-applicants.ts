type GetListingWithApplicantFilterByType =
  | 'published'
  | 'ready-for-offer'
  | 'offered'
  | 'historical'

type GetListingsWithApplicantsFilterParams = {
  by?: { type?: GetListingWithApplicantFilterByType }
}

export type {
  GetListingsWithApplicantsFilterParams,
  GetListingWithApplicantFilterByType,
}
