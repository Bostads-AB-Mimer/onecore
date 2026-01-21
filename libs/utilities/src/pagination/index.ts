import { Context } from 'koa'

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

export interface PaginationMeta {
  totalRecords: number
  page: number
  limit: number
  count: number
}

export interface PaginationLinks {
  href: string
  rel: 'self' | 'first' | 'last' | 'prev' | 'next'
}

export interface PaginatedResponse<T> {
  content: T[]
  _meta: PaginationMeta
  _links: PaginationLinks[]
}

/**
 * Parse pagination parameters from query string
 * @param ctx - Koa context
 * @param defaultLimit - Default number of records per page (default: 20)
 * @returns Pagination parameters with page, limit, and offset
 */
export function parsePaginationParams(
  ctx: Context,
  defaultLimit = 20
): PaginationParams {
  const page = Math.max(1, parseInt(ctx.query.page as string) || 1)
  const limit = Math.max(1, parseInt(ctx.query.limit as string) || defaultLimit)
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

/**
 * Build pagination links according to Swedish API standard
 * @param ctx - Koa context
 * @param page - Current page number
 * @param limit - Records per page
 * @param totalPages - Total number of pages
 * @param additionalParams - Additional query parameters to include in links
 * @returns Array of pagination links
 */
export function buildPaginationLinks(
  ctx: Context,
  page: number,
  limit: number,
  totalPages: number,
  additionalParams: Record<string, string> = {}
): PaginationLinks[] {
  const baseUrl = ctx.request.URL.origin + ctx.request.URL.pathname

  // Build query string from additional params
  const queryParams = new URLSearchParams(additionalParams)
  const additionalQuery = queryParams.toString()
    ? `&${queryParams.toString()}`
    : ''

  const links: PaginationLinks[] = [
    {
      href: `${baseUrl}?page=${page}&limit=${limit}${additionalQuery}`,
      rel: 'self',
    },
    {
      href: `${baseUrl}?page=1&limit=${limit}${additionalQuery}`,
      rel: 'first',
    },
    {
      href: `${baseUrl}?page=${totalPages}&limit=${limit}${additionalQuery}`,
      rel: 'last',
    },
  ]

  if (page > 1) {
    links.push({
      href: `${baseUrl}?page=${page - 1}&limit=${limit}${additionalQuery}`,
      rel: 'prev',
    })
  }

  if (page < totalPages) {
    links.push({
      href: `${baseUrl}?page=${page + 1}&limit=${limit}${additionalQuery}`,
      rel: 'next',
    })
  }

  return links
}

/**
 * Build a paginated response from pre-fetched content
 * Use this when you handle the query manually but want consistent pagination response format

 */
export function buildPaginatedResponse<T>({
  content,
  totalRecords,
  ctx,
  additionalParams = {},
  defaultLimit = 20,
}: {
  content: T[]
  totalRecords: number
  ctx: Context
  additionalParams?: Record<string, string>
  defaultLimit?: number
}): PaginatedResponse<T> {
  const { page, limit } = parsePaginationParams(ctx, defaultLimit)
  const totalPages = Math.ceil(totalRecords / limit)

  return {
    content,
    _meta: {
      totalRecords,
      page,
      limit,
      count: content.length,
    },
    _links: buildPaginationLinks(
      ctx,
      page,
      limit,
      totalPages,
      additionalParams
    ),
  }
}

export { paginateKnex } from './knex'
