import { authConfig } from '@/auth-config'

import type { KeySystemSchemaDownloadUrlResponse } from '../types'
import { GET, DELETE } from './core/base-api'

export const keySystemSchemaService = {
  /**
   * Upload a PDF schema file for a key system
   * Note: Uses raw fetch() instead of POST helper because multipart/form-data
   * is not supported by the type-safe base-api helpers (same pattern as receiptService)
   */
  async uploadFile(keySystemId: string, file: File): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(
      `${authConfig.apiUrl}/key-systems/${keySystemId}/upload-schema`,
      {
        method: 'POST',
        body: formData,
        credentials: 'include',
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error || errorData.reason || 'Failed to upload file'
      )
    }
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
