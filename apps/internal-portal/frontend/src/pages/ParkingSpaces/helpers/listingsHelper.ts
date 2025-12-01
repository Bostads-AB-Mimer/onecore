import { Listing } from '@onecore/types'

export const filterListings = (
  listings: Array<Listing>,
  q?: string
): Array<Listing> => {
  if (!q) return listings

  return listings.filter((l) => {
    const containsRentalObjectCode = l.rentalObjectCode
      .toLowerCase()
      .includes(q.toLowerCase())

    if (!l.applicants) return containsRentalObjectCode

    const containsContactCode = l.applicants.some((a) =>
      a.contactCode.toLowerCase().includes(q.toLowerCase())
    )

    const containsNationalRegistrationNumber = l.applicants.some((a) =>
      a.nationalRegistrationNumber?.includes(q)
    )

    return (
      containsContactCode ||
      containsNationalRegistrationNumber ||
      containsRentalObjectCode
    )
  })
}
