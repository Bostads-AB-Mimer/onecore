import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query'
import { ENTITY_CONFIG, buildQueryKey } from './useComponentEntity.config'
import type {
  EntityType,
  Operation,
  MutationVariables,
  EntityData,
  UpdateMutationVariables,
  DeleteMutationVariables,
} from './useComponentEntity.types'

/**
 * Generic hook for creating, updating, or deleting component library entities
 *
 * @param entityType - The type of entity ('category', 'type', 'subtype', 'model')
 * @param operation - The operation to perform ('create', 'update', 'delete')
 * @param parentIdField - Optional parent ID field name for cache invalidation (not needed for categories)
 * @param options - Optional React Query mutation options to override defaults
 * @returns UseMutationResult with the mutation state and methods
 *
 * @example
 * // Create a category
 * const createCategory = useComponentEntityMutation('category', 'create')
 * createCategory.mutate({ categoryName: 'New Category' })
 *
 * // Update a type
 * const updateType = useComponentEntityMutation('type', 'update')
 * updateType.mutate({ id: 'type-123', data: { typeName: 'Updated' }, parentId: 'cat-456' })
 *
 * // Delete a model
 * const deleteModel = useComponentEntityMutation('model', 'delete')
 * deleteModel.mutate({ id: 'model-789', parentId: 'subtype-012' })
 */
export function useComponentEntityMutation<
  T extends EntityType,
  Op extends Operation,
>(
  entityType: T,
  operation: Op,
  parentIdField?: string,
  options?: Omit<
    UseMutationOptions<
      Op extends 'delete' ? void : EntityData<T>,
      Error,
      MutationVariables<T, Op>
    >,
    'mutationFn' | 'onSuccess'
  > & {
    onSuccess?: (
      data: Op extends 'delete' ? void : EntityData<T>,
      variables: MutationVariables<T, Op>,
      context: any
    ) => void | Promise<void>
  }
): UseMutationResult<
  Op extends 'delete' ? void : EntityData<T>,
  Error,
  MutationVariables<T, Op>
> {
  const queryClient = useQueryClient()
  const config = ENTITY_CONFIG[entityType]

  return useMutation({
    mutationFn: async (variables: MutationVariables<T, Op>) => {
      if (operation === 'create') {
        return config.service.create(variables) as Promise<
          Op extends 'delete' ? void : EntityData<T>
        >
      }

      if (operation === 'update') {
        const { id, data } = variables as UpdateMutationVariables<T>
        return config.service.update(id, data) as Promise<
          Op extends 'delete' ? void : EntityData<T>
        >
      }

      if (operation === 'delete') {
        const { id } = variables as DeleteMutationVariables
        return config.service.delete(id) as Promise<
          Op extends 'delete' ? void : EntityData<T>
        >
      }

      throw new Error(`Unknown operation: ${operation}`)
    },
    onSuccess: async (data: any, variables: any, context: any) => {
      // Extract parent ID from variables for cache invalidation
      const parentId =
        (variables as any).parentId || (variables as any)[parentIdField || '']

      // Invalidate the appropriate query key
      const queryKey = buildQueryKey(entityType, parentId)
      await queryClient.invalidateQueries({ queryKey })

      // Call custom onSuccess if provided
      if (options?.onSuccess) {
        await options.onSuccess(data, variables, context)
      }
    },
    ...options,
  } as any)
}
