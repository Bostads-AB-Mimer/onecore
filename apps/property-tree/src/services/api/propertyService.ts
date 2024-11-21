import { Property, NavigationItem } from '../types';
import { fetchApi, simulateDelay } from './baseApi';
import { mockProperties, mockNavigation } from '../mockData';

interface ApiProperty {
  propertyId: string;
  propertyCode: string;
  tract: string;
  propertyDesignation: string;
}

interface ApiResponse {
  content: ApiProperty[];
}

const mapApiPropertyToProperty = (apiProperty: ApiProperty): Property => ({
  id: apiProperty.propertyId.trim(),
  name: apiProperty.propertyDesignation,
  code: apiProperty.propertyCode,
  tract: apiProperty.tract,
  areaId: 'area-1' // TODO: Get real area ID from API when available
});

export const propertyService = {
  // Get all properties
  async getAll(): Promise<Property[]> {
    const response = await fetchApi<ApiResponse>('http://localhost:5050/properties/');
    return response.content.map(mapApiPropertyToProperty);
  },

  // Get property by ID
  async getById(id: string): Promise<Property> {
    const response = await fetchApi<ApiResponse>('http://localhost:5050/properties/');
    const apiProperty = response.content.find(p => p.propertyId.trim() === id);
    if (!apiProperty) {
      throw new Error(`Property with id ${id} not found`);
    }
    return mapApiPropertyToProperty(apiProperty);
  },

  // Get properties by area ID
  async getByAreaId(areaId: string): Promise<Property[]> {
    // TODO: Replace with actual API call
    await simulateDelay();
    return Object.values(mockProperties).filter(
      property => property.areaId === areaId
    );
  },

  // Get navigation tree
  async getNavigation(): Promise<NavigationItem[]> {
    // TODO: Replace with actual API call
    await simulateDelay();
    return mockNavigation;
  },

  // Create new property
  async create(data: Omit<Property, 'id'>): Promise<Property> {
    // TODO: Replace with actual API call
    return fetchApi<Property>('/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update property
  async update(id: string, data: Partial<Property>): Promise<Property> {
    // TODO: Replace with actual API call
    return fetchApi<Property>(`/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete property
  async delete(id: string): Promise<void> {
    // TODO: Replace with actual API call
    return fetchApi<void>(`/properties/${id}`, {
      method: 'DELETE',
    });
  }
};
