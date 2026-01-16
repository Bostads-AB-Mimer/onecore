import { useDocuments } from './useDocuments'
import { ContextType } from '@/types/ui'

export function useComponentImages(componentId: string) {
  const docs = useDocuments(ContextType.ComponentInstance, componentId)

  return {
    images: docs.documents,
    isLoading: docs.isLoading,
    error: docs.error,
    upload: (file: File) => docs.uploadFile(file),
    uploadAsync: docs.uploadFileAsync,
    isUploading: docs.isUploading,
    uploadError: docs.uploadError,
    deleteImage: (name: string) => docs.deleteFile(name),
    deleteAsync: docs.deleteFileAsync,
    isDeleting: docs.isDeleting,
    getDownloadUrl: docs.getDownloadUrl,
  }
}
