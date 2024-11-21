import { Issue } from '../types'
import { fetchApi, simulateDelay } from './baseApi'
import { mockActiveIssues } from '../mockData'

export const issueService = {
  // Get all issues for an apartment
  async getByApartmentId(apartmentId: string): Promise<Issue[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    return mockActiveIssues[apartmentId] || []
  },

  // Get issue by ID
  async getById(issueId: string): Promise<Issue> {
    // TODO: Replace with actual API call
    await simulateDelay()
    const issue = Object.values(mockActiveIssues)
      .flat()
      .find((i) => i.id === issueId)
    if (!issue) {
      throw new Error(`Issue with id ${issueId} not found`)
    }
    return issue
  },

  // Create new issue
  async create(data: Omit<Issue, 'id' | 'date' | 'status'>): Promise<Issue> {
    // TODO: Replace with actual API call
    return fetchApi<Issue>('/issues', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Update issue status
  async updateStatus(
    issueId: string,
    status: 'pending' | 'in-progress' | 'resolved'
  ): Promise<Issue> {
    // TODO: Replace with actual API call
    return fetchApi<Issue>(`/issues/${issueId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  },

  // Get issues by feature
  async getByFeature(featureName: string): Promise<Issue[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    return Object.values(mockActiveIssues)
      .flat()
      .filter((issue) => issue.feature === featureName)
  },
}
