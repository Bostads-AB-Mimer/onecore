import { useQuery } from '@tanstack/react-query'

import { BffRequestError } from '../../api/errors'
import { useLeasingHost } from '../../host/useLeasingHost'
import type { paths } from '../../api/generated/api-types'

export type VacantApartment =
  paths['/bostad/vacant-apartments']['get']['responses'][200]['content']['application/json']['content'][number]

export const vacantApartmentsQueryKey = [
  'leasing',
  'bostad',
  'vacant-apartments',
]

/** The apartments on the Publicera step. Slow upstream (Tenfast paging), so cached a while. */
export function useVacantApartments() {
  const { api } = useLeasingHost()

  return useQuery({
    queryKey: vacantApartmentsQueryKey,
    queryFn: async (): Promise<VacantApartment[]> => {
      const { data, response } = await api.GET('/bostad/vacant-apartments')
      if (!data) throw new BffRequestError(response.status)
      return data.content
    },
    staleTime: 5 * 60 * 1000,
  })
}
