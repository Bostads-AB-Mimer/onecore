// services/api/keyService.ts
import type {
  Key,
  KeySystem,
  CreateKeyRequest,
  UpdateKeyRequest,
  CreateKeySystemRequest,
  UpdateKeySystemRequest,
} from '@/services/types'

import { GET, POST, PATCH, DELETE } from './core/base-api'

export const keyService = {
  // ------- KEYS -------
  async getAllKeys(): Promise<Key[]> {
    const { data, error } = await GET('/keys')
    if (error) throw error
    return data?.content ?? []
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

  async searchKeys(params: {
    q?: string
    fields?: string
    id?: string
    keyName?: string
    keySequenceNumber?: string
    flexNumber?: string
    rentalObjectCode?: string
    keyType?: string
    keySystemId?: string
    createdAt?: string
    updatedAt?: string
  }): Promise<Key[]> {
    const { data, error } = await GET('/keys/search', {
      params: { query: params },
    })
    if (error) throw error
    return data?.content ?? []
  },

  // ------- KEY SYSTEMS -------
  async getAllKeySystems(): Promise<KeySystem[]> {
    const { data, error } = await GET('/key-systems')
    if (error) throw error
    return data?.content ?? []
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
}
