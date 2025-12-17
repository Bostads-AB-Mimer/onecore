import { componentService } from '@/services/api/core/componentService'
import { ComponentImage } from '@/services/types'
import { useFileManagement } from './useFileManagement'

export function useComponentImages(componentId: string) {
  const result = useFileManagement<
    ComponentImage,
    { file: File; caption?: string }
  >({
    entityId: componentId,
    queryKey: 'component-images',
    fetchFiles: (id) => componentService.getImages(id),
    uploadFile: (id, { file, caption }) =>
      componentService.uploadImage(id, file, caption),
    deleteFile: (id, fileId) => componentService.deleteImage(id, fileId),
    createOptimisticFile: ({ file, caption }) => ({
      fileId: `temp-${Date.now()}`,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
      caption: caption,
      url: '',
    }),
  })

  return {
    images: result.files,
    isLoading: result.isLoading,
    error: result.error,
    upload: result.upload,
    uploadAsync: result.uploadAsync,
    isUploading: result.isUploading,
    uploadError: result.uploadError,
    deleteImage: result.deleteFile,
    deleteAsync: result.deleteAsync,
    isDeleting: result.isDeleting,
    deleteError: result.deleteError,
  }
}
