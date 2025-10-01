import type { Property } from '@/services/types'

import { GET } from './core/base-api'

export interface PropertySearchParams {
  q?: string
  fields?: (keyof Property)[] | string
  [key: string]: string | string[] | undefined
}

export type PropertySearchResult = Property

export class PropertySearchService {
  isValidSearchQuery(query: string): boolean {
    return query.trim().length >= 3
  }

  async search(params: PropertySearchParams): Promise<Property[]> {
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

      const response = await GET('/properties/search', {
        params: {
          query: queryParams,
        },
      })

      return response.data?.content || []
    } catch (error) {
      console.error('Error searching properties:', error)
      return []
    }
  }
}

export const propertySearchService = new PropertySearchService()
