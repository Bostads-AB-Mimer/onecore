import type { Key, KeySystem } from '@/services/types'
import { GET } from './core/base-api'

export const keyService = {
  /**
   * Get a single key by ID
   */
  async getById(keyId: string): Promise<Key | null> {
    try {
      const { data, error } = await GET('/keys/{id}', {
        params: { path: { id: keyId } },
      })

      if (error || !data?.content) {
        return null
      }

      return data.content as Key
    } catch (error) {
      console.error('Error fetching key:', error)
      return null
    }
  },

  /**
   * Get all keys for a rental object
   */
  async getByRentalObjectCode(rentalObjectCode: string): Promise<Key[]> {
    try {
      const { data, error } = await GET(
        '/keys/by-rental-object/{rentalObjectCode}',
        {
          params: { path: { rentalObjectCode } },
        }
      )

      if (error || !data?.content) {
        return []
      }

      return data.content
    } catch (error) {
      console.error('Error fetching keys:', error)
      return []
    }
  },

  /**
   * Get a key system by ID
   */
  async getKeySystem(id: string): Promise<KeySystem | null> {
    try {
      const { data, error } = await GET('/key-systems/{id}', {
        params: { path: { id } },
      })

      if (error || !data?.content) {
        return null
      }

      return data.content as KeySystem
    } catch (error) {
      console.error('Error fetching key system:', error)
      return null
    }
  },
}
