import { Component } from '../types'
import { fetchApi, simulateDelay } from './baseApi'

export const componentService = {
  // Get all components for a residence
  async getByResidenceId(residenceId: string): Promise<Component[]> {
    const { data, error } = await GET(`/residences/${residenceId}/components/`)
    if (error) throw error
    return data?.content as Component[]
  },

  // Get component by ID
  async getById(residenceId: string, componentId: string): Promise<Component> {
    const { data, error } = await GET(`/residences/${residenceId}/components/${componentId}/`)
    if (error) throw error
    return data as Component
  },

  // Get components by type
  async getByType(residenceId: string, componentType: string): Promise<Component[]> {
    const { data, error } = await GET(`/residences/${residenceId}/components/?componentType=${componentType}`)
    if (error) throw error
    return data?.content as Component[]
  },

  // Get components by category
  async getByCategory(residenceId: string, category: string): Promise<Component[]> {
    const { data, error } = await GET(`/residences/${residenceId}/components/?category=${category}`)
    if (error) throw error
    return data?.content as Component[]
  }
}
