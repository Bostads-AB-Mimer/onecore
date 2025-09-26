import { GET, POST, PATCH, DELETE } from './core/base-api'
import type { paths, components } from './core/generated/api-types'

type Key = components['schemas']['Key']
type KeyLoan = components['schemas']['KeyLoan']

type CreateKeyBody =
  paths['/keys']['post']['requestBody']['content']['application/json']
type UpdateKeyBody =
  paths['/keys/{id}']['patch']['requestBody']['content']['application/json']
type CreateKeyLoanBody =
  paths['/key-loans']['post']['requestBody']['content']['application/json']
type UpdateKeyLoanBody =
  paths['/key-loans/{id}']['patch']['requestBody']['content']['application/json']

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

  async createKeyLoan(payload: CreateKeyLoanBody): Promise<KeyLoan> {
    const { data, error } = await POST('/key-loans', { body: payload })
    if (error) throw error
    return data?.content as KeyLoan
  },

  async updateKeyLoan(
    id: string,
    payload: UpdateKeyLoanBody
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

  async createKey(payload: CreateKeyBody): Promise<Key> {
    const { data, error } = await POST('/keys', { body: payload })
    if (error) throw error
    return data?.content as Key
  },

  async updateKey(id: string, payload: UpdateKeyBody): Promise<Key> {
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
