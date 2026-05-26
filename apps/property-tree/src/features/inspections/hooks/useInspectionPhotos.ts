import { useMutation } from '@tanstack/react-query'

import { fileStorageService } from '@/services/api/core'

import { fileToBase64 } from '@/shared/lib/file'
import { ContextType } from '@/shared/types/ui'

export type InspectionPhotoTarget =
  | { kind: 'surface'; surfaceKey: string }
  | { kind: 'component'; componentId: string }

export interface UploadInspectionPhotoArgs {
  file: File
  roomId: string
  target: InspectionPhotoTarget
}

// Photos are always JPEG-compressed before upload (see compressToJpegFile),
// so the storage key extension is fixed.
function buildInspectionPhotoPath(
  inspectionId: string,
  roomId: string,
  target: InspectionPhotoTarget
): string {
  const uuid = crypto.randomUUID()
  const base = `${ContextType.InspectionPhoto}/${inspectionId}/room/${roomId}`
  if (target.kind === 'surface') {
    return `${base}/surface/${target.surfaceKey}/${uuid}.jpg`
  }
  return `${base}/component/${target.componentId}/${uuid}.jpg`
}

export function useInspectionPhotos(inspectionId: string) {
  const uploadMutation = useMutation({
    mutationFn: async ({ file, roomId, target }: UploadInspectionPhotoArgs) => {
      const fileData = await fileToBase64(file)
      const path = buildInspectionPhotoPath(inspectionId, roomId, target)
      await fileStorageService.uploadFile(path, fileData, file.type)
      return path
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (path: string) => {
      try {
        await fileStorageService.deleteFile(path)
      } catch (err) {
        // Tolerate already-gone files; surface anything else.
        // openapi-fetch errors don't have a stable status field, so we
        // use a permissive check.
        const message = err instanceof Error ? err.message : String(err)
        if (/404|not.?found/i.test(message)) return
        throw err
      }
    },
  })

  return {
    uploadAsync: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    deleteAsync: deleteMutation.mutateAsync,
  }
}
