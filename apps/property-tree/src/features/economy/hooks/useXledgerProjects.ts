import { useQuery } from '@tanstack/react-query'

import { economyService } from '@/services/api/core'

export function useXledgerProjects() {
  const xledgerProjectsQuery = useQuery({
    queryKey: ['xledger-projects'],
    queryFn: () => economyService.getXledgerProjects(),
  })

  const isLoading = xledgerProjectsQuery.isLoading
  const error = xledgerProjectsQuery.error

  return {
    data: xledgerProjectsQuery.data,
    isLoading,
    error,
  }
}
