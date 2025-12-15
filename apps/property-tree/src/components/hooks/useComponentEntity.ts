import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query'
import { ENTITY_CONFIG, buildQueryKey } from './useComponentEntity.config'
import type { EntityType, EntityData } from './useComponentEntity.types'

/**
 * Generic hook for fetching component library entities
 *
 * @param entityType - The type of entity to fetch ('category', 'type', 'subtype', 'model', 'instance')
 * @param parentId - Optional parent ID for filtering. If omitted, fetches all entities of that type
 * @param searchOptions - Optional search options including search term
 * @param options - Optional React Query options to override defaults
 * @returns UseQueryResult with the entity data
 *
 * @example
 * // Fetch all categories
 * const { data: categories } = useComponentEntity('category')
 *
 * // Fetch all types (without filtering by category)
 * const { data: allTypes } = useComponentEntity('type')
 *
 * // Fetch types filtered by category ID
 * const { data: types } = useComponentEntity('type', categoryId)
 *
 * // Fetch models with search
 * const { data: models } = useComponentEntity('model', subtypeId, { search: 'Danfoss' })
 */
export function useComponentEntity<T extends EntityType>(
  entityType: T,
  parentId?: string,
  searchOptions?: { search?: string },
  options?: Omit<
    UseQueryOptions<EntityData<T>[], Error>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<EntityData<T>[], Error> {
  const config = ENTITY_CONFIG[entityType]

  // Note: Child entities (type, subtype, model) now support fetching all items when parentId is undefined
  // The query should always be enabled unless explicitly disabled via options
  return useQuery<EntityData<T>[], Error>({
    queryKey: buildQueryKey(entityType, parentId, searchOptions?.search),
    queryFn: () =>
      config.service.fetch(parentId, searchOptions?.search) as Promise<
        EntityData<T>[]
      >,
    enabled: options?.enabled !== false,
    ...options,
  })
}
