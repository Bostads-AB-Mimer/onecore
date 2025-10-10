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

  async getByKeyId(keyId: string): Promise<KeyLoan[]> {
    const { data, error } = await GET('/key-loans/by-key/{keyId}', {
      params: { path: { keyId } },
    })
    if (error) throw error
    return data?.content ?? []
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

  /**
   * Get all key loans associated with a lease by fetching loans for each key
   * in the lease's rental object
   */
  async listByLease(
    rentalObjectCode: string
  ): Promise<{ loaned: KeyLoan[]; returned: KeyLoan[] }> {
    // Import keyService dynamically to avoid circular dependency
    const { keyService } = await import('./keyService')

    // Get all keys for this rental object
    const keys = await keyService.getKeysByRentalObjectCode(rentalObjectCode)

    // Fetch loans for each key and deduplicate
    const loanMap = new Map<string, KeyLoan>()

    for (const key of keys) {
      const loans = await this.getByKeyId(key.id)
      loans.forEach((loan) => loanMap.set(loan.id, loan))
    }

    const allLoans = Array.from(loanMap.values())
    const loaned = allLoans.filter((r) => !r.returnedAt)
    const returned = allLoans.filter((r) => !!r.returnedAt)

    return { loaned, returned }
  },
}
