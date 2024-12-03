import { Issue } from '../types'
import { fetchApi, simulateDelay } from './baseApi'
import { mockActiveIssues } from '../mockData'

export const issueService = {
  // Get all issues
  async getAll(status?: string): Promise<Issue[]> {
    const url = status ? `/issues/?status=${status}` : '/issues/'
    const response = await fetchApi<{content: Issue[]}>(url)
    return response.content
  },

  // Get issue by ID
  async getById(id: string): Promise<Issue> {
    return fetchApi<Issue>(`/issues/${id}/`)
  },

  // Get issues by residence
  async getByResidenceId(residenceId: string): Promise<Issue[]> {
    const response = await fetchApi<{content: Issue[]}>(`/residences/${residenceId}/issues/`)
    return response.content
  },

  // Get issues by component
  async getByComponentId(componentId: string): Promise<Issue[]> {
    const response = await fetchApi<{content: Issue[]}>(`/components/${componentId}/issues/`)
    return response.content
  },

  // Get issues by priority
  async getByPriority(priority: string): Promise<Issue[]> {
    const response = await fetchApi<{content: Issue[]}>(`/issues/?priority=${priority}`)
    return response.content
  }
}
