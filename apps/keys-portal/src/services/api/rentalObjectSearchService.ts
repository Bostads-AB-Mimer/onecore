import { GET } from './core/base-api'
import type { paths, components } from './core/generated/api-types'

type RentalPropertyResponse = components['schemas']['RentalPropertyResponse']


export interface RentalObjectSearchResult {
  rentalId: string
  name: string
  type: string            
  address: string
}

export class RentalObjectSearchService {
  isValidRentalId(rentalId: string): boolean {
    const rentalIdPattern = /^[\d-]+$/
    return rentalIdPattern.test(rentalId) && rentalId.length >= 5
  }

  async searchByRentalId(rentalId: string): Promise<RentalObjectSearchResult[]> {
    if (!rentalId.trim() || !this.isValidRentalId(rentalId)) {
      return []
    }

    try {
      const response = await GET('/rental-properties/by-rental-object-code/{rentalObjectCode}', {
        params: { path: { rentalObjectCode: rentalId } }
      })

      if (response.data) {
        const rentalProperty: RentalPropertyResponse = response.data

        const typeFromApi = rentalProperty.type ?? 'unknown' 

        const result: RentalObjectSearchResult = {
          rentalId: rentalProperty.code || rentalId,
          name: this.getPropertyName(rentalProperty),
          type: typeFromApi,
          address: this.getPropertyAddress(rentalProperty)
        }

        return [result]
      }
    } catch (error) {
      console.warn('Error searching rental properties:', error)
    }

    return []
  }

  private getPropertyName(rentalProperty: RentalPropertyResponse): string {
    const address = this.getPropertyAddress(rentalProperty)
    if (address && address !== 'Okänd adress') {
      return address
    }
    // Fallback to the raw API type if no address
    return rentalProperty.type || 'Okänd typ'
  }

  private getPropertyAddress(rentalProperty: RentalPropertyResponse): string {
    if (rentalProperty.address) {
      return rentalProperty.address
    }
    return 'Okänd adress'
  }
}

export const rentalObjectSearchService = new RentalObjectSearchService()
