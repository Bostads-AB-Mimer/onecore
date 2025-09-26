import { GET } from './core/base-api'
import type { paths } from './core/generated/api-types'

export interface RentalObjectSearchResult {
  rentalId: string
  name: string
  type: 'lägenhet' | 'bilplats' | 'lokal'
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
    // Rental ID format: typically numbers and dashes, e.g., "811-039-05-0347"
    // Adjust this pattern based on your actual rental ID format
    const rentalIdPattern = /^[\d-]+$/;
    return rentalIdPattern.test(rentalId) && rentalId.length >= 5; // Minimum length check
  }

  async searchByRentalId(rentalId: string): Promise<RentalObjectSearchResult[]> {
    if (!rentalId.trim() || !this.isValidRentalId(rentalId)) {
      return []
    }

    try {
      // Search using the single core endpoint
      const response = await GET('/rental-properties/by-rental-object-code/{rentalObjectCode}', {
        params: { path: { rentalObjectCode: rentalId } }
      })

      if (response.data?.content) {
        const rentalProperty = response.data.content

        // Map the response to our search result format
        const result: RentalObjectSearchResult = {
          rentalId: rentalProperty.id || rentalId,
          name: this.getPropertyName(rentalProperty),
          type: this.mapPropertyType(rentalProperty.type),
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
    // Use the address as the name, or fallback to type
    const address = this.getPropertyAddress(rentalProperty)
    if (address && address !== 'Okänd adress') {
      return address
    }
    return this.mapPropertyType(rentalProperty.type) || 'Okänd egenskap'
  }

  private getPropertyAddress(rentalProperty: RentalPropertyResponse): string {
    if (rentalProperty.property?.address) {
      return rentalProperty.property.address
    }
    return 'Okänd adress'
  }

  private mapPropertyType(type: string): 'lägenhet' | 'bilplats' | 'lokal' {
    // Map the property type to our simplified types
    const typeLower = type?.toLowerCase() || ''

    if (typeLower.includes('apartment') || typeLower.includes('lägenhet')) {
      return 'lägenhet'
    } else if (typeLower.includes('parking') || typeLower.includes('bilplats')) {
      return 'bilplats'
    } else if (typeLower.includes('commercial') || typeLower.includes('lokal')) {
      return 'lokal'
    }

    // Default to lägenhet if type is unknown
    return 'lägenhet'
  }
}

export const rentalObjectSearchService = new RentalObjectSearchService()