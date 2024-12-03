import { Component } from '../types'
import { fetchApi, simulateDelay } from './baseApi'

// Mock data for components
const mockComponents: Record<string, Component[]> = {
  '101': [
    {
      id: 'comp-1',
      name: 'Diskmaskin',
      type: 'appliance',
      category: 'Vitvaror',
      installationDate: '2023-05-15',
      warranty: '2026-05-15',
      manufacturer: 'Bosch',
      model: 'SMV4HCX48E',
      serialNumber: 'BSH123456789',
      lastService: '2024-01-10',
      nextService: '2024-07-10',
      status: 'operational',
      room: 'Kök',
      issues: [],
    },
    {
      id: 'comp-2',
      name: 'Balkong',
      type: 'fixture',
      category: 'Exteriör',
      installationDate: '2023-01-01',
      status: 'operational',
      room: 'Vardagsrum',
      issues: [],
    },
  ],
}

export const componentService = {
  // Get all components for a residence
  async getByResidenceId(residenceId: string): Promise<Component[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    return mockComponents[residenceId] || []
  },

  // Get component by ID
  async getById(residenceId: string, componentId: string): Promise<Component> {
    // TODO: Replace with actual API call
    await simulateDelay()
    const component = mockComponents[residenceId]?.find(
      (c) => c.id === componentId,
    )
    if (!component) {
      throw new Error(`Component with id ${componentId} not found`)
    }
    return component
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
