import { PropertyResponse } from '../../types/property';
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
