/**
 * Common types shared across all DAX API resources
 */

export interface DaxApiResponse<T> {
  apiVersion: string
  correlationId: string
  statusCode: number
  message: string | null
  paging?: {
    totalCount: number
    offset: number
    limit: number
  }
  data: T
}

export interface DaxClientConfig {
  apiUrl: string
  clientId: string
  username: string
  password: string
  privateKey: string
  apiVersion?: string
  partnerId: string
  instanceId: string
}
