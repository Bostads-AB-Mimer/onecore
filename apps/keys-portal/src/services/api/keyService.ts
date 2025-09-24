import { GET, POST, PUT, DELETE, PATCH } from './baseApi'
import type { components } from './generated/api-types'

type KeyLoan = components['schemas']['KeyLoan']
type Key = components['schemas']['Key']
type CreateKeyRequest = components['schemas']['CreateKeyRequest']
type UpdateKeyRequest = components['schemas']['UpdateKeyRequest']

export const keyService = {
  // Key Loans
  async getAllKeyLoans(): Promise<KeyLoan[]> {
    const { data, error } = await GET('/key-loans')
    if (error) throw error
    return data?.content || []
  },

  async getKeyLoan(id: string): Promise<KeyLoan> {
    const { data, error } = await GET('/key-loans/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content
  },

  async createKeyLoan(payload: Omit<KeyLoan, 'id' | 'created_at' | 'updated_at'>): Promise<KeyLoan> {
    const { data, error } = await POST('/key-loans', {
      body: payload,
    })
    if (error) throw error
    return data?.content
  },

  // Keys
  async getAllKeys(): Promise<Key[]> {
    const { data, error } = await GET('/keys')
    if (error) throw error
    return data?.content || []
  },

  async getKey(id: string): Promise<Key> {
    const { data, error } = await GET('/keys/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content
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
}
