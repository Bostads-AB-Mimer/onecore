import { useDocuments } from '@/entities/document'

import { ContextType } from '@/shared/types/ui'

export function useComponentModelDocuments(modelId: string) {
  const docs = useDocuments(ContextType.ComponentModel, modelId)

  return {
    documents: docs.documents,
    isLoading: docs.isLoading,
    error: docs.error,
    upload: (file: File) => docs.uploadFile(file),
    uploadAsync: docs.uploadFileAsync,
    isUploading: docs.isUploading,
    uploadError: docs.uploadError,
    deleteDocument: (name: string) => docs.deleteFile(name),
    deleteAsync: docs.deleteFileAsync,
    isDeleting: docs.isDeleting,
    getDownloadUrl: docs.getDownloadUrl,
  }
}
