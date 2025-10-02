// services/api/keyLoanService.ts
import type {
  KeyLoan,
  CreateKeyLoanRequest,
  UpdateKeyLoanRequest,
} from '@/services/types'

import { GET, POST, PATCH, DELETE } from './core/base-api'

type ApiError = {
  status?: number
  message?: string
  data?: any
}

export const keyLoanService = {
  async list(): Promise<KeyLoan[]> {
    const { data, error } = await GET('/key-loans')
    if (error) throw error
    return data?.content ?? []
  },

  async search(params: {
    q?: string
    fields?: string | string[]
    id?: string
    keys?: string
    contact?: string
    lease?: string
    returnedAt?: string
    availableToNextTenantFrom?: string
    pickedUpAt?: string
    createdAt?: string
    updatedAt?: string
  }): Promise<KeyLoan[]> {
    const { fields, ...rest } = params ?? {}
    const normalized: Record<string, unknown> = {
      ...rest,
      ...(typeof fields === 'string'
        ? { fields }
        : Array.isArray(fields) && fields.length
          ? { fields: fields.join(',') }
          : {}),
    }

    const { data, error } = await GET('/key-loans/search', {
      params: { query: normalized as any },
    })
    if (error) throw error
    return data?.content ?? []
  },

  async get(id: string): Promise<KeyLoan> {
    const { data, error } = await GET('/key-loans/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content as KeyLoan
  },

  async create(payload: CreateKeyLoanRequest): Promise<KeyLoan> {
    const { data, error } = await POST('/key-loans', { body: payload })
    if (error) {
      // Normalize error shape so callers can check error.status and error.data
      const apiError: ApiError =
        typeof error === 'object' && error
          ? {
              status: (error as any).status ?? (error as any).code,
              message: (error as any).message,
              data: (error as any).data ?? (error as any).response?.data,
            }
          : { message: String(error) }
      throw apiError
    }
    return data?.content as KeyLoan
  },

  async update(id: string, payload: UpdateKeyLoanRequest): Promise<KeyLoan> {
    const { data, error } = await PATCH('/key-loans/{id}', {
      params: { path: { id } },
      body: payload,
    })
    if (error) throw error
    return data?.content as KeyLoan
  },

  async remove(id: string): Promise<void> {
    const { error } = await DELETE('/key-loans/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
  },

  // Optional helper your UI was calling:
  async listByLease(
    leaseId: string
  ): Promise<{ loaned: KeyLoan[]; returned: KeyLoan[] }> {
    // If you don’t have a backend route for this, do a search instead:
    const rows = await this.search({ lease: leaseId })
    const loaned = rows.filter((r) => !r.returnedAt)
    const returned = rows.filter((r) => !!r.returnedAt)
    return { loaned, returned }
  },
}
