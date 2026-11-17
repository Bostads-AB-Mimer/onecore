import { ApiError, GET, POST } from './baseApi'
import type { components } from './generated/api-types'
import type { LeaseSearchQueryParams } from './leaseSearchService'

export type LeaseExport = components['schemas']['LeaseExport']

async function start(params: LeaseSearchQueryParams): Promise<LeaseExport> {
  const { data, error, response } = await POST('/lease-exports', {
    params: { query: params },
  })

  if (error || !data?.content) {
    throw new ApiError(response.status, 'lease export start failed')
  }

  return data.content
}

async function list(): Promise<LeaseExport[]> {
  const { data, error, response } = await GET('/lease-exports', {})

  if (error) throw new ApiError(response.status, 'lease export list failed')

  return data.content ?? []
}

async function getDownloadUrl(exportId: string): Promise<string> {
  const { data, error, response } = await GET('/lease-exports/{exportId}/url', {
    params: { path: { exportId } },
  })

  if (error || !data?.content) {
    throw new ApiError(response.status, 'lease export url failed')
  }

  return data.content.url
}

export const leaseExportService = { start, list, getDownloadUrl }
