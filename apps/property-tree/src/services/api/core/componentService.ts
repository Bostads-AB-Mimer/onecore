import { Component, ComponentSubtype } from '../../types'
import { GET, POST, PUT, toApiError } from './baseApi'
import type { components } from './generated/api-types'

type ComponentInput = Omit<
  components['schemas']['CreateComponentRequest'],
  'files'
>

export const toComponentBody = (input: ComponentInput) => ({
  subtypeId: input.subtypeId,
  modelId: input.modelId ?? null,
  serialNumber: input.serialNumber ?? undefined,
  warrantyStartDate: input.warrantyStartDate,
  warrantyMonths: input.warrantyMonths ?? null,
  priceAtPurchase: input.priceAtPurchase ?? null,
  depreciationPriceAtPurchase: input.depreciationPriceAtPurchase ?? null,
  economicLifespan: input.economicLifespan ?? null,
  status: input.status ?? 'ACTIVE',
  condition: input.condition,
  quantity: input.quantity ?? 1,
  ncsCode: input.ncsCode || null,
  specifications: input.specifications,
  additionalInformation: input.additionalInformation,
})

export const componentService = {
  async getByRoomId(roomId: string): Promise<Component[]> {
    const { data, error } = await GET('/components/by-room/{roomId}', {
      params: {
        path: {
          roomId,
        },
      },
    })
    if (error) throw error
    // Type assertion needed - API response schema differs from database schema
    return (data?.content || []) as Component[]
  },

  async createInstance(instanceData: ComponentInput): Promise<Component> {
    const { data, error, response } = await POST('/components', {
      body: toComponentBody(instanceData),
    })

    if (error) throw toApiError(error, response)
    if (!data?.content) throw new Error('Failed to create component instance')

    return data.content as Component
  },

  async getInstancesByModel(modelId: string): Promise<Component[]> {
    const { data, error } = await GET('/components', {
      params: {
        query: {
          modelId,
          limit: 100, // Max allowed by backend schema
        } as any,
      },
    })
    if (error) throw error
    return (data?.content || []) as Component[]
  },

  async getUninstalledInstances(
    subtypeId: string,
    serialNumber?: string
  ): Promise<{ content: Component[]; total: number }> {
    const { data, error } = await GET('/components', {
      params: {
        query: {
          subtypeId,
          notInstalled: true,
          serialNumber: serialNumber || undefined,
          limit: 100, // Max allowed by backend schema
        },
      },
    })
    if (error) throw error

    const content = (data?.content || []) as Component[]
    return {
      content,
      total: data?.pagination?.total ?? content.length,
    }
  },

  async createInstanceWithInstallation(
    roomId: string,
    instanceData: ComponentInput & {
      installationDate: string | null
      installationCost: number
      orderNumber?: string
      spaceType?: 'OBJECT' | 'PropertyObject'
    }
  ): Promise<Component> {
    // 1. Create component instance
    const {
      data: instance,
      error: instanceError,
      response: instanceResponse,
    } = await POST('/components', {
      body: toComponentBody(instanceData),
    })

    if (instanceError) throw toApiError(instanceError, instanceResponse)
    if (!instance?.content)
      throw new Error('Failed to create component instance')

    const createdInstance = instance.content as Component

    // 2. Create installation record
    const { error: installError, response: installResponse } = await POST(
      '/component-installations',
      {
        body: {
          componentId: createdInstance.id,
          spaceId: roomId,
          spaceType: instanceData.spaceType ?? 'OBJECT',
          installationDate: instanceData.installationDate,
          cost: instanceData.installationCost,
          orderNumber: instanceData.orderNumber,
        },
      }
    )

    if (installError) {
      // Installation failed, but instance was created
      // In a production system, we might want to rollback or mark as uninstalled
      throw toApiError(installError, installResponse)
    }

    return createdInstance
  },

  async deinstallComponent(
    installationId: string,
    deinstallationDate: string
  ): Promise<void> {
    const { error, response } = await PUT('/component-installations/{id}', {
      params: {
        path: { id: installationId },
      },
      body: {
        deinstallationDate,
      },
    })

    if (error) throw toApiError(error, response)
  },

  async installExistingInstance(
    instanceId: string,
    roomId: string,
    installationData: {
      installationDate: string | null
      installationCost: number
      orderNumber?: string
      spaceType?: 'OBJECT' | 'PropertyObject'
    }
  ): Promise<void> {
    const { error, response } = await POST('/component-installations', {
      body: {
        componentId: instanceId,
        spaceId: roomId,
        spaceType: installationData.spaceType ?? 'OBJECT',
        installationDate: installationData.installationDate,
        cost: installationData.installationCost,
        orderNumber: installationData.orderNumber,
      },
    })

    if (error) throw toApiError(error, response)
  },

  async updateInstance(
    instanceId: string,
    data: Partial<{
      modelId?: string | null
      warrantyMonths: number | null
      warrantyStartDate?: string
      serialNumber?: string | null
      priceAtPurchase: number | null
      depreciationPriceAtPurchase: number | null
      economicLifespan: number | null
      status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED'
      condition: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED' | null
      quantity: number
      ncsCode?: string | null
    }>
  ): Promise<Component> {
    const {
      data: updated,
      error,
      response,
    } = await PUT('/components/{id}', {
      params: { path: { id: instanceId } },
      body: {
        ...data,
        serialNumber: data.serialNumber ?? undefined,
      },
    })

    if (error) throw toApiError(error, response)
    if (!updated?.content)
      throw new Error('Failed to update component instance')

    return updated.content as Component
  },

  async getSurfaceSubtypes(): Promise<ComponentSubtype[]> {
    const subtypes: ComponentSubtype[] = []
    for (let page = 1; ; page++) {
      const { data, error } = await GET('/component-subtypes', {
        params: { query: { categoryType: 'SURFACE', page, limit: 100 } },
      })
      if (error) throw error
      subtypes.push(...(data?.content ?? []))
      if (page >= (data?.pagination?.totalPages ?? 1)) return subtypes
    }
  },
}
