import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'

import { residenceService } from '@/services/api/core'
import { Staircase } from '@/services/types'

export const useResidenceStaircaseLookupMap = (staircases: Staircase[]) => {
  // Memoize the queries array to prevent duplicate queries when staircases array reference changes
  const queries = useMemo(
    () =>
      staircases.map((staircase) => {
        return {
          queryKey: [
            'staircase-residence',
            staircase.building?.buildingCode,
            staircase.code,
          ],
          queryFn: () =>
            residenceService.getByBuildingCodeAndStaircaseCode(
              staircase.building?.buildingCode ?? '',
              staircase.code
            ),
          enabled: !!staircase.code,
        }
      }),
    [staircases]
  )

  // Use useQueries to fetch residences for each staircase in parallel.
  const residenceQueries = useQueries({ queries })

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
