import type {
  Component,
  ComponentCategory,
  ComponentModel,
  ComponentSubtype,
  ComponentType,
  CreateComponent,
  CreateComponentCategory,
  CreateComponentModel,
  CreateComponentSubtype,
  CreateComponentType,
  UpdateComponent,
  UpdateComponentCategory,
  UpdateComponentModel,
  UpdateComponentSubtype,
  UpdateComponentType,
} from '@/services/types'

import { DELETE, GET, POST, PUT } from './baseApi'

export const componentLibraryService = {
  // ===== Category Operations =====
  async getCategories(): Promise<ComponentCategory[]> {
    const { data, error } = await GET('/component-categories')
    if (error) throw error
    return (data?.content || []) as ComponentCategory[]
  },

  async getCategoryById(id: string): Promise<ComponentCategory> {
    const { data, error } = await GET('/component-categories/{id}', {
      params: {
        path: { id },
      },
    })
    if (error) throw error
    return data?.content as ComponentCategory
  },

  async createCategory(
    categoryData: CreateComponentCategory
  ): Promise<ComponentCategory> {
    const { data, error } = await POST('/component-categories', {
      body: categoryData,
    })
    if (error) throw error
    return data?.content as ComponentCategory
  },

  async updateCategory(
    id: string,
    categoryData: UpdateComponentCategory
  ): Promise<ComponentCategory> {
    const { data, error } = await PUT('/component-categories/{id}', {
      params: {
        path: { id },
      },
      body: categoryData,
    })
    if (error) throw error
    return data?.content as ComponentCategory
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await DELETE('/component-categories/{id}', {
      params: {
        path: { id },
      },
    })
    if (error) throw error
  },

  // ===== Type Operations =====
  async getTypes(categoryId?: string): Promise<ComponentType[]> {
    const { data, error } = await GET('/component-types', {
      params: categoryId
        ? {
            query: { categoryId },
          }
        : undefined,
    })
    if (error) throw error
    return (data?.content || []) as ComponentType[]
  },

  async getTypesByCategoryId(categoryId: string): Promise<ComponentType[]> {
    return this.getTypes(categoryId)
  },

  async getTypeById(id: string): Promise<ComponentType> {
    const { data, error } = await GET('/component-types/{id}', {
      params: {
        path: { id },
      },
    })
    if (error) throw error
    return data?.content as ComponentType
  },

  async createType(typeData: CreateComponentType): Promise<ComponentType> {
    const { data, error } = await POST('/component-types', {
      body: typeData,
    })
    if (error) throw error
    return data?.content as ComponentType
  },

  async updateType(
    id: string,
    typeData: UpdateComponentType
  ): Promise<ComponentType> {
    const { data, error } = await PUT('/component-types/{id}', {
      params: {
        path: { id },
      },
      body: typeData,
    })
    if (error) throw error
    return data?.content as ComponentType
  },

  async deleteType(id: string): Promise<void> {
    const { error } = await DELETE('/component-types/{id}', {
      params: {
        path: { id },
      },
    })
    if (error) throw error
  },

  // ===== Subtype Operations =====
  async getSubtypes(
    typeId?: string,
    params?: { page?: number; limit?: number; search?: string }
  ): Promise<ComponentSubtype[]> {
    const { data, error } = await GET('/component-subtypes', {
      params: {
        query: {
          typeId,
          limit: params?.limit || 100,
          page: params?.page,
          subtypeName:
            params?.search && params.search.trim().length >= 2
              ? params.search.trim()
              : undefined,
        },
      },
    })
    if (error) throw error
    return (data?.content || []) as ComponentSubtype[]
  },

  async getSubtypesByTypeId(typeId: string): Promise<ComponentSubtype[]> {
    return this.getSubtypes(typeId)
  },

  async getSubtypeById(id: string): Promise<ComponentSubtype> {
    const { data, error } = await GET('/component-subtypes/{id}', {
      params: {
        path: { id },
      },
    })
    if (error) throw error
    return data?.content as ComponentSubtype
  },

  async createSubtype(
    subtypeData: CreateComponentSubtype
  ): Promise<ComponentSubtype> {
    const { data, error } = await POST('/component-subtypes', {
      body: subtypeData,
    })
    if (error) throw error
    return data?.content as ComponentSubtype
  },

  async updateSubtype(
    id: string,
    subtypeData: UpdateComponentSubtype
  ): Promise<ComponentSubtype> {
    const { data, error } = await PUT('/component-subtypes/{id}', {
      params: {
        path: { id },
      },
      body: subtypeData,
    })
    if (error) throw error
    return data?.content as ComponentSubtype
  },

  async deleteSubtype(id: string): Promise<void> {
    const { error } = await DELETE('/component-subtypes/{id}', {
      params: {
        path: { id },
      },
    })
    if (error) throw error
  },

  // ===== Model Operations =====
  async getModels(
    subtypeId?: string,
    options?: { page?: number; limit?: number; search?: string }
  ): Promise<ComponentModel[]> {
    const query: Record<string, string | number | undefined> = {}
    if (subtypeId) query.subtypeId = subtypeId
    if (options?.page) query.page = options.page
    if (options?.limit) query.limit = options.limit
    if (options?.search && options.search.trim().length >= 2) {
      query.modelName = options.search.trim()
    }

    const { data, error } = await GET('/component-models', {
      params: Object.keys(query).length > 0 ? { query } : undefined,
    })
    if (error) throw error
    return (data?.content || []) as ComponentModel[]
  },

  async getModelsBySubtypeId(subtypeId: string): Promise<ComponentModel[]> {
    return this.getModels(subtypeId)
  },

  async getModelById(id: string): Promise<ComponentModel> {
    const { data, error } = await GET('/component-models/{id}', {
      params: {
        path: { id },
      },
    })
    if (error) throw error
    return data?.content as ComponentModel
  },

  async createModel(modelData: CreateComponentModel): Promise<ComponentModel> {
    const { data, error } = await POST('/component-models', {
      body: modelData,
    })
    if (error) throw error
    return data?.content as ComponentModel
  },

  async updateModel(
    id: string,
    modelData: UpdateComponentModel
  ): Promise<ComponentModel> {
    const { data, error } = await PUT('/component-models/{id}', {
      params: {
        path: { id },
      },
      body: modelData,
    })
    if (error) throw error
    return data?.content as ComponentModel
  },

  async deleteModel(id: string): Promise<void> {
    const { error } = await DELETE('/component-models/{id}', {
      params: {
        path: { id },
      },
    })
    if (error) throw error
  },

  // ===== Instance Operations =====
  async getInstances(
    modelId?: string,
    params?: {
      page?: number
      limit?: number
      status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED'
      search?: string
    }
  ): Promise<Component[]> {
    const { data, error } = await GET('/components', {
      params: {
        query: {
          modelId,
          limit: params?.limit || 100,
          page: params?.page,
          status: params?.status,
          serialNumber:
            params?.search && params.search.trim().length >= 2
              ? params.search.trim()
              : undefined,
        },
      },
    })
    if (error) throw error
    return (data?.content || []) as Component[]
  },

  async getInstanceById(id: string): Promise<Component> {
    const { data, error } = await GET('/components/{id}', {
      params: {
        path: { id },
      },
    })
    if (error) throw error
    return data?.content as Component
  },

  async createInstance(instanceData: CreateComponent): Promise<Component> {
    const { data, error } = await POST('/components', {
      body: instanceData as any, // Local types allow null, API types expect undefined
    })
    if (error) throw error
    return data?.content as Component
  },

  async updateInstance(
    id: string,
    instanceData: UpdateComponent
  ): Promise<Component> {
    const { data, error } = await PUT('/components/{id}', {
      params: {
        path: { id },
      },
      body: instanceData as any, // Local types allow null, API types expect undefined
    })
    if (error) throw error
    return data?.content as Component
  },

  async deleteInstance(id: string): Promise<void> {
    const { error } = await DELETE('/components/{id}', {
      params: {
        path: { id },
      },
    })
    if (error) throw error
  },
}

// Export types for use in components
export type {
  Component,
  ComponentCategory,
  ComponentModel,
  ComponentSubtype,
  ComponentType,
  CreateComponent,
  CreateComponentCategory,
  CreateComponentModel,
  CreateComponentSubtype,
  CreateComponentType,
  UpdateComponent,
  UpdateComponentCategory,
  UpdateComponentModel,
  UpdateComponentSubtype,
  UpdateComponentType,
}
