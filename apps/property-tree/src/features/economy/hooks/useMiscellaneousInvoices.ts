import { MiscellaneousInvoice } from '@onecore/types'
import { useInfiniteQuery } from '@tanstack/react-query'

import { economyService } from '@/services/api/core/economyService'

export function useMiscellaneousInvoices(filters?: {
  from?: string
  to?: string
}) {
  const query = useInfiniteQuery({
    queryKey: ['miscellaneous-invoices', filters?.from, filters?.to],
    queryFn: ({ pageParam }) =>
      economyService.getMiscellaneousInvoices({
        from: filters?.from,
        to: filters?.to,
        after: pageParam,
        pageSize: 100,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })

  const data: MiscellaneousInvoice[] =
    query.data?.pages.flatMap((p) => p.content) ?? []

  return {
    data,
    isLoading: query.isLoading,
    error: query.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  }
}
