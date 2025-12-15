import { GET, POST, PUT, DELETE } from './base-api'
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
      body: categoryData as any,
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
      body: categoryData as any,
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
    console.log('[componentLibraryService] getTypes called with categoryId:', categoryId)
    const { data, error} = await GET('/component-types', {
      params: categoryId ? {
        query: { categoryId } as any, // Type override until swagger is regenerated
      } : undefined,
    })
    console.log('[componentLibraryService] API response:', data?.content?.length, 'types')
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
      body: typeData as any,
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
      body: typeData as any,
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
    const queryParams: any = {
      limit: params?.limit || 100,
    }
    if (typeId) queryParams.typeId = typeId
    if (params?.page) queryParams.page = params.page
    if (params?.search && params.search.trim().length >= 2) {
      queryParams.subtypeName = params.search.trim()
    }

    const { data, error } = await GET('/component-subtypes', {
      params: {
        query: queryParams as any,
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
      body: subtypeData as any,
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
      body: subtypeData as any,
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
    const queryParams: any = {}
    if (subtypeId) queryParams.subtypeId = subtypeId
    if (options?.page) queryParams.page = options.page
    if (options?.limit) queryParams.limit = options.limit
    if (options?.search && options.search.trim().length >= 2) {
      queryParams.modelName = options.search.trim()
    }

    const { data, error } = await GET('/component-models', {
      params: Object.keys(queryParams).length > 0 ? {
        query: queryParams as any,
      } : undefined,
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
      body: modelData as any,
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
      body: modelData as any,
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
    params?: { page?: number; limit?: number; status?: string; search?: string }
  ): Promise<ComponentInstance[]> {
    const queryParams: any = {
      limit: params?.limit || 100,
    }
    if (modelId) queryParams.modelId = modelId
    if (params?.page) queryParams.page = params.page
    if (params?.status) queryParams.status = params.status
    if (params?.search && params.search.trim().length >= 2) {
      queryParams.serialNumber = params.search.trim()
    }

    const { data, error } = await GET('/components', {
      params: {
        query: queryParams as any,
      },
    })
    if (error) throw error
    return (data?.content || []) as ComponentInstance[]
  },

  async getInstanceById(id: string): Promise<ComponentInstance> {
    const { data, error } = await GET('/components/{id}', {
      params: {
        path: { id },
      },
    })
    if (error) throw error
    return data?.content as ComponentInstance
  },

  async createInstance(
    instanceData: CreateComponentInstance
  ): Promise<ComponentInstance> {
    const { data, error } = await POST('/components', {
      body: instanceData as any,
    })
    if (error) throw error
    return data?.content as ComponentInstance
  },

  async updateInstance(
    id: string,
    instanceData: UpdateComponentInstance
  ): Promise<ComponentInstance> {
    const { data, error } = await PUT('/components/{id}', {
      params: {
        path: { id },
      },
      body: instanceData as any,
    })
    if (error) throw error
    return data?.content as ComponentInstance
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
}
