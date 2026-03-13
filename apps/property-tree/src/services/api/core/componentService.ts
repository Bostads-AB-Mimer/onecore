import { Component } from '../../types'
import { GET, POST, PUT } from './baseApi'

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

  async createInstance(instanceData: {
    modelId: string
    serialNumber?: string | null
    warrantyStartDate?: string
    warrantyMonths: number
    priceAtPurchase: number
    depreciationPriceAtPurchase: number
    economicLifespan: number
    status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED'
    condition?: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED' | null
    quantity?: number
    ncsCode?: string
  }): Promise<Component> {
    const { data, error } = await POST('/components', {
      body: {
        modelId: instanceData.modelId,
        serialNumber: instanceData.serialNumber ?? undefined,
        warrantyStartDate: instanceData.warrantyStartDate,
        warrantyMonths: instanceData.warrantyMonths,
        priceAtPurchase: instanceData.priceAtPurchase,
        depreciationPriceAtPurchase: instanceData.depreciationPriceAtPurchase,
        economicLifespan: instanceData.economicLifespan,
        status: instanceData.status || 'ACTIVE',
        condition: instanceData.condition,
        quantity: instanceData.quantity || 1,
        ncsCode: instanceData.ncsCode || '',
      },
    })

    if (error) throw error
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
    modelId?: string,
    serialNumber?: string
  ): Promise<Component[]> {
    const queryParams: any = {
      limit: 100, // Max allowed by backend schema
    }

    if (modelId) queryParams.modelId = modelId
    if (serialNumber) queryParams.serialNumber = serialNumber

    const { data, error } = await GET('/components', {
      params: {
        query: queryParams,
      },
    })
    if (error) throw error

    const instances = (data?.content || []) as Component[]

    // Filter to only uninstalled instances (no active installations)
    return instances.filter((instance) => {
      const hasActiveInstallation = instance.componentInstallations?.some(
        (installation) => !installation.deinstallationDate
      )
      return !hasActiveInstallation
    })
  },

  async createInstanceWithInstallation(
    roomId: string,
    instanceData: {
      modelId: string
      serialNumber?: string | null
      warrantyStartDate?: string
      warrantyMonths: number
      priceAtPurchase: number
      depreciationPriceAtPurchase: number
      economicLifespan: number
      status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED'
      condition?: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED' | null
      quantity?: number
      ncsCode?: string
      installationDate: string
      installationCost: number
      orderNumber?: string
      spaceType?: 'OBJECT' | 'PropertyObject'
    }
  ): Promise<Component> {
    // 1. Create component instance
    const { data: instance, error: instanceError } = await POST('/components', {
      body: {
        modelId: instanceData.modelId,
        serialNumber: instanceData.serialNumber ?? undefined,
        warrantyStartDate: instanceData.warrantyStartDate,
        warrantyMonths: instanceData.warrantyMonths,
        priceAtPurchase: instanceData.priceAtPurchase,
        depreciationPriceAtPurchase: instanceData.depreciationPriceAtPurchase,
        economicLifespan: instanceData.economicLifespan,
        status: instanceData.status || 'ACTIVE',
        condition: instanceData.condition,
        quantity: instanceData.quantity || 1,
        ncsCode: instanceData.ncsCode || '',
      },
    })

    if (instanceError) throw instanceError
    if (!instance?.content)
      throw new Error('Failed to create component instance')

    const createdInstance = instance.content as Component

    // 2. Create installation record
    const { error: installError } = await POST('/component-installations', {
      body: {
        componentId: createdInstance.id,
        spaceId: roomId,
        spaceType: instanceData.spaceType ?? 'OBJECT',
        installationDate: instanceData.installationDate,
        cost: instanceData.installationCost,
        orderNumber: instanceData.orderNumber,
      },
    })

    if (installError) {
      // Installation failed, but instance was created
      // In a production system, we might want to rollback or mark as uninstalled
      throw installError
    }

    return createdInstance
  },

  async deinstallComponent(
    installationId: string,
    deinstallationDate: string
  ): Promise<void> {
    const { error } = await PUT('/component-installations/{id}', {
      params: {
        path: { id: installationId },
      },
      body: {
        deinstallationDate,
      },
    })

    if (error) throw error
  },

  async installExistingInstance(
    instanceId: string,
    roomId: string,
    installationData: {
      installationDate: string
      installationCost: number
      orderNumber?: string
      spaceType?: 'OBJECT' | 'PropertyObject'
    }
  ): Promise<void> {
    const { error } = await POST('/component-installations', {
      body: {
        componentId: instanceId,
        spaceId: roomId,
        spaceType: installationData.spaceType ?? 'OBJECT',
        installationDate: installationData.installationDate,
        cost: installationData.installationCost,
        orderNumber: installationData.orderNumber,
      },
    })

    if (error) throw error
  },

  async updateInstance(
    instanceId: string,
    data: Partial<{
      warrantyMonths: number
      warrantyStartDate?: string
      serialNumber?: string | null
      priceAtPurchase: number
      depreciationPriceAtPurchase: number
      economicLifespan: number
      status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED'
      condition: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED' | null
      quantity: number
      ncsCode?: string
    }>
  ): Promise<Component> {
    const { data: response, error } = await PUT('/components/{id}', {
      params: { path: { id: instanceId } },
      body: {
        ...data,
        serialNumber: data.serialNumber ?? undefined,
      },
    })

    if (error) throw error
    if (!response?.content)
      throw new Error('Failed to update component instance')

    return response.content as Component
  },
}
