import { useQuery } from '@tanstack/react-query'

import { buildingService } from '@/services/api/core'

import type { PropertyDetail } from '@/shared/types/api'

import { useProperty } from './useProperty'

export function usePropertyDetails(propertyCode: string | undefined) {
  const propertyQuery = useProperty(propertyCode)

  const buildingsQuery = useQuery({
    queryKey: ['buildings', propertyQuery.data?.code],
    queryFn: () => buildingService.getByPropertyCode(propertyQuery.data!.code),
    enabled: !!propertyQuery.data?.code,
  })

  const isLoading = propertyQuery.isLoading || buildingsQuery.isLoading
  const error = propertyQuery.error || buildingsQuery.error

  return {
    data: {
      ...propertyQuery.data,
      buildings: buildingsQuery.data || [],
    } as PropertyDetail | undefined,
    isLoading,
    error,
  }
}
