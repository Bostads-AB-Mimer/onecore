import { useQuery } from '@tanstack/react-query'

import { apartmentTemperatureService } from '@/services/api/core'

const TRAILING_WINDOW_SECONDS = 3 * 60 * 60

export function useApartmentTemperature(objectNumber: string | undefined) {
  return useQuery({
    queryKey: ['apartmentTemperature', objectNumber],
    queryFn: () => {
      const to = Math.floor(Date.now() / 1000)
      const from = to - TRAILING_WINDOW_SECONDS
      return apartmentTemperatureService.getByObjectNumber(objectNumber!, {
        from,
        to,
        interval: 'H',
      })
    },
    enabled: !!objectNumber,
    staleTime: 5 * 60 * 1000,
  })
}
