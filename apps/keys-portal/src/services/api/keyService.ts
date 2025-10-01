import type {
  Key,
  KeyLoan,
  KeySystem,
  CreateKeyRequest,
  UpdateKeyRequest,
  CreateKeyLoanRequest,
  UpdateKeyLoanRequest,
  CreateKeySystemRequest,
  UpdateKeySystemRequest,
} from '@/services/types'

import { GET, POST, PATCH, DELETE } from './core/base-api'

export const keyService = {
  async getAllKeyLoans(): Promise<KeyLoan[]> {
    const { data, error } = await GET('/key-loans')
    if (error) throw error
    return data?.content ?? []
  },

  async getKeyLoan(id: string): Promise<KeyLoan> {
    const { data, error } = await GET('/key-loans/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content as KeyLoan
  },

  async createKeyLoan(payload: CreateKeyLoanRequest): Promise<KeyLoan> {
    const { data, error } = await POST('/key-loans', { body: payload })
    if (error) throw error
    return data?.content as KeyLoan
  },

  async updateKeyLoan(
    id: string,
    payload: UpdateKeyLoanRequest
  ): Promise<KeyLoan> {
    const { data, error } = await PATCH('/key-loans/{id}', {
      params: { path: { id } },
      body: payload,
    })
    if (error) throw error
    return data?.content as KeyLoan
  },

  async deleteKeyLoan(id: string): Promise<void> {
    const { error } = await DELETE('/key-loans/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
  },

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
    const { error } = await DELETE('/keys/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
  },

  // Key Systems
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
    const { data, error, response } = await POST('/key-systems', { body: payload })

    console.log('createKeySystem response:', { data, error, status: response.status, ok: response.ok })

    if (error || !response.ok) {
      const errorMessage = (error as any)?.error || 'Failed to create key system'
      const err = new Error(errorMessage)
      ;(err as any).status = response.status
      console.log('Throwing error:', err)
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
      const errorMessage = (error as any)?.error || 'Failed to update key system'
      const err = new Error(errorMessage)
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
