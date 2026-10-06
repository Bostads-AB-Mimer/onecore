import { useQuery } from '@tanstack/react-query'

import { type KvvAreaResolveParams, kvvAreaService } from '@/services/api/core'

export const useKvvAreaResolve = (params: KvvAreaResolveParams | undefined) => {
  return useQuery({
    queryKey: ['kvvAreaResolve', params],
    queryFn: () => kvvAreaService.resolve(params!),
    enabled: !!params && Object.values(params).every(Boolean),
  })
}
