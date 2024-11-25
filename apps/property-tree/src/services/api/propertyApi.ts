import { PropertyResponse, Property } from '../../types/property';
import { Area } from '../types';
import { ApiError } from './baseApi';

export async function getProperties(): Promise<PropertyResponse> {
  const response = await fetch('/api/properties');
  
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Failed to fetch properties: ${response.statusText}`
    );
  }

  return response.json();
}

export async function getAreas(): Promise<Area[]> {
  const response = await getProperties();
  const properties = response.content;
  
  // Gruppera properties efter tract
  const areaMap = new Map<string, Property[]>();
  
  properties.forEach(property => {
    const tract = property.tract;
    if (!areaMap.has(tract)) {
      areaMap.set(tract, []);
    }
    areaMap.get(tract)?.push(property);
  });
  
  // Konvertera grupperade properties till Area-objekt
  return Array.from(areaMap.entries()).map(([tract, props]) => ({
    id: tract,
    name: tract, // Använd tract som namn tills vi har något bättre
    properties: props.map(p => p.propertyId),
    totalProperties: props.length,
    totalApartments: 0, // Dessa värden kommer från en annan endpoint senare
    occupiedApartments: 0
  }));
}
