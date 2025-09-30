//TODO: Server-side search implemented - much more efficient than client-side filtering!

import type { KeySystem } from '@/services/types'

import { GET } from './core/base-api'

export interface KeySystemSearchResult {
  id: string
  name: string
  systemCode: string
  type: string
  manufacturer?: string
  isActive: boolean
}

export type KeySystemSearchField =
  | 'systemCode'
  | 'manufacturer'
  | 'managingSupplier'
  | 'description'
  | 'propertyIds'

export class KeySystemSearchService {
  isValidSearchQuery(query: string): boolean {
    return query.trim().length >= 3
  }

  async search(
    query: string,
    field: KeySystemSearchField = 'systemCode'
  ): Promise<KeySystemSearchResult[]> {
    if (!query.trim() || !this.isValidSearchQuery(query)) {
      return []
    }

    try {
      const response = await GET('/key-systems/search', {
        params: {
          query: {
            q: query.trim(),
            field,
          },
        },
      })

      if (response.data?.content) {
        return response.data.content.map((system: KeySystem) => ({
          id: system.id || '',
          name: system.name || 'Unknown',
          systemCode: system.systemCode || '',
          type: system.type || 'unknown',
          manufacturer: system.manufacturer,
          isActive: system.isActive ?? true,
        }))
      }
    } catch (error) {
      console.error('Error searching key systems:', error)
    }

    return []
  }
}

export const keySystemSearchService = new KeySystemSearchService()
