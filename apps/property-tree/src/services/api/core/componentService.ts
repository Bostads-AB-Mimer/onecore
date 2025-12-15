import {
  ComponentInstance,
  ComponentImage,
  ComponentModelDocument,
} from '../../types'
import { GET, POST, PUT, DELETE } from './base-api'

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
    return (data?.content || []) as ComponentInstance[]
  },

  async createInstance(instanceData: {
    modelId: string
    serialNumber: string
    warrantyStartDate?: string
    warrantyMonths: number
    priceAtPurchase: number
    depreciationPriceAtPurchase: number
    economicLifespan: number
    status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED'
    quantity?: number
    ncsCode?: string
  }): Promise<ComponentInstance> {
    const { data, error } = await POST('/components', {
      body: {
        modelId: instanceData.modelId,
        serialNumber: instanceData.serialNumber,
        warrantyStartDate: instanceData.warrantyStartDate,
        warrantyMonths: instanceData.warrantyMonths,
        priceAtPurchase: instanceData.priceAtPurchase,
        depreciationPriceAtPurchase: instanceData.depreciationPriceAtPurchase,
        economicLifespan: instanceData.economicLifespan,
        status: instanceData.status || 'ACTIVE',
        quantity: instanceData.quantity || 1,
        ncsCode: instanceData.ncsCode,
      },
    })

    if (error) throw error
    if (!data?.content) throw new Error('Failed to create component instance')

    return data.content as ComponentInstance
  },

  async getInstancesByModel(modelId: string): Promise<ComponentInstance[]> {
    const { data, error } = await GET('/components', {
      params: {
        query: {
          modelId,
          limit: 100, // Max allowed by backend schema
        } as any,
      },
    })
    if (error) throw error
    return (data?.content || []) as ComponentInstance[]
  },

  async getUninstalledInstances(
    modelId?: string,
    serialNumber?: string
  ): Promise<ComponentInstance[]> {
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

    const instances = (data?.content || []) as ComponentInstance[]

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
      serialNumber: string
      warrantyStartDate?: string
      warrantyMonths: number
      priceAtPurchase: number
      depreciationPriceAtPurchase: number
      economicLifespan: number
      status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED'
      quantity?: number
      ncsCode?: string
      installationDate: string
      installationCost: number
      orderNumber?: string
    }
  ): Promise<ComponentInstance> {
    // 1. Create component instance
    const { data: instance, error: instanceError } = await POST('/components', {
      body: {
        modelId: instanceData.modelId,
        serialNumber: instanceData.serialNumber,
        warrantyStartDate: instanceData.warrantyStartDate,
        warrantyMonths: instanceData.warrantyMonths,
        priceAtPurchase: instanceData.priceAtPurchase,
        depreciationPriceAtPurchase: instanceData.depreciationPriceAtPurchase,
        economicLifespan: instanceData.economicLifespan,
        status: instanceData.status || 'ACTIVE',
        quantity: instanceData.quantity || 1,
        ncsCode: instanceData.ncsCode,
      },
    })

    if (instanceError) throw instanceError
    if (!instance?.content) throw new Error('Failed to create component instance')

    const createdInstance = instance.content as ComponentInstance

    // 2. Create installation record
    const { error: installError } = await POST('/component-installations', {
      body: {
        componentId: createdInstance.id,
        spaceId: roomId,
        spaceType: 'OBJECT',
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
    }
  ): Promise<void> {
    const { error } = await POST('/component-installations', {
      body: {
        componentId: instanceId,
        spaceId: roomId,
        spaceType: 'OBJECT',
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
      serialNumber: string
      priceAtPurchase: number
      depreciationPriceAtPurchase: number
      economicLifespan: number
      status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED'
      quantity: number
      ncsCode?: string
    }>
  ): Promise<ComponentInstance> {
    const { data: response, error } = await PUT('/components/{id}', {
      params: { path: { id: instanceId } },
      body: data,
    })

    if (error) throw error
    if (!response?.content) throw new Error('Failed to update component instance')

    return response.content as ComponentInstance
  },

  // Component Instance Image Operations
  async uploadImage(
    componentId: string,
    file: File,
    caption?: string
  ): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('componentInstanceId', componentId)
    if (caption) formData.append('caption', caption)

    const { error } = await POST('/documents/upload', {
      body: formData as any,
      bodySerializer: (body) => body as any,
    })

    if (error) throw error
  },

  async getImages(componentId: string): Promise<ComponentImage[]> {
    console.log(
      '[componentService.getImages] Fetching images for:',
      componentId
    )
    const { data, error } = await GET('/documents/component-instances/{id}', {
      params: {
        path: { id: componentId },
      },
    })

    if (error) throw error

    const images = data || []
    console.log(
      '[componentService.getImages] Returning:',
      images.length,
      'images'
    )
    return images
  },

  async deleteImage(componentId: string, documentId: string): Promise<void> {
    const { error } = await DELETE('/documents/{documentId}', {
      params: {
        path: { documentId },
      },
    })

    if (error) throw error
  },

  // Component Model Document Operations
  async uploadModelDocument(modelId: string, file: File): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('componentModelId', modelId)

    const { error } = await POST('/documents/upload', {
      body: formData as any,
      bodySerializer: (body) => body as any,
    })

    if (error) throw error
  },

  async getModelDocuments(modelId: string): Promise<ComponentModelDocument[]> {
    const { data, error } = await GET('/documents/component-models/{id}', {
      params: {
        path: { id: modelId },
      },
    })

    if (error) throw error

    return data || []
  },

  async deleteModelDocument(modelId: string, documentId: string): Promise<void> {
    const { error } = await DELETE('/documents/{documentId}', {
      params: {
        path: { documentId },
      },
    })

    if (error) throw error
  },
}
