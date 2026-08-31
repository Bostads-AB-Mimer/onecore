import type { FileListItem, FileMetadata } from '@onecore/types'

import { DELETE, GET, POST } from './baseApi'

export const fileStorageService = {
  // Upload a file
  async uploadFile(
    fileName: string,
    fileData: string,
    contentType: string
  ): Promise<{ fileName?: string; message?: string }> {
    const { data, error } = await POST('/files/upload', {
      body: {
        fileName,
        fileData, // Base64 encoded
        contentType,
      },
    })

    if (error) throw error
    if (!data?.content) throw new Error('Failed to upload file')

    return data.content
  },

  // Get presigned URL for file download
  async getFileUrl(
    fileName: string,
    expirySeconds: number = 3600
  ): Promise<string> {
    const { data, error } = await GET('/files/{fileName}/url', {
      params: {
        path: { fileName },
        query: { expirySeconds },
      },
    })

    if (error) throw error
    if (!data?.content?.url) throw new Error('Failed to get file URL')

    return data.content.url
  },

  // Get file metadata
  async getFileMetadata(fileName: string): Promise<FileMetadata> {
    const { data, error } = await GET('/files/{fileName}/metadata', {
      params: { path: { fileName } },
    })

    if (error) throw error

    // The API returns metadata but the type is 'never' in the generated schema
    const response = data as any
    if (!response?.content) throw new Error('File metadata not found')

    return response.content as FileMetadata
  },

  // Delete a file
  async deleteFile(fileName: string): Promise<void> {
    const { error } = await DELETE('/files/{fileName}', {
      params: { path: { fileName } },
    })

    if (error) throw error
  },

  // Check if file exists
  async fileExists(fileName: string): Promise<boolean> {
    const { data, error } = await GET('/files/{fileName}/exists', {
      params: { path: { fileName } },
    })

    if (error) throw error

    // The API returns exists status but the type is 'never' in the generated schema
    const response = data as any
    return response?.content?.exists ?? false
  },

  // List files with optional prefix filter
  async listFiles(prefix?: string): Promise<FileListItem[]> {
    const { data, error } = await GET('/files', {
      params: { query: prefix ? { prefix } : {} },
    })

    if (error) throw error

    console.log('Listed files data:', data)

    // The generated types say files is string[], but the API actually returns FileListItem[]
    return (data?.content?.files as any as FileListItem[]) || []
  },
}
