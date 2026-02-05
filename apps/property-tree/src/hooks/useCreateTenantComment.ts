import { useMutation, useQueryClient } from '@tanstack/react-query'
import { commentService } from '@/services/api/core'
import type { TenantCommentRaw } from '@/services/types'

interface CreateCommentParams {
  contactCode: string
  content: string
  author: string
  commentType?: 'Standard' | 'Sökande'
}

/**
 * Hook to create a new tenant comment
 * Automatically invalidates the tenant comments cache on success
 */
export const useCreateTenantComment = () => {
  const queryClient = useQueryClient()

  return useMutation<TenantCommentRaw, Error, CreateCommentParams>({
    mutationFn: ({ contactCode, content, author, commentType = 'Standard' }) =>
      commentService.createContactComment(
        contactCode,
        content,
        author,
        commentType
      ),
    onSuccess: (_, variables) => {
      // Invalidate ALL comment queries for this contact (all filter variants)
      queryClient.invalidateQueries({
        queryKey: ['tenant-comments', variables.contactCode],
      })
    },
  })
}
