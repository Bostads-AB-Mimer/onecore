import { residenceService } from '@/services/api/core'
import { Staircase } from '@/services/types'
import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

export const useResidenceStaircaseLookupMap = (staircases: Staircase[]) => {
  // Use useQueries to fetch residences for each staircase in parallel.
  const residenceQueries = useQueries({
    queries: staircases.map((staircase) => {
      return {
        queryKey: [
          'staircase-residence',
          staircase.buildingCode,
          staircase.code,
        ],
        queryFn: () =>
          residenceService.getByBuildingCodeAndStaircaseCode(
            staircase.buildingCode,
            staircase.code
          ),
        enabled: !!staircase.code,
      }
    }),
  })

  // Create a lookup map that associates each staircase code with its corresponding residence query.
  // This transforms the array of queries into an object where keys are staircase codes,

  const residenceStaircaseLookupMap = useMemo(
    () =>
      staircases.reduce(
        (acc, staircase, index) => {
          acc[staircase.code] = residenceQueries[index]
          return acc
        },
        {} as Record<string, (typeof residenceQueries)[number]>
      ),
    [residenceQueries, staircases]
  )

  return {
    residenceStaircaseLookupMap,
    isLoading: residenceQueries.some((query) => query.isLoading),
  }
}
