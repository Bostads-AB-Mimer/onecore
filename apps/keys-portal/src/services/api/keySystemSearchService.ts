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

export class KeySystemSearchService {
  isValidSearchQuery(query: string): boolean {
    return query.trim().length >= 3
  }

  async searchBySystemCode(query: string): Promise<KeySystemSearchResult[]> {
    if (!query.trim() || !this.isValidSearchQuery(query)) {
      return []
    }

    try {
      console.log('🔍 Frontend calling search with query:', query)
      // Use server-side search endpoint
      const response = await GET('/key-systems/search', {
        params: {
          query: {
            q: query.trim(),
          },
        },
      })

      console.log('🔍 Frontend search response:', response)

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
      console.error('Error searching key systems by system code:', error)
    }

    return []
  }
}

export const keySystemSearchService = new KeySystemSearchService()
