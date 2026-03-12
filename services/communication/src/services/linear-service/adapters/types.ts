// Linear GraphQL Response Types

export interface LinearUser {
  id: string
  name: string
  email: string
}

export interface LinearComment {
  id: string
  body: string
  createdAt: string
  user: LinearUser
}

export interface LinearState {
  name: string
  type: string
}

export interface LinearTeam {
  name: string
  key: string
}

export interface LinearLabel {
  id?: string
  name: string
}

export interface LinearIssue {
  id: string
  identifier: string
  title: string
  url: string
  description: string | null
  createdAt: string
  assignee: LinearUser | null
  comments: {
    nodes: LinearComment[]
  }
  state: LinearState
  team: LinearTeam
  labels: {
    nodes: LinearLabel[]
  }
}

export interface LinearPageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface GetLinearTicketsResponse {
  data: {
    issues: {
      pageInfo: LinearPageInfo
      nodes: LinearIssue[]
    }
  }
  errors?: LinearGraphQLError[]
}

export interface GetLinearTicketsResult {
  tickets: LinearIssue[]
  pageInfo: LinearPageInfo
}

export interface LinearPaginationParams {
  first?: number
  after?: string
}

export interface CreateLinearErrandResponse {
  data: {
    issueCreate: {
      success: boolean
      issue: LinearIssue | null
    }
  }
  errors?: LinearGraphQLError[]
}

export interface GetLinearLabelsResponse {
  data: {
    issueLabels: {
      nodes: LinearLabel[]
    }
  }
  errors?: LinearGraphQLError[]
}

export interface LinearGraphQLError {
  message: string
  locations?: Array<{ line: number; column: number }>
  path?: string[]
  extensions?: Record<string, unknown>
}

// Request types
export interface CreateLinearErrandRequest {
  title: string
  description: string
  categoryLabelId: string
}
