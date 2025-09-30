//TODO: Server-side search implemented - much more efficient than client-side filtering!

import type { KeySystem } from '@/services/types'

import { GET } from './core/base-api'

export interface KeySystemSearchParams {
  q?: string
  fields?: (keyof KeySystem)[] | string
  [key: string]: string | string[] | undefined
}

export class KeySystemSearchService {
  isValidSearchQuery(query: string): boolean {
    return query.trim().length >= 3
  }

  async search(params: KeySystemSearchParams): Promise<KeySystem[]> {
    try {
      const queryParams: Record<string, string> = {}

      // Add all params to query string
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            queryParams[key] = value.join(',')
          } else {
            queryParams[key] = value
          }
        }
      }

      const response = await GET('/key-systems/search', {
        params: {
          query: queryParams,
        },
      })

      return response.data?.content || []
    } catch (error) {
      console.error('Error searching key systems:', error)
      return []
    }
  }
}

export const keySystemSearchService = new KeySystemSearchService()
