import { Residence } from '../types'
import { fetchApi } from './baseApi'

export const residenceService = {
  async getAll(): Promise<Residence[]> {
    return fetchApi<Residence[]>('/residences')
  },

  async getById(id: string): Promise<Residence> {
    return fetchApi<Residence>(`/residences/${id}`)
  },

  async create(data: Omit<Residence, 'id'>): Promise<Residence> {
    return fetchApi<Residence>('/residences', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<Residence>): Promise<Residence> {
    return fetchApi<Residence>(`/residences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string): Promise<void> {
    return fetchApi<void>(`/residences/${id}`, {
      method: 'DELETE',
    })
  },

  async getByEntranceId(entranceId: string): Promise<Residence[]> {
    return fetchApi<Residence[]>(`/entrances/${entranceId}/residences`)
  },
}
