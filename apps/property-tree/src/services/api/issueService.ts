import { Issue } from '../types'
import { fetchApi } from './baseApi'

const mockIssues = {
  'residence-1': [
    {
      id: 'issue-1',
      description: 'Droppande kran i köket',
      priority: 'medium',
      status: 'pending',
      room: 'Kök',
      feature: 'Vattenkran',
      date: '2024-02-15',
      residenceId: 'residence-1',
    },
    {
      id: 'issue-2',
      description: 'Trasig lampa i badrummet',
      priority: 'low',
      status: 'in-progress',
      room: 'Badrum',
      feature: 'Belysning',
      date: '2024-02-10',
      residenceId: 'residence-1',
    },
  ],
  'residence-2': [
    {
      id: 'issue-3',
      description: 'Värmeelement fungerar inte',
      priority: 'high',
      status: 'pending',
      room: 'Vardagsrum',
      feature: 'Värmesystem',
      date: '2024-02-18',
      residenceId: 'residence-2',
    },
  ],
}

export const issueService = {
  // Get all issues
  async getAll(status?: string): Promise<Issue[]> {
    const allIssues = Object.values(mockIssues).flat()
    if (status) {
      return allIssues.filter((issue) => issue.status === status)
    }
    return allIssues
  },

  // Get issue by ID
  async getById(id: string): Promise<Issue> {
    await simulateDelay()
    const issue = Object.values(mockIssues)
      .flat()
      .find((i) => i.id === id)
    if (!issue) {
      throw new Error(`Issue with id ${id} not found`)
    }
    return issue
  },

  // Get issues by residence
  async getByResidenceId(residenceId: string): Promise<Issue[]> {
    await simulateDelay()
    return mockIssues[residenceId] || []
  },

  // Get issues by priority
  async getByPriority(priority: string): Promise<Issue[]> {
    await simulateDelay()
    return Object.values(mockIssues)
      .flat()
      .filter((issue) => issue.priority === priority)
  },

  // Create new issue
  async create(data: Omit<Issue, 'id' | 'date' | 'status'>): Promise<Issue> {
    await simulateDelay()
    const newIssue = {
      ...data,
      id: `issue-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
    }
    if (!mockIssues[data.residenceId]) {
      mockIssues[data.residenceId] = []
    }
    mockIssues[data.residenceId].push(newIssue)
    return newIssue
  },

  // Update issue status
  async updateStatus(
    issueId: string,
    status: 'pending' | 'in-progress' | 'resolved'
  ): Promise<Issue> {
    await simulateDelay()
    const issue = Object.values(mockIssues)
      .flat()
      .find((i) => i.id === issueId)
    if (!issue) {
      throw new Error(`Issue with id ${issueId} not found`)
    }
    issue.status = status
    return issue
  },
}
