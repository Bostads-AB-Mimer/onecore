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
  roomName?: string | null
  target: InspectionPhotoTarget
}

// Slugify for storage-key readability. Folds Swedish diacritics (å/ä → a,
// ö → o), lowercases, replaces non-alphanumerics with hyphens, and trims
// leading/trailing/duplicate hyphens. Used only for path readability —
// the immutable `roomId` is appended for stability across renames.
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function roomSegment(roomId: string, roomName?: string | null): string {
  const slug = roomName ? slugify(roomName) : ''
  return slug ? `${slug}-${roomId}` : roomId
}

// Photos are always JPEG-compressed before upload (see compressToJpegFile),
// so the storage key extension is fixed.
function buildInspectionPhotoPath(
  inspectionId: string,
  roomId: string,
  roomName: string | null | undefined,
  target: InspectionPhotoTarget
): string {
  const uuid = crypto.randomUUID()
  const base = `${ContextType.InspectionPhoto}/${inspectionId}/room/${roomSegment(roomId, roomName)}`
  if (target.kind === 'surface') {
    return `${base}/surface/${target.surfaceKey}/${uuid}.jpg`
  }
  return `${base}/component/${target.componentId}/${uuid}.jpg`
}

export function useInspectionPhotos(inspectionId: string) {
  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      roomId,
      roomName,
      target,
    }: UploadInspectionPhotoArgs) => {
      const fileData = await fileToBase64(file)
      const path = buildInspectionPhotoPath(
        inspectionId,
        roomId,
        roomName,
        target
      )
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
    uploadError: uploadMutation.error,
    deleteAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    getDownloadUrl: (path: string) => fileStorageService.getFileUrl(path),
  }
}
