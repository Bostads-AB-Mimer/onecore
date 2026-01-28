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
 * @returns Paginated response with content, _meta, and _links
 */
export async function paginateKnex<T>(
  query: Knex.QueryBuilder,
  ctx: Context,
  additionalParams: Record<string, string> = {},
  defaultLimit = 20
): Promise<PaginatedResponse<T>> {
  const { limit, offset } = parsePaginationParams(ctx, defaultLimit)

  // Run count and data queries in parallel
  const [countResult, rows] = await Promise.all([
    query.clone().clearSelect().clearOrder().count('* as count'),
    query.limit(limit).offset(offset),
  ])
  const totalRecords = Number(countResult[0].count)

  return buildPaginatedResponse({
    content: rows as T[],
    totalRecords,
    ctx,
    additionalParams,
    defaultLimit,
  })
}
