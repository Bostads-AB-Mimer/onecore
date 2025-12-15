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

// Conditional type helpers for entity data
export type EntityData<T extends EntityType> = T extends 'category'
  ? ComponentCategory
  : T extends 'type'
    ? ComponentType
    : T extends 'subtype'
      ? ComponentSubtype
      : T extends 'model'
        ? ComponentModel
        : T extends 'instance'
          ? ComponentInstance
          : never

export type CreateData<T extends EntityType> = T extends 'category'
  ? CreateComponentCategory
  : T extends 'type'
    ? CreateComponentType
    : T extends 'subtype'
      ? CreateComponentSubtype
      : T extends 'model'
        ? CreateComponentModel
        : T extends 'instance'
          ? CreateComponentInstance
          : never

export type UpdateData<T extends EntityType> = T extends 'category'
  ? UpdateComponentCategory
  : T extends 'type'
    ? UpdateComponentType
    : T extends 'subtype'
      ? UpdateComponentSubtype
      : T extends 'model'
        ? UpdateComponentModel
        : T extends 'instance'
          ? UpdateComponentInstance
          : never

// Mutation variable types
export type UpdateMutationVariables<T extends EntityType> = {
  id: string
  data: UpdateData<T>
  parentId?: string
}

export type DeleteMutationVariables = {
  id: string
  parentId?: string
}

// Union type for all mutation variables based on operation
export type MutationVariables<
  T extends EntityType,
  Op extends Operation,
> = Op extends 'create'
  ? CreateData<T>
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
  fetch: (parentId?: string, search?: string) => Promise<any[]>
  create: (data: any) => Promise<any>
  update: (id: string, data: any) => Promise<any>
  delete: (id: string) => Promise<void>
}

// Combined entity configuration
export interface EntityConfig {
  queryKey: EntityQueryConfig
  service: EntityServiceConfig
}
