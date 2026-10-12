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

// The backend caps `limit` at 100 per request. Categories and types have no
// server-side search, so "fetch all" must walk every page — a single capped
// request would make row 101+ unreachable in the client-paginated tables.
const PAGE_LIMIT = 100

const fetchAllPages = async <T>(
  fetchPage: (
    page: number
  ) => Promise<{ data?: { content?: unknown[] }; error?: unknown }>
): Promise<T[]> => {
  const all: T[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await fetchPage(page)
    if (error) throw error
    const items = (data?.content ?? []) as T[]
    all.push(...items)
    // A short page means we've reached the end (not every list response
    // carries pagination meta to read a total from).
    if (items.length < PAGE_LIMIT) return all
  }
}

export interface ComponentPageFilter {
  subtypeId: string
  modelId?: string
  search?: string
  page: number
  limit: number
}

export interface ComponentPage {
  content: Component[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export const componentLibraryService = {
  // ===== Category Operations =====
  async getCategories(): Promise<ComponentCategory[]> {
    return fetchAllPages<ComponentCategory>((page) =>
      GET('/component-categories', {
        params: { query: { limit: PAGE_LIMIT, page } },
      })
    )
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
    return fetchAllPages<ComponentType>((page) =>
      GET('/component-types', {
        params: { query: { limit: PAGE_LIMIT, page, categoryId } },
      })
    )
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
    options?: { search?: string }
  ): Promise<ComponentModel[]> {
    const search = options?.search?.trim()
    const fetchPage = (page: number) =>
      GET('/component-models', {
        params: {
          query: {
            limit: PAGE_LIMIT,
            page,
            subtypeId: subtypeId || undefined,
            modelName: search && search.length >= 2 ? search : undefined,
          },
        },
      })

    // Without a subtype this is a search across every model: one page is enough.
    if (!subtypeId) {
      const { data, error } = await fetchPage(1)
      if (error) throw error
      return (data?.content || []) as ComponentModel[]
    }
    return fetchAllPages<ComponentModel>(fetchPage)
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
  async getComponentPage(filter: ComponentPageFilter): Promise<ComponentPage> {
    const search = filter.search?.trim()
    const { data, error } = await GET('/components', {
      params: {
        query: {
          subtypeId: filter.subtypeId,
          modelId: filter.modelId,
          serialNumber: search && search.length >= 2 ? search : undefined,
          page: filter.page,
          limit: filter.limit,
        },
      },
    })
    if (error) throw error
    const content = (data?.content ?? []) as Component[]
    const total = data?.pagination?.total ?? content.length
    return {
      content,
      pagination: {
        page: data?.pagination?.page ?? filter.page,
        limit: data?.pagination?.limit ?? filter.limit,
        total,
        totalPages:
          data?.pagination?.totalPages ?? Math.ceil(total / filter.limit),
      },
    }
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
