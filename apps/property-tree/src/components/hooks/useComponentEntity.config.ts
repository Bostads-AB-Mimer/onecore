import { componentLibraryService } from '@/services/api/core/componentLibraryService'
import type { EntityType, EntityConfig } from './useComponentEntity.types'

// Entity configuration mapping
export const ENTITY_CONFIG: Record<EntityType, EntityConfig> = {
  category: {
    queryKey: {
      root: 'component-categories',
      parentIdField: null,
    },
    service: {
      fetch: () => componentLibraryService.getCategories(),
      create: (data) => componentLibraryService.createCategory(data),
      update: (id, data) => componentLibraryService.updateCategory(id, data),
      delete: (id) => componentLibraryService.deleteCategory(id),
    },
  },
  type: {
    queryKey: {
      root: 'component-types',
      parentIdField: 'categoryId',
    },
    service: {
      fetch: (parentId) => componentLibraryService.getTypes(parentId),
      create: (data) => componentLibraryService.createType(data),
      update: (id, data) => componentLibraryService.updateType(id, data),
      delete: (id) => componentLibraryService.deleteType(id),
    },
  },
  subtype: {
    queryKey: {
      root: 'component-subtypes',
      parentIdField: 'typeId',
    },
    service: {
      fetch: (parentId?: string, search?: string) =>
        componentLibraryService.getSubtypes(parentId, { search }),
      create: (data) => componentLibraryService.createSubtype(data),
      update: (id, data) => componentLibraryService.updateSubtype(id, data),
      delete: (id) => componentLibraryService.deleteSubtype(id),
    },
  },
  model: {
    queryKey: {
      root: 'component-models',
      parentIdField: 'subtypeId',
    },
    service: {
      fetch: (parentId?: string, search?: string) =>
        componentLibraryService.getModels(parentId, { search }),
      create: (data) => componentLibraryService.createModel(data),
      update: (id, data) => componentLibraryService.updateModel(id, data),
      delete: (id) => componentLibraryService.deleteModel(id),
    },
  },
  instance: {
    queryKey: {
      root: 'component-instances',
      parentIdField: 'modelId',
    },
    service: {
      fetch: (parentId?: string, search?: string) =>
        componentLibraryService.getInstances(parentId, { search }),
      create: (data) => componentLibraryService.createInstance(data),
      update: (id, data) => componentLibraryService.updateInstance(id, data),
      delete: (id) => componentLibraryService.deleteInstance(id),
    },
  },
}

// Helper function to build query keys
export function buildQueryKey(
  entityType: EntityType,
  parentId?: string,
  search?: string
): (string | undefined)[] {
  const config = ENTITY_CONFIG[entityType]

  if (config.queryKey.parentIdField === null) {
    // Root entity (category)
    return [config.queryKey.root]
  }

  // Child entity (type, subtype, model, instance)
  return [config.queryKey.root, parentId, search]
}
