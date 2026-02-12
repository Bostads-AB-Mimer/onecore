import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query'
import { componentLibraryService } from '@/services/api/core/componentLibraryService'
import { buildQueryKey } from '../lib/componentLibraryQueryKeys'
import type {
  EntityType,
  Operation,
  MutationVariables,
  EntityData,
  CreateData,
  UpdateData,
  CreateMutationVariables,
  UpdateMutationVariables,
  DeleteMutationVariables,
} from '@/services/types'

/**
 * Generic hook for creating, updating, or deleting component library entities
 *
 * @param entityType - The type of entity ('category', 'type', 'subtype', 'model', 'instance')
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
      context: unknown
    ) => void | Promise<void>
  }
): UseMutationResult<
  Op extends 'delete' ? void : EntityData<T>,
  Error,
  MutationVariables<T, Op>
> {
  const queryClient = useQueryClient()

  const mutationFn = async (
    variables: MutationVariables<T, Op>
  ): Promise<Op extends 'delete' ? void : EntityData<T>> => {
    if (operation === 'create') {
      const { parentId: _parentId, ...createData } =
        variables as CreateMutationVariables<T>
      return createEntity(entityType, createData as CreateData<T>) as Promise<
        Op extends 'delete' ? void : EntityData<T>
      >
    }
    if (operation === 'update') {
      const { id, data } = variables as UpdateMutationVariables<T>
      return updateEntity(entityType, id, data) as Promise<
        Op extends 'delete' ? void : EntityData<T>
      >
    }
    if (operation === 'delete') {
      const { id } = variables as DeleteMutationVariables
      return deleteEntity(entityType, id) as Promise<
        Op extends 'delete' ? void : EntityData<T>
      >
    }
    throw new Error(`Unknown operation: ${operation}`)
  }

  return useMutation({
    mutationFn,
    onSuccess: async (
      data: Op extends 'delete' ? void : EntityData<T>,
      variables: MutationVariables<T, Op>,
      context: unknown
    ) => {
      // Extract parent ID from variables for cache invalidation
      const vars = variables as { parentId?: string; oldParentId?: string }
      const parentId =
        vars.parentId ||
        (variables as Record<string, unknown>)[parentIdField || '']

      // Invalidate the appropriate query key
      const queryKey = buildQueryKey(entityType, parentId as string | undefined)
      await queryClient.invalidateQueries({ queryKey })

      // If entity was moved (parent changed), also invalidate old parent's cache
      if (vars.oldParentId) {
        const oldQueryKey = buildQueryKey(entityType, vars.oldParentId)
        await queryClient.invalidateQueries({ queryKey: oldQueryKey })
      }

      // Call custom onSuccess if provided
      if (options?.onSuccess) {
        await options.onSuccess(data, variables, context)
      }
    },
    ...options,
  })
}

// Helper functions for CRUD operations
function createEntity<T extends EntityType>(
  entityType: T,
  data: CreateData<T>
): Promise<EntityData<T>> {
  switch (entityType) {
    case 'category':
      return componentLibraryService.createCategory(
        data as CreateData<'category'>
      ) as Promise<EntityData<T>>
    case 'type':
      return componentLibraryService.createType(
        data as CreateData<'type'>
      ) as Promise<EntityData<T>>
    case 'subtype':
      return componentLibraryService.createSubtype(
        data as CreateData<'subtype'>
      ) as Promise<EntityData<T>>
    case 'model':
      return componentLibraryService.createModel(
        data as CreateData<'model'>
      ) as Promise<EntityData<T>>
    case 'instance':
      return componentLibraryService.createInstance(
        data as CreateData<'instance'>
      ) as Promise<EntityData<T>>
    default:
      throw new Error(`Unknown entity type: ${entityType}`)
  }
}

function updateEntity<T extends EntityType>(
  entityType: T,
  id: string,
  data: UpdateData<T>
): Promise<EntityData<T>> {
  switch (entityType) {
    case 'category':
      return componentLibraryService.updateCategory(
        id,
        data as UpdateData<'category'>
      ) as Promise<EntityData<T>>
    case 'type':
      return componentLibraryService.updateType(
        id,
        data as UpdateData<'type'>
      ) as Promise<EntityData<T>>
    case 'subtype':
      return componentLibraryService.updateSubtype(
        id,
        data as UpdateData<'subtype'>
      ) as Promise<EntityData<T>>
    case 'model':
      return componentLibraryService.updateModel(
        id,
        data as UpdateData<'model'>
      ) as Promise<EntityData<T>>
    case 'instance':
      return componentLibraryService.updateInstance(
        id,
        data as UpdateData<'instance'>
      ) as Promise<EntityData<T>>
    default:
      throw new Error(`Unknown entity type: ${entityType}`)
  }
}

function deleteEntity(entityType: EntityType, id: string) {
  switch (entityType) {
    case 'category':
      return componentLibraryService.deleteCategory(id)
    case 'type':
      return componentLibraryService.deleteType(id)
    case 'subtype':
      return componentLibraryService.deleteSubtype(id)
    case 'model':
      return componentLibraryService.deleteModel(id)
    case 'instance':
      return componentLibraryService.deleteInstance(id)
    default:
      throw new Error(`Unknown entity type: ${entityType}`)
  }
}
