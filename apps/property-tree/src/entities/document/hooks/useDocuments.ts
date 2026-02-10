import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fileStorageService } from '@/services/api/core'
import { POST } from '@/services/api/core/base-api'
import { ContextType } from '@/shared/types/ui'
import { fileToBase64 } from '@/shared/lib/file'
import { extractFileName, getFileTypeFromName } from '../lib/file-utils'

export function useDocuments(contextType: ContextType, id: string | undefined) {
  const queryClient = useQueryClient()
  const prefix = id ? `${contextType}/${id}/` : undefined

  // Fetch documents for this context
  const documentsQuery = useQuery({
    queryKey: ['documents', contextType, id],
    queryFn: async () => {
      if (!prefix) return []

      const fileListItems = await fileStorageService.listFiles(prefix)

      // Transform FileListItem objects to Document objects
      const mappedFiles = fileListItems.map((fileItem) => {
        const name = extractFileName(fileItem.name, prefix)
        const type = getFileTypeFromName(fileItem.name)

        return {
          id: fileItem.name,
          name,
          type,
          fullPath: fileItem.name,
          size: fileItem.size,
          lastModified: fileItem.lastModified,
          etag: fileItem.etag,
        }
      })

      return mappedFiles
    },
    enabled: !!id,
  })

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!id) throw new Error('No ID provided for upload')

      // Convert file to base64
      const fileData = await fileToBase64(file)

      // For component types, use backend endpoints that create DB records
      if (contextType === ContextType.ComponentInstance) {
        const { data, error } = await POST('/components/{id}/upload', {
          params: { path: { id } },
          body: {
            fileData,
            fileName: file.name,
            contentType: file.type,
          },
        })
        if (error) throw new Error('Upload failed')
        return data
      }

      if (contextType === ContextType.ComponentModel) {
        const { data, error } = await POST('/component-models/{id}/upload', {
          params: { path: { id } },
          body: {
            fileData,
            fileName: file.name,
            contentType: file.type,
          },
        })
        if (error) throw new Error('Upload failed')
        return data
      }

      // Fallback for other context types (property, building, residence, tenant)
      // Keep using file-storage directly (no DB linking needed for these)
      const fullPath = `${contextType}/${id}/${file.name}`
      return fileStorageService.uploadFile(fullPath, fileData, file.type)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['documents', contextType, id],
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (fileName: string) => {
      if (!id) throw new Error('No ID provided for delete')

      const fullPath = `${contextType}/${id}/${fileName}`
      return fileStorageService.deleteFile(fullPath)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['documents', contextType, id],
      })
    },
  })

  // Get download URL
  const getDownloadUrl = async (fileName: string) => {
    if (!id) throw new Error('No ID provided for download')

    const fullPath = `${contextType}/${id}/${fileName}`
    return fileStorageService.getFileUrl(fullPath)
  }

  return {
    documents: documentsQuery.data || [],
    isLoading: documentsQuery.isLoading,
    error: documentsQuery.error,
    uploadFile: uploadMutation.mutate,
    uploadFileAsync: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
    deleteFile: deleteMutation.mutate,
    deleteFileAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    getDownloadUrl,
  }
}
