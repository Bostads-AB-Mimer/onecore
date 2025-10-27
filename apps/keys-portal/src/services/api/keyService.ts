// services/api/keyService.ts
import type {
  Key,
  KeySystem,
  CreateKeyRequest,
  UpdateKeyRequest,
  CreateKeySystemRequest,
  UpdateKeySystemRequest,
  PaginatedResponse,
} from '@/services/types'
import { querySerializer } from '@/utils/querySerializer'

import { GET, POST, PATCH, DELETE } from './core/base-api'

// Helper to ensure paginated response has proper structure
function ensurePaginatedResponse<T>(data: any): PaginatedResponse<T> {
  return {
    content: data?.content ?? [],
    _meta: data?._meta ?? {
      totalRecords: 0,
      page: 1,
      limit: 60,
      count: 0,
    },
    _links: data?._links ?? [],
  }
}

export const keyService = {
  // ------- KEYS -------
  async getAllKeys(
    page: number = 1,
    limit: number = 60
  ): Promise<PaginatedResponse<Key>> {
    const { data, error } = await GET('/keys', {
      params: { query: { page, limit } },
    })
    if (error) throw error
    return ensurePaginatedResponse<Key>(data)
  },

  async getKey(id: string): Promise<Key> {
    const { data, error } = await GET('/keys/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content as Key
  },

  async createKey(payload: CreateKeyRequest): Promise<Key> {
    const { data, error } = await POST('/keys', { body: payload })
    if (error) throw error
    return data?.content as Key
  },

  async updateKey(id: string, payload: UpdateKeyRequest): Promise<Key> {
    const { data, error } = await PATCH('/keys/{id}', {
      params: { path: { id } },
      body: payload,
    })
    if (error) throw error
    return data?.content as Key
  },

  async deleteKey(id: string): Promise<void> {
    const { error } = await DELETE('/keys/{id}', { params: { path: { id } } })
    if (error) throw error
  },

  async searchKeys(
    searchParams: Record<string, string | number | string[] | undefined>,
    page: number = 1,
    limit: number = 60
  ): Promise<PaginatedResponse<Key>> {
    const { data, error } = await GET('/keys/search', {
      params: { query: { ...searchParams, page, limit } },
      querySerializer,
    })
    if (error) throw error
    return ensurePaginatedResponse<Key>(data)
  },

  async getKeysByRentalObjectCode(rentalObjectCode: string): Promise<Key[]> {
    const { data, error } = await GET(
      '/keys/by-rental-object/{rentalObjectCode}',
      {
        params: { path: { rentalObjectCode } },
      }
    )
    if (error) throw error
    return (data?.content ?? []) as Key[]
  },

  async bulkUpdateFlex(
    rentalObjectCode: string,
    flexNumber: number
  ): Promise<{ updatedCount: number }> {
    const { data, error } = await POST('/keys/bulk-update-flex', {
      body: { rentalObjectCode, flexNumber },
    })
    if (error) throw error
    return data?.content as { updatedCount: number }
  },

  // ------- KEY SYSTEMS -------
  async getAllKeySystems(
    page: number = 1,
    limit: number = 60
  ): Promise<PaginatedResponse<KeySystem>> {
    const { data, error } = await GET('/key-systems', {
      params: { query: { page, limit } },
    })
    if (error) throw error
    return ensurePaginatedResponse<KeySystem>(data)
  },

  async getKeySystem(id: string): Promise<KeySystem> {
    const { data, error } = await GET('/key-systems/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content as KeySystem
  },

  async createKeySystem(payload: CreateKeySystemRequest): Promise<KeySystem> {
    const { data, error, response } = await POST('/key-systems', {
      body: payload,
    })
    if (error || !response.ok) {
      const msg = (error as any)?.error ?? 'Failed to create key system'
      const err = new Error(msg)
      ;(err as any).status = response.status
      throw err
    }
    return data?.content as KeySystem
  },

  async updateKeySystem(
    id: string,
    payload: UpdateKeySystemRequest
  ): Promise<KeySystem> {
    const { data, error, response } = await PATCH('/key-systems/{id}', {
      params: { path: { id } },
      body: payload,
    })
    if (error || !response.ok) {
      const msg = (error as any)?.error ?? 'Failed to update key system'
      const err = new Error(msg)
      ;(err as any).status = response.status
      throw err
    }
    return data?.content as KeySystem
  },

  async deleteKeySystem(id: string): Promise<void> {
    const { error } = await DELETE('/key-systems/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
  },

  async searchKeySystems(
    searchParams: Record<string, string | number | string[] | undefined>,
    page: number = 1,
    limit: number = 60
  ): Promise<PaginatedResponse<KeySystem>> {
    const { data, error } = await GET('/key-systems/search', {
      params: { query: { ...searchParams, page, limit } },
      querySerializer,
    })
    if (error) throw error
    return ensurePaginatedResponse<KeySystem>(data)
  },
}
