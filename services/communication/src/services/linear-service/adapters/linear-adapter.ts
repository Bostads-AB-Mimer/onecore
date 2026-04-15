// fetch is stable in Node.js 20 LTS but eslint-plugin-n still flags it as experimental
/* eslint-disable n/no-unsupported-features/node-builtins */
import config from '../../../common/config'
import { logger } from '@onecore/utilities'
import {
  GetLinearTicketsResponse,
  CreateLinearErrandResponse,
  GetLinearLabelsResponse,
  GetLinearTicketsResult,
  LinearPaginationParams,
  LinearIssue,
  LinearLabel,
} from './types'

// GraphQL query fragment for issue fields
const ISSUE_FIELDS = `
  id
  identifier
  title
  url
  description
  createdAt
  assignee { id name email }
  comments(first: 20) { nodes { id body createdAt user { name email } } }
  state { name type }
  team { name key }
  labels { nodes { name } }
`

/**
 * Execute a GraphQL request against the Linear API
 */
const executeGraphQL = async <T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> => {
  const url = config.linear.url
  const apiKey = config.linear.apiKey

  logger.info({ url }, 'Executing Linear GraphQL request')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Linear API error: ${response.status} - ${errorBody}`)
  }

  const result = (await response.json()) as T & {
    errors?: Array<{ message: string }>
  }

  // Check for GraphQL errors in the response
  if (result.errors && result.errors.length > 0) {
    throw new Error(
      `Linear GraphQL error: ${result.errors.map((e) => e.message).join(', ')}`
    )
  }

  return result
}

/**
 * Get tickets with "mimer-visible" label
 */
export const getLinearTickets = async (
  pagination: LinearPaginationParams = {}
): Promise<GetLinearTicketsResult> => {
  const { first = 10, after } = pagination

  logger.info(
    { first, after },
    'Fetching Linear tickets with mimer-visible label'
  )

  const query = `
    query GetMimerVisibleIssues($first: Int!, $after: String) {
      issues(filter: { labels: { name: { eq: "mimer-visible" } } }, first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { ${ISSUE_FIELDS} }
      }
    }
  `

  const response = await executeGraphQL<GetLinearTicketsResponse>(query, {
    first,
    after,
  })

  logger.info(
    { count: response.data.issues.nodes.length },
    'Fetched Linear tickets'
  )

  return {
    tickets: response.data.issues.nodes,
    pageInfo: response.data.issues.pageInfo,
  }
}

/**
 * Create a new errand/issue in Linear
 */
export const createLinearErrand = async (
  title: string,
  description: string,
  categoryLabelId: string
): Promise<LinearIssue> => {
  logger.info({ title }, 'Creating Linear errand')

  const query = `
    mutation CreateMimerErrand(
      $teamId: String!,
      $projectId: String!,
      $labelIds: [String!]!,
      $title: String!,
      $description: String!
    ) {
      issueCreate(input: {
        teamId: $teamId,
        projectId: $projectId,
        title: $title,
        description: $description,
        labelIds: $labelIds
      }) {
        success
        issue { ${ISSUE_FIELDS} }
      }
    }
  `

  const variables = {
    teamId: config.linear.teamId,
    projectId: config.linear.projectId,
    labelIds: [config.linear.mimerVisibleLabelId, categoryLabelId],
    title,
    description,
  }

  const response = await executeGraphQL<CreateLinearErrandResponse>(
    query,
    variables
  )

  if (!response.data.issueCreate.success || !response.data.issueCreate.issue) {
    throw new Error('Failed to create Linear issue')
  }

  logger.info(
    { identifier: response.data.issueCreate.issue.identifier },
    'Created Linear errand'
  )

  return response.data.issueCreate.issue
}

/**
 * Get category labels (Bug, Improvement, new feature)
 */
export const getLinearLabels = async (): Promise<LinearLabel[]> => {
  logger.info('Fetching Linear category labels')

  const query = `
    query GetLabels {
      issueLabels(filter: { or: [
        { name: { eq: "Bug" } },
        { name: { eq: "Improvement" } },
        { name: { eq: "new feature" } }
      ] }) {
        nodes { id name }
      }
    }
  `

  const response = await executeGraphQL<GetLinearLabelsResponse>(query)

  logger.info(
    { count: response.data.issueLabels.nodes.length },
    'Fetched Linear labels'
  )

  return response.data.issueLabels.nodes
}

/**
 * Health check for Linear API connectivity
 */
export const linearHealthCheck = async (): Promise<void> => {
  const query = `query { viewer { id } }`
  await executeGraphQL<{ data: { viewer: { id: string } } }>(query)
}
