import { GET } from './core/base-api'

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

  async searchByRentalId(
    rentalId: string
  ): Promise<RentalObjectSearchResult[]> {
    if (!rentalId.trim() || !this.isValidRentalId(rentalId)) {
      return []
    }

    try {
      const [residences, parkingSpaces, facilities] = await Promise.all([
        GET('/residences/search', {
          params: { query: { q: rentalId } },
        }),
        GET('/parking-spaces/search', {
          params: { query: { q: rentalId } },
        }),
        GET('/facilities/search', {
          params: { query: { q: rentalId } },
        }),
      ])

      const results: RentalObjectSearchResult[] = []

      for (const r of residences.data?.content ?? []) {
        if (r.rentalId === rentalId) {
          results.push({
            rentalId: r.rentalId ?? rentalId,
            name: r.name ?? rentalId,
            type: 'Bostad',
            address: r.name ?? 'Okänd adress',
          })
        }
      }

      for (const p of parkingSpaces.data?.content ?? []) {
        if (p.rentalId === rentalId) {
          results.push({
            rentalId: p.rentalId,
            name: p.name ?? rentalId,
            type: 'Bilplats',
            address: p.name ?? 'Okänd adress',
          })
        }
      }

      for (const f of facilities.data?.content ?? []) {
        if (f.rentalId === rentalId) {
          results.push({
            rentalId: f.rentalId,
            name: f.name ?? rentalId,
            type: 'Lokal',
            address: f.name ?? 'Okänd adress',
          })
        }
      }

      return results
    } catch (error) {
      console.warn('Error searching rental properties:', error)
      return []
    }
  }

  async getAddressByRentalId(rentalId: string): Promise<string> {
    const results = await this.searchByRentalId(rentalId)
    return results[0]?.address ?? 'Okänd adress'
  }

  async getAddressesByRentalIds(
    rentalIds: string[]
  ): Promise<Record<string, string>> {
    const unique = Array.from(new Set(rentalIds.filter(Boolean)))
    const entries = await Promise.all(
      unique.map(
        async (id) => [id, await this.getAddressByRentalId(id)] as const
      )
    )
    return Object.fromEntries(entries)
  }
}

export const rentalObjectSearchService = new RentalObjectSearchService()
