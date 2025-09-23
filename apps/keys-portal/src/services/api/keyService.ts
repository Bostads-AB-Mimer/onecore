import { GET, POST, PUT, DELETE, PATCH } from './baseApi'
import type { components } from './generated/api-types'

type KeyLoan = components['schemas']['KeyLoan']
type Key = components['schemas']['Key']

export const keyService = {
  // Key Loans
  async getAllKeyLoans(): Promise<KeyLoan[]> {
    const { data, error } = await GET('/key_loans')
    if (error) throw error
    return data?.content || []
  },

  async getKeyLoan(id: string): Promise<KeyLoan> {
    const { data, error } = await GET('/key_loans/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content
  },

  async createKeyLoan(payload: Omit<KeyLoan, 'id' | 'created_at' | 'updated_at'>): Promise<KeyLoan> {
    const { data, error } = await POST('/key_loans', {
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
}