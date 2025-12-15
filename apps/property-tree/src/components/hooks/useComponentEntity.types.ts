import type {
  ComponentCategory,
  ComponentType,
  ComponentSubtype,
  ComponentModel,
  ComponentInstance,
  CreateComponentCategory,
  UpdateComponentCategory,
  CreateComponentType,
  UpdateComponentType,
  CreateComponentSubtype,
  UpdateComponentSubtype,
  CreateComponentModel,
  UpdateComponentModel,
  CreateComponentInstance,
  UpdateComponentInstance,
} from '@/services/types'

// Entity type literals
export type EntityType = 'category' | 'type' | 'subtype' | 'model' | 'instance'
export type Operation = 'create' | 'update' | 'delete'

// Map entity types to their data types
export interface ComponentEntityMap {
  category: ComponentCategory
  type: ComponentType
  subtype: ComponentSubtype
  model: ComponentModel
  instance: ComponentInstance
}

// Map entity types to their create data types
export interface ComponentCreateDataMap {
  category: CreateComponentCategory
  type: CreateComponentType
  subtype: CreateComponentSubtype
  model: CreateComponentModel
  instance: CreateComponentInstance
}

// Map entity types to their update data types
export interface ComponentUpdateDataMap {
  category: UpdateComponentCategory
  type: UpdateComponentType
  subtype: UpdateComponentSubtype
  model: UpdateComponentModel
  instance: UpdateComponentInstance
}

// Mutation variable types
export type CreateMutationVariables<T extends EntityType> = ComponentCreateDataMap[T]

export type UpdateMutationVariables<T extends EntityType> = {
  id: string
  data: ComponentUpdateDataMap[T]
  parentId?: string
}

export type DeleteMutationVariables = {
  id: string
  parentId?: string
}

// Union type for all mutation variables based on operation
export type MutationVariables<T extends EntityType, Op extends Operation> =
  Op extends 'create'
    ? CreateMutationVariables<T>
    : Op extends 'update'
      ? UpdateMutationVariables<T>
      : Op extends 'delete'
        ? DeleteMutationVariables
        : never

// Query key configuration
export interface EntityQueryConfig {
  root: string
  parentIdField: string | null
}

// Service configuration
export interface EntityServiceConfig {
  fetch: (parentId?: string) => Promise<any[]>
  create: (data: any) => Promise<any>
  update: (id: string, data: any) => Promise<any>
  delete: (id: string) => Promise<void>
}

// Combined entity configuration
export interface EntityConfig {
  queryKey: EntityQueryConfig
  service: EntityServiceConfig
}
