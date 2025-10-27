// services/api/keyLoanService.ts
import type {
  KeyLoan,
  KeyLoanWithDetails,
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
   * Get key loans by rental object code with keys and optional receipts (OPTIMIZED)
   * This uses a single optimized endpoint that eliminates N+1 queries
   * @param rentalObjectCode - The rental object code
   * @param contact - Optional contact code to filter by
   * @param contact2 - Optional second contact code to filter by
   * @param includeReceipts - Whether to include receipts in the response
   */
  async getByRentalObject(
    rentalObjectCode: string,
    contact?: string,
    contact2?: string,
    includeReceipts?: boolean
  ): Promise<KeyLoanWithDetails[]> {
    const { data, error } = await GET(
      '/key-loans/by-rental-object/{rentalObjectCode}',
      {
        params: {
          path: { rentalObjectCode },
          query: { contact, contact2, includeReceipts },
        },
      }
    )
    if (error) throw error
    return data?.content ?? []
  },

  /**
   * Get all key loans associated with a lease by fetching loans for each key
   * in the lease's rental object
   * Optimized to avoid duplicate API calls for keys that belong to the same loan
   * @param rentalObjectCode - The rental object code to fetch loans for
   * @param preloadedKeys - Optional pre-fetched keys to avoid duplicate fetches
   * @deprecated Use getByRentalObject instead for better performance
   */
  async listByLease(
    rentalObjectCode: string,
    preloadedKeys?: any[]
  ): Promise<{ loaned: KeyLoan[]; returned: KeyLoan[] }> {
    // Use preloaded keys if available, otherwise fetch them
    let keys: any[]
    if (preloadedKeys && preloadedKeys.length > 0) {
      keys = preloadedKeys
    } else {
      // Import keyService dynamically to avoid circular dependency
      const { keyService } = await import('./keyService')
      keys = await keyService.getKeysByRentalObjectCode(rentalObjectCode)
    }

    // Track which keys we've already fetched loans for
    const processedKeyIds = new Set<string>()
    const loanMap = new Map<string, KeyLoan>()

    for (const key of keys) {
      // Skip if we've already processed this key
      if (processedKeyIds.has(key.id)) {
        continue
      }

      // Fetch loans for this key
      const loans = await this.getByKeyId(key.id)

      // Add loans to the map and mark all keys in each loan as processed
      loans.forEach((loan) => {
        loanMap.set(loan.id, loan)

        // Mark all keys in this loan as processed to avoid redundant API calls
        try {
          const loanKeyIds: string[] = JSON.parse(loan.keys || '[]')
          loanKeyIds.forEach((id) => processedKeyIds.add(id))
        } catch {
          // If parsing fails, just mark the current key
          processedKeyIds.add(key.id)
        }
      })

      // Also mark the current key as processed (in case it has no loans)
      processedKeyIds.add(key.id)
    }

    const allLoans = Array.from(loanMap.values())
    const loaned = allLoans.filter((r) => !r.returnedAt)
    const returned = allLoans.filter((r) => !!r.returnedAt)

    return { loaned, returned }
  },
}
