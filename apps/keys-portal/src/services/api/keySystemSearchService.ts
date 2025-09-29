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
  isValidSystemCode(systemCode: string): boolean {
    const systemCodePattern = /^[A-Za-z0-9-]+$/
    return systemCodePattern.test(systemCode) && systemCode.length >= 3
  }

  async searchBySystemCode(
    systemCode: string
  ): Promise<KeySystemSearchResult[]> {
    if (!systemCode.trim() || !this.isValidSystemCode(systemCode)) {
      return []
    }

    try {
      // Since we don't have a specific endpoint for system code search,
      // we'll get all key systems and filter
      const response = await GET('/key-systems')

      if (response.data) {
        const keySystems: KeySystem[] = response.data.content || []

        const matchingSystems = keySystems.filter(
          (system) =>
            system.systemCode?.toLowerCase().startsWith(systemCode.toLowerCase())
        )

        return matchingSystems.map((system) => ({
          id: system.id || '',
          name: system.name || 'Unknown',
          systemCode: system.systemCode || systemCode,
          type: system.type || 'unknown',
          manufacturer: system.manufacturer,
          isActive: system.isActive ?? true,
        }))
      }
    } catch (error) {
      console.warn('Error searching key systems by code:', error)
    }

    return []
  }

  async searchByName(name: string): Promise<KeySystemSearchResult[]> {
    if (!name.trim()) {
      return []
    }

    try {
      const response = await GET('/key-systems')

      if (response.data) {
        const keySystems: KeySystem[] = response.data.content || []

        const matchingSystems = keySystems.filter((system) =>
          system.name?.toLowerCase().includes(name.toLowerCase())
        )

        return matchingSystems.map((system) => ({
          id: system.id || '',
          name: system.name || 'Unknown',
          systemCode: system.systemCode || '',
          type: system.type || 'unknown',
          manufacturer: system.manufacturer,
          isActive: system.isActive ?? true,
        }))
      }
    } catch (error) {
      console.warn('Error searching key systems by name:', error)
    }

    return []
  }

  async searchByManufacturer(
    manufacturer: string
  ): Promise<KeySystemSearchResult[]> {
    if (!manufacturer.trim()) {
      return []
    }

    try {
      const response = await GET('/key-systems')

      if (response.data) {
        const keySystems: KeySystem[] = response.data.content || []

        const matchingSystems = keySystems.filter((system) =>
          system.manufacturer
            ?.toLowerCase()
            .includes(manufacturer.toLowerCase())
        )

        return matchingSystems.map((system) => ({
          id: system.id || '',
          name: system.name || 'Unknown',
          systemCode: system.systemCode || '',
          type: system.type || 'unknown',
          manufacturer: system.manufacturer,
          isActive: system.isActive ?? true,
        }))
      }
    } catch (error) {
      console.warn('Error searching key systems by manufacturer:', error)
    }

    return []
  }

  async searchKeySystems(
    query: string,
    searchType: 'code' | 'name' | 'manufacturer' = 'code'
  ): Promise<KeySystemSearchResult[]> {
    switch (searchType) {
      case 'code':
        return this.searchBySystemCode(query)
      case 'name':
        return this.searchByName(query)
      case 'manufacturer':
        return this.searchByManufacturer(query)
      default:
        return []
    }
  }
}

export const keySystemSearchService = new KeySystemSearchService()
