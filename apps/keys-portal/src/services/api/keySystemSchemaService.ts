import { blobToBase64 } from '@/utils/fileUtils'

import type { KeySystemSchemaDownloadUrlResponse } from '../types'
import { GET, POST, DELETE } from './core/base-api'

export const keySystemSchemaService = {
  /**
   * Upload a PDF schema file for a key system using base64 encoding
   */
  async uploadFile(keySystemId: string, file: File): Promise<void> {
    const base64Content = await blobToBase64(file)

    const { error } = await POST('/key-systems/{id}/upload-schema', {
      params: { path: { id: keySystemId } },
      body: {
        fileData: base64Content,
        fileContentType: file.type || 'application/pdf',
        fileName: file.name,
      },
    })
    if (error) throw error
  },

  /**
   * Get a presigned download URL for a key system's schema PDF file
   * The URL expires after 1 hour (file remains in storage indefinitely)
   */
  async getDownloadUrl(
    keySystemId: string
  ): Promise<KeySystemSchemaDownloadUrlResponse> {
    const { data, error } = await GET('/key-systems/{id}/download-schema', {
      params: { path: { id: keySystemId } },
    })
    if (error) throw error
    // Backend wraps response in 'content' property
    return (data as any).content as KeySystemSchemaDownloadUrlResponse
  },

  /**
   * Download a key system's schema PDF file
   */
  async downloadFile(keySystemId: string): Promise<void> {
    const { url } = await this.getDownloadUrl(keySystemId)
    window.open(url, '_blank')
  },

  /**
   * Delete a key system's schema file
   */
  async deleteFile(keySystemId: string): Promise<void> {
    const { error } = await DELETE('/key-systems/{id}/schema', {
      params: { path: { id: keySystemId } },
    })
    if (error) throw error
  },
}
