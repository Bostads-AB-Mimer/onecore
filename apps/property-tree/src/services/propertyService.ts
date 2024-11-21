import { NavigationItem, Apartment, Area, Property, Building, Entrance } from './types';
import { mockNavigation, mockApartments, mockAreas, mockBuildings, mockEntrances } from './mockData';
import { propertyService as propertyApi } from './api/propertyService';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Convert tenant to search result
const createTenantSearchResult = (apartmentId: string, tenant: Apartment['tenant']): NavigationItem => ({
  id: `tenant-${apartmentId}`,
  name: tenant.name,
  type: 'tenant',
  metadata: {
    apartmentId,
    email: tenant.email,
    phone: tenant.phone
  }
});

export const propertyService = {
  async getNavigation(): Promise<NavigationItem[]> {
    await delay(800);
    return mockNavigation;
  },

  async getArea(id: string): Promise<Area> {
    await delay(500);
    const area = mockAreas[id];
    if (!area) throw new Error(`Area with id ${id} not found`);
    return area;
  },

  async getProperty(id: string): Promise<Property> {
    return propertyApi.getById(id);
  },

  async getBuilding(id: string): Promise<Building> {
    await delay(500);
    const building = mockBuildings[id];
    if (!building) throw new Error(`Building with id ${id} not found`);
    return building;
  },

  async getEntrance(id: string): Promise<Entrance> {
    await delay(500);
    const entrance = mockEntrances[id];
    if (!entrance) throw new Error(`Entrance with id ${id} not found`);
    return entrance;
  },

  async getApartment(id: string): Promise<Apartment> {
    await delay(500);
    const apartment = mockApartments[id];
    if (!apartment) throw new Error(`Apartment with id ${id} not found`);
    return apartment;
  },

  async searchProperties(query: string): Promise<NavigationItem[]> {
    await delay(300);
    const normalizedQuery = query.toLowerCase();
    
    const searchInItems = (items: NavigationItem[]): NavigationItem[] => {
      return items.reduce<NavigationItem[]>((acc, item) => {
        if (item.name.toLowerCase().includes(normalizedQuery)) {
          acc.push(item);
        }
        if (item.children) {
          acc.push(...searchInItems(item.children));
        }
        return acc;
      }, []);
    };

    // Search in navigation items
    const navigationResults = searchInItems(mockNavigation);

    // Search in tenants
    const tenantResults = Object.entries(mockApartments)
      .filter(([_, apartment]) => 
        apartment.tenant.name.toLowerCase().includes(normalizedQuery) ||
        apartment.tenant.email.toLowerCase().includes(normalizedQuery) ||
        apartment.tenant.phone.toLowerCase().includes(normalizedQuery)
      )
      .map(([id, apartment]) => 
        createTenantSearchResult(id, apartment.tenant)
      );

    return [...navigationResults, ...tenantResults];
  }
};
