// services/api/keyLoanService.ts
import type {
  KeyLoan,
  KeyLoanWithDetails,
  CreateKeyLoanRequest,
  UpdateKeyLoanRequest,
  PaginatedResponse,
} from '@/services/types'
import { querySerializer } from '@/utils/querySerializer'

import { GET, POST, PUT, DELETE } from './core/base-api'

type ApiError = {
  status?: number
  message?: string
  data?: any
}

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

export const keyLoanService = {
  async list(): Promise<KeyLoan[]> {
    const { data, error } = await GET('/key-loans')
    if (error) throw error
    return data?.content ?? []
  },

  async search(
    searchParams: Record<string, string | number | string[] | undefined>,
    page: number = 1,
    limit: number = 60
  ): Promise<PaginatedResponse<KeyLoan>> {
    const { data, error } = await GET('/key-loans/search', {
      params: { query: { ...searchParams, page, limit } as any },
      querySerializer,
    })
    if (error) throw error
    return ensurePaginatedResponse<KeyLoan>(data)
  },

  async get(
    id: string,
    options?: { includeKeySystem?: boolean; includeCards?: boolean }
  ): Promise<KeyLoan | KeyLoanWithDetails> {
    const query: Record<string, boolean> = {}
    if (options?.includeKeySystem) query.includeKeySystem = true
    if (options?.includeCards) query.includeCards = true
    const { data, error } = await GET('/key-loans/{id}', {
      params: {
        path: { id },
        query: Object.keys(query).length > 0 ? query : undefined,
      },
    })
    if (error) throw error
    return data?.content as KeyLoan | KeyLoanWithDetails
  },

  async getByKeyId(keyId: string): Promise<KeyLoan[]> {
    const { data, error } = await GET('/key-loans/by-key/{keyId}', {
      params: { path: { keyId } },
    })
    if (error) throw error
    return data?.content ?? []
  },

  async getByCardId(cardId: string): Promise<KeyLoan[]> {
    const { data, error } = await GET('/key-loans/by-card/{cardId}', {
      params: { path: { cardId } },
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
    const { data, error } = await PUT('/key-loans/{id}', {
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
   * Get key loans by contact with full key details
   * @param contact - The contact identifier to filter by
   * @param loanType - Optional filter by loan type: 'TENANT' or 'MAINTENANCE'
   * @param returned - Optional filter: true = returned loans, false = active loans, undefined = all
   * @returns Array of key loans with keysArray containing full key objects
   */
  async getByContactWithKeys(
    contact: string,
    loanType?: 'TENANT' | 'MAINTENANCE',
    returned?: boolean
  ): Promise<KeyLoanWithDetails[]> {
    const { data, error } = await GET(
      '/key-loans/by-contact/{contact}/with-keys',
      {
        params: {
          path: { contact },
          query: {
            ...(loanType !== undefined ? { loanType } : {}),
            ...(returned !== undefined ? { returned } : {}),
          },
        },
      }
    )
    if (error) throw error
    return data?.content ?? []
  },

  /**
   * Get all key loans that contain any key from a bundle with full key details
   * @param bundleId - The bundle ID to filter by
   * @param loanType - Optional filter by loan type: 'TENANT' or 'MAINTENANCE'
   * @param returned - Optional filter: true = returned loans, false = active loans, undefined = all
   * @returns Array of key loans with keysArray containing full key objects
   */
  async getByBundleWithKeys(
    bundleId: string,
    loanType?: 'TENANT' | 'MAINTENANCE',
    returned?: boolean
  ): Promise<KeyLoanWithDetails[]> {
    const { data, error } = await GET(
      '/key-loans/by-bundle/{bundleId}/with-keys',
      {
        params: {
          path: { bundleId },
          query: {
            ...(loanType !== undefined ? { loanType } : {}),
            ...(returned !== undefined ? { returned } : {}),
          },
        },
      }
    )
    if (error) throw error
    return data?.content ?? []
  },

  /**
   * Get key loans by rental object code with keys and optional receipts (OPTIMIZED)
   * This uses a single optimized endpoint that eliminates N+1 queries
   * @param rentalObjectCode - The rental object code
   * @param contact - Optional contact code to filter by
   * @param contact2 - Optional second contact code to filter by
   * @param includeReceipts - Whether to include receipts in the response
   * @param returned - Optional filter: true = returned loans, false = active loans, undefined = all
   */
  async getByRentalObject(
    rentalObjectCode: string,
    contact?: string,
    contact2?: string,
    includeReceipts?: boolean,
    returned?: boolean
  ): Promise<KeyLoanWithDetails[]> {
    const { data, error } = await GET(
      '/key-loans/by-rental-object/{rentalObjectCode}',
      {
        params: {
          path: { rentalObjectCode },
          query: {
            contact,
            contact2,
            includeReceipts,
            ...(returned !== undefined ? { returned } : {}),
          },
        },
      }
    )
    if (error) throw error
    return data?.content ?? []
  },
}
