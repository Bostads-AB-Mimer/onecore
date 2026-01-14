import { componentService } from '@/services/api/core/componentService'
import { DocumentWithUrl } from '@/services/types'
import { useFileManagement } from './useFileManagement'

export function useComponentModelDocuments(modelId: string) {
  const result = useFileManagement<DocumentWithUrl, { file: File }>({
    entityId: modelId,
    queryKey: 'component-model-documents',
    fetchFiles: (id) => componentService.getModelDocuments(id),
    uploadFile: (id, { file }) =>
      componentService.uploadModelDocument(id, file),
    deleteFile: (_id, { documentId, fileId }) =>
      componentService.deleteModelDocument(documentId, fileId),
    createOptimisticFile: ({ file }) => ({
      id: `temp-${Date.now()}`,
      fileId: `temp-${Date.now()}`,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
      createdAt: new Date().toISOString(),
      url: '',
    }),
  })

  return {
    documents: result.files,
    isLoading: result.isLoading,
    error: result.error,
    upload: result.upload,
    uploadAsync: result.uploadAsync,
    isUploading: result.isUploading,
    uploadError: result.uploadError,
    deleteDocument: result.deleteFile,
    deleteAsync: result.deleteAsync,
    isDeleting: result.isDeleting,
    deleteError: result.deleteError,
  }
}
