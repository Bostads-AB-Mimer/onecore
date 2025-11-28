import {
  ComponentInstance,
  ComponentImage,
  ComponentModelDocument,
} from '../../types'
import { GET, POST, DELETE } from './base-api'

export const componentService = {
  async getByRoomId(roomId: string): Promise<ComponentInstance[]> {
    const { data, error } = await GET('/components/by-room/{roomId}', {
      params: {
        path: {
          roomId,
        },
      },
    })
    if (error) throw error
    // Type assertion needed - API response schema differs from database schema
    return (data?.content || []) as ComponentInstance[]
  },

  // Component Instance Image Operations
  async uploadImage(
    componentId: string,
    file: File,
    caption?: string
  ): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)

    const { error } = await POST('/api/components/{id}/upload', {
      params: {
        path: { id: componentId },
        query: caption ? { caption } : undefined,
      },
      body: formData as any,
      bodySerializer: (body) => body as any,
    })

    if (error) throw error
  },

  async getImages(componentId: string): Promise<ComponentImage[]> {
    console.log(
      '[componentService.getImages] Fetching images for:',
      componentId
    )
    const { data, error } = await GET('/api/components/{id}/files', {
      params: {
        path: { id: componentId },
      },
    })

    if (error) throw error

    // Type assertion needed - OpenAPI spec has incomplete response schema
    const images = ((data as any)?.content?.files as ComponentImage[]) || []
    console.log(
      '[componentService.getImages] Returning:',
      images.length,
      'images'
    )
    return images
  },

  async deleteImage(componentId: string, fileId: string): Promise<void> {
    const { error } = await DELETE('/api/components/{id}/files/{fileId}', {
      params: {
        path: { id: componentId, fileId },
      },
    })

    if (error) throw error
  },

  // Component Model Document Operations
  async uploadModelDocument(modelId: string, file: File): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)

    const { error } = await POST('/api/component-models/{id}/upload', {
      params: {
        path: { id: modelId },
      },
      body: formData as any,
      bodySerializer: (body) => body as any,
    })

    if (error) throw error
  },

  async getModelDocuments(modelId: string): Promise<ComponentModelDocument[]> {
    const { data, error } = await GET('/api/component-models/{id}/documents', {
      params: {
        path: { id: modelId },
      },
    })

    if (error) throw error

    // API returns {content: {documents: [...]}}
    // Type assertion needed - OpenAPI spec has incomplete response schema
    return ((data as any)?.content?.documents as ComponentModelDocument[]) || []
  },

  async deleteModelDocument(modelId: string, fileId: string): Promise<void> {
    const { error } = await DELETE(
      '/api/component-models/{id}/documents/{fileId}',
      {
        params: {
          path: { id: modelId, fileId },
        },
      }
    )

    if (error) throw error
  },
}
