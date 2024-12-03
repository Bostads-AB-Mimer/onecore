import { Component } from '../types'
import { fetchApi, simulateDelay } from './baseApi'

export const componentService = {
  // Get all components for a residence
  async getByResidenceId(residenceId: string): Promise<Component[]> {
    const response = await fetchApi<{content: Component[]}>(`/residences/${residenceId}/components/`)
    return response.content
  },

  // Get component by ID
  async getById(residenceId: string, componentId: string): Promise<Component> {
    return fetchApi<Component>(`/residences/${residenceId}/components/${componentId}/`)
  },

  // Get components by type
  async getByType(residenceId: string, componentType: string): Promise<Component[]> {
    const response = await fetchApi<{content: Component[]}>(`/residences/${residenceId}/components/?componentType=${componentType}`)
    return response.content
  },

  // Get components by category
  async getByCategory(residenceId: string, category: string): Promise<Component[]> {
    const response = await fetchApi<{content: Component[]}>(`/residences/${residenceId}/components/?category=${category}`)
    return response.content
  }
}
