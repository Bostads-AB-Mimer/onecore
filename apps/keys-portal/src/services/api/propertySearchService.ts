import type { Property } from '@/services/types'
import { querySerializer } from '@/utils/querySerializer'

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
      const response = await GET('/properties/search', {
        params: { query: params },
        querySerializer,
      })

      return response.data?.content || []
    } catch (error) {
      console.error('Error searching properties:', error)
      return []
    }
  }

  async getById(id: string): Promise<Property | null> {
    try {
      const response = await GET('/properties/{propertyId}', {
        params: {
          path: { propertyId: id },
        },
      })

      return response.data?.content || null
    } catch (error) {
      console.error(`Error fetching property ${id}:`, error)
      return null
    }
  }

  async getByIds(ids: string[]): Promise<Property[]> {
    if (!ids || ids.length === 0) return []

    try {
      const results = await Promise.all(ids.map((id) => this.getById(id)))
      return results.filter((prop): prop is Property => prop !== null)
    } catch (error) {
      console.error('Error fetching properties by IDs:', error)
      return []
    }
  }
}

export const propertySearchService = new PropertySearchService()
