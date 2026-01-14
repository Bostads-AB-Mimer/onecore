import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fileStorageService } from '@/services/api/core'
import { ContextType } from '@/types/ui'

// Helper to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      // Extract base64 data (remove "data:mime/type;base64," prefix)
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = (error) => reject(error)
  })
}

// Helper to extract filename from full path
const extractFileName = (fullPath: string, prefix: string): string => {
  return fullPath.replace(prefix, '')
}

// Helper to derive file type from extension
const getFileTypeFromName = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase()

  const typeMap: Record<string, string> = {
    pdf: 'PDF',
    doc: 'Word',
    docx: 'Word',
    xls: 'Excel',
    xlsx: 'Excel',
    dwg: 'DWG',
    jpg: 'Bild',
    jpeg: 'Bild',
    png: 'Bild',
    gif: 'Bild',
    txt: 'Text',
    zip: 'Arkiv',
    rar: 'Arkiv',
  }

  return typeMap[extension || ''] || 'Okänd'
}

export interface Document {
  id: string
  name: string
  type: string
  fullPath: string
  size: number
  lastModified: string
  etag: string
}

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
    deleteFile: deleteMutation.mutate,
    deleteFileAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    getDownloadUrl,
  }
}
