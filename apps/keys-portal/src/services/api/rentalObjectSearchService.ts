import { GET } from './core/base-api'
import type { paths } from './core/generated/api-types'

export interface RentalObjectSearchResult {
  rentalId: string
  name: string
  type: string            
  address: string
}

interface RentalPropertyResponse {
  id?: string
  type?: string
  property?: {
    rentalTypeCode?: string
    rentalType?: string
    address?: string
    code?: string
    number?: string
    type?: string
    roomTypeCode?: string
    entrance?: string
    floor?: string
    hasElevator?: boolean
    washSpace?: string
    area?: number
    estateCode?: string
    estate?: string
    buildingCode?: string
    building?: string
  }
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

      if (response.data?.content) {
        const rentalProperty: RentalPropertyResponse = response.data.content

        const typeFromApi =
          rentalProperty.type ??
          rentalProperty.property?.type ??
          'unknown' 

        const result: RentalObjectSearchResult = {
          rentalId: rentalProperty.id || rentalId,
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
    return rentalProperty.type || rentalProperty.property?.type || 'Okänd typ'
  }

  private getPropertyAddress(rentalProperty: RentalPropertyResponse): string {
    if (rentalProperty.property?.address) {
      return rentalProperty.property.address
    }
    return 'Okänd adress'
  }
}

export const rentalObjectSearchService = new RentalObjectSearchService()
