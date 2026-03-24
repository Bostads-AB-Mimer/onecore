// Re-export shared types from @onecore/types
export type {
  LinearUser,
  LinearComment,
  LinearState,
  LinearTeam,
  LinearLabel,
  LinearIssue,
  LinearPageInfo,
  GetLinearTicketsResult,
  LinearPaginationParams,
  CreateLinearErrandRequest,
} from '@onecore/types'

import type { LinearIssue, LinearLabel, LinearPageInfo } from '@onecore/types'

// Internal GraphQL Response Types (not shared)

export interface LinearGraphQLError {
  message: string
  locations?: Array<{ line: number; column: number }>
  path?: string[]
  extensions?: Record<string, unknown>
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
