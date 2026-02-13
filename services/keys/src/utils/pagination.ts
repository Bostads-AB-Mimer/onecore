import { Context } from 'koa'
import { Knex } from 'knex'

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
 * @returns Pagination parameters with page, limit, and offset
 */
export function parsePaginationParams(ctx: Context): PaginationParams {
  const page = Math.max(1, parseInt(ctx.query.page as string) || 1)
  const limit = Math.max(1, parseInt(ctx.query.limit as string) || 20)
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
 * Apply pagination to a Knex query and return paginated results
 * @param query - Knex query builder
 * @param ctx - Koa context
 * @param additionalParams - Additional query parameters to include in pagination links
 * @returns Paginated response with content, _meta, and _links
 */
export async function paginate<T>(
  query: Knex.QueryBuilder,
  ctx: Context,
  additionalParams: Record<string, string> = {}
): Promise<PaginatedResponse<T>> {
  const { page, limit, offset } = parsePaginationParams(ctx)

  // Clone query for counting
  const countQuery = query
    .clone()
    .clearSelect()
    .clearOrder()
    .count('* as count')
  const [{ count: totalRecords }] = await countQuery

  // Apply pagination to original query
  const rows = await query.limit(limit).offset(offset)

  // Calculate total pages
  const totalPages = Math.ceil(Number(totalRecords) / limit)

  // Build links
  const links = buildPaginationLinks(
    ctx,
    page,
    limit,
    totalPages,
    additionalParams
  )

  return {
    content: rows as T[],
    _meta: {
      totalRecords: Number(totalRecords),
      page,
      limit,
      count: rows.length,
    },
    _links: links,
  }
}
