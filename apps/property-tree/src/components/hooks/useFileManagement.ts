import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface FileManagementConfig<TFile, TUploadParams> {
  entityId: string
  queryKey: string
  fetchFiles: (entityId: string) => Promise<TFile[]>
  uploadFile: (entityId: string, params: TUploadParams) => Promise<void>
  deleteFile: (entityId: string, fileId: string) => Promise<void>
  createOptimisticFile: (params: TUploadParams) => TFile
  staleTime?: number
}

export function useFileManagement<
  TFile extends { fileId: string },
  TUploadParams extends { file: File },
>({
  entityId,
  queryKey,
  fetchFiles,
  uploadFile,
  deleteFile,
  createOptimisticFile,
  staleTime = 5 * 60 * 1000, // Default 5 minutes
}: FileManagementConfig<TFile, TUploadParams>) {
  const queryClient = useQueryClient()

  // Fetch files with presigned URLs
  const filesQuery = useQuery({
    queryKey: [queryKey, entityId],
    queryFn: async () => {
      const result = await fetchFiles(entityId)
      return result
    },
    staleTime,
  })

  // Upload mutation with optimistic update
  const uploadMutation = useMutation({
    mutationFn: (params: TUploadParams) => uploadFile(entityId, params),
    onMutate: async (params) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [queryKey, entityId] })

      // Snapshot the previous value
      const previousFiles = queryClient.getQueryData<TFile[]>([
        queryKey,
        entityId,
      ])

      // Create optimistic file entry
      const optimisticFile = createOptimisticFile(params)

      // Optimistically update to the new value
      queryClient.setQueryData<TFile[]>([queryKey, entityId], (old) => [
        ...(old || []),
        optimisticFile,
      ])

      // Return context with the previous value
      return { previousFiles }
    },
    onError: (_err, _vars, context) => {
      // Rollback to the previous value on error
      if (context?.previousFiles) {
        queryClient.setQueryData([queryKey, entityId], context.previousFiles)
      }
    },
    onSettled: () => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: [queryKey, entityId] })
    },
  })

  // Delete mutation with optimistic update
  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => deleteFile(entityId, fileId),
    onMutate: async (fileId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [queryKey, entityId] })

      // Snapshot the previous value
      const previousFiles = queryClient.getQueryData<TFile[]>([
        queryKey,
        entityId,
      ])

      // Optimistically update to the new value
      queryClient.setQueryData<TFile[]>(
        [queryKey, entityId],
        (old) => old?.filter((file) => file.fileId !== fileId) || []
      )

      // Return context with the previous value
      return { previousFiles }
    },
    onError: (_err, _fileId, context) => {
      // Rollback to the previous value on error
      if (context?.previousFiles) {
        queryClient.setQueryData([queryKey, entityId], context.previousFiles)
      }
    },
    onSettled: () => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: [queryKey, entityId] })
    },
  })

  return {
    // Query data
    files: filesQuery.data || [],
    isLoading: filesQuery.isLoading,
    error: filesQuery.error,

    // Upload
    upload: uploadMutation.mutate,
    uploadAsync: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,

    // Delete
    deleteFile: deleteMutation.mutate,
    deleteAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error,
  }
}
