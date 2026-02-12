import { useQuery } from '@tanstack/react-query'
import { commentService } from '@/services/api/core'
import type { TenantComment } from '@/services/types'

export interface UseTenantCommentsReturn {
  data: TenantComment[]
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to fetch tenant comments for a specific contact
 * Automatically sorts by date (most recent first)
 *
 * Note: This hook fetches all comments without server-side filtering.
 * Filtering by comment type is done in the frontend since the number
 * of comments per contact is typically small.
 */
export const useTenantComments = (
  contactCode: string | undefined
): UseTenantCommentsReturn => {
  const query = useQuery({
    queryKey: ['tenant-comments', contactCode],
    queryFn: () => commentService.getCommentsByContactCode(contactCode!),
    enabled: !!contactCode,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Sort comments by date descending (most recent first)
  // Comments without dates are placed at the end
  const sortedData = query.data
    ? [...query.data].sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0
        if (!a.createdAt) return 1
        if (!b.createdAt) return -1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    : []

  return {
    data: sortedData,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  }
}
