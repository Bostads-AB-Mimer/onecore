import { useQuery } from '@tanstack/react-query'

import { rentalObjectService } from '@/services/api/core'

// Fetches the rental object's rent from both sources for the transition
// comparison: Tenfast (current) and Xpand (legacy)
export function useRentalObjectRents(rentalObjectCode: string) {
  const tenfastQuery = useQuery({
    queryKey: ['rentalObjectRent', rentalObjectCode],
    queryFn: () =>
      rentalObjectService.getRentByRentalObjectCode(rentalObjectCode),
    enabled: !!rentalObjectCode,
  })

  const legacyQuery = useQuery({
    queryKey: ['rentalObjectRentLegacy', rentalObjectCode],
    queryFn: () =>
      rentalObjectService.getLegacyRentByRentalObjectCode(rentalObjectCode),
    enabled: !!rentalObjectCode,
  })

  return { tenfastQuery, legacyQuery }
}
