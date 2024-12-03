import {
  NavigationItem,
  Residence,
  Area,
  Property,
  Building,
  Entrance,
} from './types'
import { residenceService } from './api/residenceService'
import { roomService } from './api/roomService'

// Convert tenant to search result
const createTenantSearchResult = (
  residenceId: string,
  tenant: Residence['tenant'],
): NavigationItem => ({
  id: `tenant-${residenceId}`,
  name: tenant.name,
  type: 'tenant',
  metadata: {
    residenceId,
    email: tenant.email,
    phone: tenant.phone,
  },
})

export const propertyService = {
  async getNavigation(): Promise<NavigationItem[]> {
    await delay(800)
    return mockNavigation
  },

  async getArea(id: string): Promise<Area> {
    await delay(500)
    const area = mockAreas[id]
    if (!area) throw new Error(`Area with id ${id} not found`)
    return area
  },

  async getProperty(id: string): Promise<Property> {
    await delay(500)
    const property = mockProperties[id]
    if (!property) throw new Error(`Property with id ${id} not found`)
    return property
  },

  async getBuilding(id: string): Promise<Building> {
    await delay(500)
    const building = mockBuildings[id]
    if (!building) throw new Error(`Building with id ${id} not found`)
    return building
  },

  async getEntrance(id: string): Promise<Entrance> {
    await delay(500)
    const entrance = mockEntrances[id]
    if (!entrance) throw new Error(`Entrance with id ${id} not found`)
    return entrance
  },

  async getResidence(id: string): Promise<Residence> {
    return residenceService.getById(id)
  },

  async searchProperties(query: string): Promise<NavigationItem[]> {
    await delay(300)
    const normalizedQuery = query.toLowerCase()

    const searchInItems = (items: NavigationItem[]): NavigationItem[] => {
      return items.reduce<NavigationItem[]>((acc, item) => {
        if (item.name.toLowerCase().includes(normalizedQuery)) {
          acc.push(item)
        }
        if (item.children) {
          acc.push(...searchInItems(item.children))
        }
        return acc
      }, [])
    }

    // Search in navigation items
    const navigationResults = searchInItems(mockNavigation)

    // Search in tenants
    const tenantResults = Object.entries(mockResidences)
      .filter(
        ([_, residence]) =>
          residence.tenant.name.toLowerCase().includes(normalizedQuery) ||
          residence.tenant.email.toLowerCase().includes(normalizedQuery) ||
          residence.tenant.phone.toLowerCase().includes(normalizedQuery),
      )
      .map(([id, residence]) => createTenantSearchResult(id, residence.tenant))

    return [...navigationResults, ...tenantResults]
  },
}
