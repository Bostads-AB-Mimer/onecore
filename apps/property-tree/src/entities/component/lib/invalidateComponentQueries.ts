import type { QueryClient } from '@tanstack/react-query'

import { QUERY_KEY_ROOTS } from './componentLibraryQueryKeys'

export const invalidateComponentQueries = (
  queryClient: QueryClient,
  spaceId: string
) => {
  queryClient.invalidateQueries({ queryKey: ['components', spaceId] })
  queryClient.invalidateQueries({ queryKey: ['instances'] })
  queryClient.invalidateQueries({ queryKey: [QUERY_KEY_ROOTS.instance] })
}
