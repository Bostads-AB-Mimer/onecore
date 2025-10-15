import { Context } from 'koa'
import { Knex } from 'knex'

export interface SearchConfig {
  /**
   * Default fields to search when q param is provided without explicit fields param
   * @example ['keyName', 'keyType']
   */
  defaultSearchFields: string[]

  /**
   * Parameters that should be excluded from AND search filtering
   * Defaults to: 'q', 'fields', 'page', 'limit'
   */
  reservedParams?: string[]
}

export interface SearchResult {
  /**
   * Whether at least one search parameter was provided
   */
  hasSearchParams: boolean

  /**
   * Error reason if validation failed
   */
  error?: string
}

/**
 * Builds a search query with OR and AND filtering capabilities
 *
 * Features:
 * - **OR search**: Use `q` with `fields` query params for fuzzy LIKE search across multiple fields
 * - **AND search**: Use any field parameter for exact match filtering (strict equality)
 * - **Comparison operators**: Prefix values with `>`, `<`, `>=`, `<=` for date/number comparisons
 * - **Array support**: Handles multiple values for the same parameter
 *
 * @param query - The Knex query builder to modify
 * @param ctx - Koa context containing query parameters
 * @param config - Search configuration options
 * @returns SearchResult with hasSearchParams flag and optional error
 *
 * @example
 * ```typescript
 * const config: SearchConfig = {
 *   defaultSearchFields: ['keyName']
 * }
 *
 * const result = buildSearchQuery(query, ctx, config)
 * if (!result.hasSearchParams) {
 *   ctx.status = 400
 *   ctx.body = { reason: result.error }
 *   return
 * }
 * ```
 */
export function buildSearchQuery(
  query: Knex.QueryBuilder,
  ctx: Context,
  config: SearchConfig
): SearchResult {
  const {
    defaultSearchFields,
    reservedParams = ['q', 'fields', 'page', 'limit'],
  } = config

  // Handle OR search (q with fields)
  if (typeof ctx.query.q === 'string' && ctx.query.q.trim().length >= 3) {
    const searchTerm = ctx.query.q.trim()

    // Get fields to search across (OR condition)
    let fieldsToSearch: string[] = defaultSearchFields

    if (typeof ctx.query.fields === 'string') {
      fieldsToSearch = ctx.query.fields.split(',').map((f) => f.trim())
    }

    // Add OR conditions
    query.where((builder) => {
      fieldsToSearch.forEach((field, index) => {
        if (index === 0) {
          builder.where(field, 'like', `%${searchTerm}%`)
        } else {
          builder.orWhere(field, 'like', `%${searchTerm}%`)
        }
      })
    })
  }

  // Handle AND search (individual field parameters) - search any param that's not reserved
  for (const [field, value] of Object.entries(ctx.query)) {
    if (!reservedParams.includes(field)) {
      const values = Array.isArray(value) ? value : [value]

      for (const val of values) {
        if (typeof val === 'string' && val.trim().length > 0) {
          const trimmedValue = val.trim()

          // Check if value starts with a comparison operator (>=, <=, >, <)
          const operatorMatch = trimmedValue.match(/^(>=|<=|>|<)(.+)$/)

          if (operatorMatch) {
            const operator = operatorMatch[1]
            const compareValue = operatorMatch[2].trim()
            query.where(field, operator, compareValue)
          } else {
            // Use strict equality for all AND filters (better performance and matches UI behavior)
            query.where(field, '=', trimmedValue)
          }
        }
      }
    }
  }

  // Check if at least one search criteria was provided
  const hasQParam =
    typeof ctx.query.q === 'string' && ctx.query.q.trim().length >= 3
  const hasFieldParams = Object.entries(ctx.query).some(([key, value]) => {
    if (reservedParams.includes(key)) return false
    if (typeof value === 'string' && value.trim().length > 0) {
      return true
    }
    if (
      Array.isArray(value) &&
      value.some((v) => typeof v === 'string' && v.trim().length > 0)
    ) {
      return true
    }
    return false
  })

  return {
    hasSearchParams: hasQParam || hasFieldParams,
    error:
      !hasQParam && !hasFieldParams
        ? 'At least one search parameter is required'
        : undefined,
  }
}
