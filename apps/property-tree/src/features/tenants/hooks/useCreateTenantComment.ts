import { useMutation, useQueryClient } from '@tanstack/react-query'
import { commentService } from '@/services/api/core'
import type { TenantCommentRaw } from '@/services/types'

interface CreateCommentParams {
  contactCode: string
  content: string
  author: string
}

/**
 * Hook to create a new tenant comment
 * Automatically invalidates the tenant comments cache on success
 */
export const useCreateTenantComment = () => {
  const queryClient = useQueryClient()

  return useMutation<TenantCommentRaw, Error, CreateCommentParams>({
    mutationFn: ({ contactCode, content, author }) =>
      commentService.createContactComment(contactCode, content, author),
    onSuccess: (_, variables) => {
      // Invalidate and refetch comments for this contact
      queryClient.invalidateQueries({
        queryKey: ['tenant-comments', variables.contactCode],
      })
    },
  })
}
