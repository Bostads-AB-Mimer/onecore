import { Context } from 'koa'
import { Knex } from 'knex'

import {
  PaginatedResponse,
  parsePaginationParams,
  buildPaginatedResponse,
} from './index'

/**
 * Apply pagination to a Knex query and return paginated results
 * @param query - Knex query builder
 * @param ctx - Koa context
 * @param additionalParams - Additional query parameters to include in pagination links
 * @param defaultLimit - Default number of records per page (default: 20)
 * @param totalCount - If provided, skip the COUNT query and use this value.
 *                          Useful for export pagination where total is known from page 1.
 * @returns Paginated response with content, _meta, and _links
 */
export async function paginateKnex<T>(
  query: Knex.QueryBuilder,
  ctx: Context,
  additionalParams: Record<string, string> = {},
  defaultLimit = 20,
  totalCount?: number
): Promise<PaginatedResponse<T>> {
  const { limit, offset } = parsePaginationParams(ctx, defaultLimit)

  let totalRecords: number
  let rows: T[]

  if (totalCount !== undefined) {
    // Skip COUNT query when total is already known
    rows = (await query.limit(limit).offset(offset)) as T[]
    totalRecords = totalCount
  } else {
    // Run count and data queries in parallel
    const [countResult, dataRows] = await Promise.all([
      query.clone().clearSelect().clearOrder().count('* as count'),
      query.limit(limit).offset(offset),
    ])
    totalRecords = Number(countResult[0].count)
    rows = dataRows as T[]
  }

  return buildPaginatedResponse({
    content: rows,
    totalRecords,
    ctx,
    additionalParams,
    defaultLimit,
  })
}
