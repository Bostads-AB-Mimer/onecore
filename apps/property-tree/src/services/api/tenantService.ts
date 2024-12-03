import { Tenant } from '../types'
import { fetchApi, simulateDelay } from './baseApi'
import { mockResidences } from '../mockData'

export const tenantService = {
  // Get all tenants
  async getAll(): Promise<Tenant[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    return Object.values(mockResidences).map((residence) => residence.tenant)
  },

  // Get tenant by ID
  async getById(id: string): Promise<Tenant> {
    // TODO: Replace with actual API call
    await simulateDelay()
    const tenant = Object.values(mockResidences).find(
      (residence) => residence.tenant.id === id,
    )?.tenant
    if (!tenant) {
      throw new Error(`Tenant with id ${id} not found`)
    }
    return tenant
  },

  // Create new tenant
  async create(data: Omit<Tenant, 'id'>): Promise<Tenant> {
    // TODO: Replace with actual API call
    return fetchApi<Tenant>('/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Update tenant
  async update(id: string, data: Partial<Tenant>): Promise<Tenant> {
    // TODO: Replace with actual API call
    return fetchApi<Tenant>(`/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // Delete tenant
  async delete(id: string): Promise<void> {
    // TODO: Replace with actual API call
    return fetchApi<void>(`/tenants/${id}`, {
      method: 'DELETE',
    })
  },

  // Search tenants
  async search(query: string): Promise<Tenant[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    const normalizedQuery = query.toLowerCase()
    return Object.values(mockResidences)
      .map((residence) => residence.tenant)
      .filter(
        (tenant) =>
          tenant.name.toLowerCase().includes(normalizedQuery) ||
          tenant.email.toLowerCase().includes(normalizedQuery) ||
          tenant.phone.toLowerCase().includes(normalizedQuery),
      )
  },
}
