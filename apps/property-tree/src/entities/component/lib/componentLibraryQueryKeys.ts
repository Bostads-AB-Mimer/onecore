import type { EntityType } from '@/services/types'

/**
 * Query key roots for component library entities
 * Used by both useComponentEntity and useComponentEntityMutation
 */
export const QUERY_KEY_ROOTS: Record<EntityType, string> = {
  category: 'component-categories',
  type: 'component-types',
  subtype: 'component-subtypes',
  model: 'component-models',
  instance: 'component-instances',
}

/**
 * Builds a query key for React Query cache operations
 *
 * @param entityType - The type of entity
 * @param parentId - Optional parent ID for filtering
 * @param search - Optional search term
 * @returns Query key array for React Query
 */
export function buildQueryKey(
  entityType: EntityType,
  parentId?: string,
  search?: string
): (string | undefined)[] {
  const root = QUERY_KEY_ROOTS[entityType]

  if (entityType === 'category') {
    return [root]
  }

  // For mutation cache invalidation (no search param)
  if (search === undefined) {
    return [root, parentId]
  }

  // For query fetching (with optional search)
  return [root, parentId, search]
}
