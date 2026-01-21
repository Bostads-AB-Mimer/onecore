import { residenceService } from '@/services/api/core'
import { useQuery } from '@tanstack/react-query'

export function useRentalBlocks(rentalId: string | undefined) {
  const rentalBlocksQuery = useQuery({
    queryKey: ['rentalBlocks', rentalId],
    queryFn: () => residenceService.getRentalBlocksByRentalId(rentalId!),
    enabled: !!rentalId,
  })

  const isLoading = rentalBlocksQuery.isLoading
  const error = rentalBlocksQuery.error

  return {
    data: rentalBlocksQuery.data,
    isLoading,
    error,
  }
}
