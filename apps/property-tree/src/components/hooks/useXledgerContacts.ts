import { useQuery } from '@tanstack/react-query'
import { economyService } from '@/services/api/core'

export function useXledgerContacts() {
  const xledgerContactsQuery = useQuery({
    queryKey: ['xledger-contacts'],
    queryFn: () => economyService.getXledgerContacts(),
  })

  const isLoading = xledgerContactsQuery.isLoading
  const error = xledgerContactsQuery.error

  return {
    data: xledgerContactsQuery.data,
    isLoading,
    error,
  }
}
