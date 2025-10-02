// services/api/keyLoanService.ts
import type {
  KeyLoan,
  CreateKeyLoanRequest,
  UpdateKeyLoanRequest,
} from '@/services/types'

import { GET, POST, PATCH, DELETE } from './core/base-api'

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
    if (error) throw error
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

  // NEW: used by ReceiptHistory
  async listByLease(
    leaseId: string
  ): Promise<{ loaned: KeyLoan[]; returned: KeyLoan[] }> {
    // Ask the backend for only the fields we need (if supported)
    const fields = [
      'id',
      'keys',
      'lease',
      'contact',
      'createdAt',
      'returnedAt',
      'updatedAt',
    ]
    const all = await this.search({ lease: leaseId, fields })

    const loaned: KeyLoan[] = []
    const returned: KeyLoan[] = []
    for (const k of all) {
      ;(k.returnedAt ? returned : loaned).push(k)
    }

    // Optional: sort
    const toMs = (s?: string) => (s ? new Date(s).getTime() : 0)
    loaned.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
    returned.sort((a, b) => toMs(b.returnedAt) - toMs(a.returnedAt))

    return { loaned, returned }
  },
}
