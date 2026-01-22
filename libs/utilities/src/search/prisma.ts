import { Context } from 'koa'

export interface PrismaSearchConfig {
  /** Default fields to search when q param is provided */
  defaultSearchFields: string[]
  /** Field mappings: query param name → Prisma where path (dot notation) */
  fieldMappings?: Record<string, string>
  /** Params to exclude from AND filtering (default: q, fields, page, limit) */
  reservedParams?: string[]
}

export interface PrismaSearchResult<T> {
  hasSearchParams: boolean
  whereClause: T
  error?: string
}

/**
 * Builds a Prisma WHERE clause from query parameters
 *
 * Features:
 * - OR search: `q` param searches across defaultSearchFields with LIKE
 * - AND search: Individual field params for exact matching
 * - Comparison operators: >=, <=, >, < for dates/numbers
 *
 * @example
 * const result = buildPrismaSearchClause(ctx, {
 *   defaultSearchFields: ['rentalId', 'address', 'propertyName'],
 *   fieldMappings: {
 *     'address': 'propertyStructure.name',
 *     'distrikt': 'propertyStructure.administrativeUnit.district'
 *   }
 * })
 */
export function buildPrismaSearchClause<T extends Record<string, unknown>>(
  ctx: Context,
  config: PrismaSearchConfig,
  baseWhere: T = {} as T
): PrismaSearchResult<T> {
  const {
    defaultSearchFields,
    fieldMappings = {},
    reservedParams = ['q', 'fields', 'page', 'limit'],
  } = config

  const whereClause: Record<string, unknown> = { ...baseWhere }

  // Handle OR search (q param) - fuzzy LIKE across multiple fields
  if (typeof ctx.query.q === 'string' && ctx.query.q.trim().length >= 3) {
    const searchTerm = ctx.query.q.trim()
    const fields =
      typeof ctx.query.fields === 'string'
        ? ctx.query.fields.split(',').map((f) => f.trim())
        : defaultSearchFields

    whereClause.OR = fields.map((field) => {
      const path = fieldMappings[field] || field
      return buildNestedContains(path, searchTerm)
    })
  }

  // Handle AND filters (individual field params) - exact match
  for (const [param, value] of Object.entries(ctx.query)) {
    if (reservedParams.includes(param)) continue
    if (typeof value !== 'string' || !value.trim()) continue

    const trimmed = value.trim()
    const path = fieldMappings[param] || param

    // Check for comparison operators (>=, <=, >, <)
    const opMatch = trimmed.match(/^(>=|<=|>|<)(.+)$/)
    if (opMatch) {
      const opMap: Record<string, string> = {
        '>=': 'gte',
        '<=': 'lte',
        '>': 'gt',
        '<': 'lt',
      }
      mergeNestedWhere(whereClause, path, {
        [opMap[opMatch[1]]]: opMatch[2].trim(),
      })
    } else {
      mergeNestedWhere(whereClause, path, trimmed)
    }
  }

  // Check if any search params provided
  const hasQ = typeof ctx.query.q === 'string' && ctx.query.q.trim().length >= 3
  const hasFieldParams = Object.entries(ctx.query).some(
    ([k, v]) => !reservedParams.includes(k) && typeof v === 'string' && v.trim()
  )

  return {
    hasSearchParams: hasQ || hasFieldParams,
    whereClause: whereClause as T,
    error:
      !hasQ && !hasFieldParams
        ? 'At least one search parameter required'
        : undefined,
  }
}

/** Build nested { contains: value } for dot-notation paths */
function buildNestedContains(
  path: string,
  value: string
): Record<string, unknown> {
  const parts = path.split('.')
  let result: Record<string, unknown> = { contains: value }
  for (let i = parts.length - 1; i >= 0; i--) {
    result = { [parts[i]]: result }
  }
  return result
}

/** Merge nested value into whereClause at dot-notation path */
function mergeNestedWhere(
  where: Record<string, unknown>,
  path: string,
  value: unknown
) {
  const parts = path.split('.')
  let current = where
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = current[parts[i]] || {}
    current = current[parts[i]] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}
