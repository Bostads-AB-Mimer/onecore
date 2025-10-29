// services/api/maintenanceKeysService.ts
import type {
  KeyLoanMaintenanceKeys,
  KeyLoanMaintenanceKeysWithDetails,
  CreateKeyLoanMaintenanceKeysRequest,
} from '@/services/types'

import { GET, POST } from './core/base-api'

export const maintenanceKeysService = {
  /**
   * Get maintenance key loans by company with full key details
   * @param company - The company name to filter by
   * @param returned - Optional filter: true = returned loans, false = active loans, undefined = all
   * @returns Array of maintenance key loans with keysArray containing full key objects
   */
  async getByCompanyWithKeys(
    company: string,
    returned?: boolean
  ): Promise<KeyLoanMaintenanceKeysWithDetails[]> {
    const { data, error } = await GET(
      '/key-loan-maintenance-keys/by-company/{company}/with-keys',
      {
        params: {
          path: { company },
          query: returned !== undefined ? { returned } : {},
        },
      }
    )
    if (error) throw error
    return data?.content ?? []
  },

  /**
   * Get maintenance key loan by ID (without keys)
   */
  async get(id: string): Promise<KeyLoanMaintenanceKeys> {
    const { data, error} = await GET('/key-loan-maintenance-keys/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content as KeyLoanMaintenanceKeys
  },

  /**
   * Create a new maintenance key loan
   */
  async create(
    payload: CreateKeyLoanMaintenanceKeysRequest
  ): Promise<KeyLoanMaintenanceKeys> {
    const { data, error } = await POST('/key-loan-maintenance-keys', {
      body: payload,
    })
    if (error) throw error
    return data?.content as KeyLoanMaintenanceKeys
  },
}
