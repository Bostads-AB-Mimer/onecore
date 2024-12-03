import { Component } from '../types'
import { fetchApi, simulateDelay } from './baseApi'

export const componentService = {
  // Get all components for a residence
  async getByResidenceId(residenceId: string): Promise<Component[]> {
    return fetchApi<Component[]>(`/residences/${residenceId}/components`)
  },

  // Get component by ID
  async getById(residenceId: string, componentId: string): Promise<Component> {
    return fetchApi<Component>(`/residences/${residenceId}/components/${componentId}`)
  },

  // Create new component
  async create(
    residenceId: string,
    data: Omit<Component, 'id' | 'issues'>,
  ): Promise<Component> {
    // TODO: Replace with actual API call
    return fetchApi<Component>(`/residences/${residenceId}/components`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Update component
  async update(
    residenceId: string,
    componentId: string,
    data: Partial<Component>,
  ): Promise<Component> {
    // TODO: Replace with actual API call
    return fetchApi<Component>(
      `/residences/${residenceId}/components/${componentId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    )
  },

  // Delete component
  async delete(residenceId: string, componentId: string): Promise<void> {
    // TODO: Replace with actual API call
    return fetchApi<void>(
      `/residences/${residenceId}/components/${componentId}`,
      {
        method: 'DELETE',
      },
    )
  },
}
