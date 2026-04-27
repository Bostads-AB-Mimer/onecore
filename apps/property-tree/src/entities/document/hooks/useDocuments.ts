import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fileStorageService } from '@/services/api/core'
import { POST } from '@/services/api/core/baseApi'

import { fileToBase64 } from '@/shared/lib/file'
import { ContextType } from '@/shared/types/ui'

import { extractFileName, getFileTypeFromName } from '../lib/fileUtils'

export interface UseDocumentsOptions {
  /**
   * When provided, returns the full storage key for an uploaded file.
   * In this mode, `deleteFile` and `getDownloadUrl` also accept full paths
   * directly (no `${contextType}/${id}/` prefix is prepended), and the upload
   * mutation result includes the stored path under `path` so the caller can
   * persist it. The list query still uses the default prefix; callers that
   * don't rely on listing can simply ignore `documents`.
   */
  pathBuilder?: (file: File) => string
}

export function useDocuments(
  contextType: ContextType,
  id: string | undefined,
  options?: UseDocumentsOptions
) {
  const queryClient = useQueryClient()
  const prefix = id ? `${contextType}/${id}/` : undefined
  const pathBuilder = options?.pathBuilder

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
      const fullPath = pathBuilder
        ? pathBuilder(file)
        : `${contextType}/${id}/${file.name}`
      const response = await fileStorageService.uploadFile(
        fullPath,
        fileData,
        file.type
      )
      return { ...response, path: fullPath }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['documents', contextType, id],
      })
    },
  })

  // Delete mutation. When `pathBuilder` is set the argument is treated as a
  // full storage key; otherwise it is a file name within the default prefix.
  const deleteMutation = useMutation({
    mutationFn: (fileNameOrPath: string) => {
      if (!id) throw new Error('No ID provided for delete')

      const fullPath = pathBuilder
        ? fileNameOrPath
        : `${contextType}/${id}/${fileNameOrPath}`
      return fileStorageService.deleteFile(fullPath)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['documents', contextType, id],
      })
    },
  })

  // Get download URL. Same path-mode rules as `deleteFile`.
  const getDownloadUrl = async (fileNameOrPath: string) => {
    if (!id) throw new Error('No ID provided for download')

    const fullPath = pathBuilder
      ? fileNameOrPath
      : `${contextType}/${id}/${fileNameOrPath}`
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
