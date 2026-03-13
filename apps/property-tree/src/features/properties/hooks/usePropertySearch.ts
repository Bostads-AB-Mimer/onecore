import { useCallback } from 'react'

import { propertyService } from '@/services/api/core/propertyService'

import type { SearchFilterOption } from '@/shared/ui/filters'

export function usePropertySearch() {
  return useCallback(async (query: string): Promise<SearchFilterOption[]> => {
    const results = await propertyService.searchProperties(query)
    return results.map((p) => ({
      label: p.designation,
      value: p.designation,
    }))
  }, [])
}
