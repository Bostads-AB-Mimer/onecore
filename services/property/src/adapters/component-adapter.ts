import { trimStrings } from '@src/utils/data-conversion'
import { prisma } from './db'
import { getBulkFileMetadata } from './minio-adapter'
import type {
  CreateComponentType,
  UpdateComponentType,
  CreateComponentSubtype,
  UpdateComponentSubtype,
  CreateComponentModel,
  UpdateComponentModel,
  CreateComponentNew,
  UpdateComponentNew,
  CreateComponentInstallation,
  UpdateComponentInstallation,
  ComponentModelDocument,
  ComponentFile,
} from '../types/component'

// ==================== COMPONENT TYPES ====================

export const getComponentTypes = async (
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit

  const [types, total] = await Promise.all([
    prisma.componentTypes.findMany({
      skip,
      take: limit,
      orderBy: { description: 'asc' },
    }),
    prisma.componentTypes.count(),
  ])

  return {
    types: types.map(trimStrings),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export const getComponentTypeById = async (id: string) => {
  const type = await prisma.componentTypes.findUnique({
    where: { id },
    include: {
      componentSubtypes: true,
      componentModels: true,
    },
  })

  return type ? trimStrings(type) : null
}

export const createComponentType = async (data: CreateComponentType) => {
  const type = await prisma.componentTypes.create({
    data,
  })

  return trimStrings(type)
}

export const updateComponentType = async (
  id: string,
  data: UpdateComponentType
) => {
  const type = await prisma.componentTypes.update({
    where: { id },
    data,
  })

  return trimStrings(type)
}

export const deleteComponentType = async (id: string) => {
  await prisma.componentTypes.delete({
    where: { id },
  })
}

// ==================== COMPONENT SUBTYPES ====================

export const getComponentSubtypes = async (
  componentTypeId?: string,
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit

  const where = componentTypeId ? { componentTypeId } : {}

  const [subtypes, total] = await Promise.all([
    prisma.componentSubtypes.findMany({
      where,
      skip,
      take: limit,
      orderBy: { description: 'asc' },
      include: {
        componentType: true,
      },
    }),
    prisma.componentSubtypes.count({ where }),
  ])

  return {
    subtypes: subtypes.map(trimStrings),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export const getComponentSubtypeById = async (id: string) => {
  const subtype = await prisma.componentSubtypes.findUnique({
    where: { id },
    include: {
      componentType: true,
      componentModels: true,
    },
  })

  return subtype ? trimStrings(subtype) : null
}

export const createComponentSubtype = async (data: CreateComponentSubtype) => {
  const subtype = await prisma.componentSubtypes.create({
    data,
  })

  return trimStrings(subtype)
}

export const updateComponentSubtype = async (
  id: string,
  data: UpdateComponentSubtype
) => {
  const subtype = await prisma.componentSubtypes.update({
    where: { id },
    data,
  })

  return trimStrings(subtype)
}

export const deleteComponentSubtype = async (id: string) => {
  await prisma.componentSubtypes.delete({
    where: { id },
  })
}

// ==================== COMPONENT MODELS ====================

export const getComponentModels = async (
  filters: {
    componentTypeId?: string
    subtypeId?: string
    manufacturer?: string
  },
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit

  const where: any = {}
  if (filters.componentTypeId) where.componentTypeId = filters.componentTypeId
  if (filters.subtypeId) where.subtypeId = filters.subtypeId
  if (filters.manufacturer) {
    where.manufacturer = { contains: filters.manufacturer }
  }

  const [models, total] = await Promise.all([
    prisma.componentModels.findMany({
      where,
      skip,
      take: limit,
      orderBy: { manufacturer: 'asc' },
      include: {
        componentType: true,
        subtype: true,
      },
    }),
    prisma.componentModels.count({ where }),
  ])

  return {
    models: models.map(trimStrings),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export const getComponentModelById = async (id: string) => {
  const model = await prisma.componentModels.findUnique({
    where: { id },
    include: {
      componentType: true,
      subtype: true,
      components: true,
    },
  })

  return model ? trimStrings(model) : null
}

export const createComponentModel = async (data: CreateComponentModel) => {
  const model = await prisma.componentModels.create({
    data,
  })

  return trimStrings(model)
}

export const updateComponentModel = async (
  id: string,
  data: UpdateComponentModel
) => {
  const model = await prisma.componentModels.update({
    where: { id },
    data,
  })

  return trimStrings(model)
}

export const deleteComponentModel = async (id: string) => {
  await prisma.componentModels.delete({
    where: { id },
  })
}

// ==================== COMPONENTS ====================

export const getComponents = async (
  filters: {
    modelId?: string
    status?: string
  },
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit

  const where: any = {}
  if (filters.modelId) where.modelId = filters.modelId
  if (filters.status) where.status = filters.status

  const [components, total] = await Promise.all([
    prisma.components.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        model: {
          include: {
            componentType: true,
            subtype: true,
          },
        },
      },
    }),
    prisma.components.count({ where }),
  ])

  return {
    components: components.map(trimStrings),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export const getComponentById = async (id: string) => {
  const component = await prisma.components.findUnique({
    where: { id },
    include: {
      model: {
        include: {
          componentType: true,
          subtype: true,
        },
      },
      componentInstallations: true,
    },
  })

  return component ? trimStrings(component) : null
}

export const createComponent = async (data: CreateComponentNew) => {
  const component = await prisma.components.create({
    data,
  })

  return trimStrings(component)
}

export const updateComponent = async (id: string, data: UpdateComponentNew) => {
  const component = await prisma.components.update({
    where: { id },
    data,
  })

  return trimStrings(component)
}

export const deleteComponent = async (id: string) => {
  await prisma.components.delete({
    where: { id },
  })
}

// ==================== COMPONENT INSTALLATIONS ====================

export const getComponentInstallations = async (
  filters: {
    componentId?: string
    spaceId?: string
    buildingPartId?: string
  },
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit

  const where: any = {}
  if (filters.componentId) where.componentId = filters.componentId
  if (filters.spaceId) where.spaceId = filters.spaceId
  if (filters.buildingPartId) where.buildingPartId = filters.buildingPartId

  const [installations, total] = await Promise.all([
    prisma.componentInstallations.findMany({
      where,
      skip,
      take: limit,
      orderBy: { installationDate: 'desc' },
      include: {
        component: {
          include: {
            model: {
              include: {
                componentType: true,
                subtype: true,
              },
            },
          },
        },
      },
    }),
    prisma.componentInstallations.count({ where }),
  ])

  return {
    installations: installations.map(trimStrings),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export const getComponentInstallationById = async (id: string) => {
  const installation = await prisma.componentInstallations.findUnique({
    where: { id },
    include: {
      component: {
        include: {
          model: {
            include: {
              componentType: true,
              subtype: true,
            },
          },
        },
      },
    },
  })

  return installation ? trimStrings(installation) : null
}

export const createComponentInstallation = async (
  data: CreateComponentInstallation
) => {
  const installation = await prisma.componentInstallations.create({
    data,
  })

  return trimStrings(installation)
}

export const updateComponentInstallation = async (
  id: string,
  data: UpdateComponentInstallation
) => {
  const installation = await prisma.componentInstallations.update({
    where: { id },
    data,
  })

  return trimStrings(installation)
}

export const deleteComponentInstallation = async (id: string) => {
  await prisma.componentInstallations.delete({
    where: { id },
  })
}

// ==================== COMPONENTS BY ROOM ====================

export const getComponentsByRoomId = async (roomId: string) => {
  const components = await prisma.components.findMany({
    where: {
      componentInstallations: {
        some: {
          spaceId: roomId,
          deinstallationDate: null, // Only currently installed components
        },
      },
    },
    include: {
      model: {
        include: {
          componentType: true,
          subtype: true,
        },
      },
      componentInstallations: {
        where: {
          spaceId: roomId,
          deinstallationDate: null,
        },
        take: 1,
        orderBy: {
          installationDate: 'desc',
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return components.map(trimStrings)
}

// ==================== COMPONENT MODEL DOCUMENTS ====================

export const getComponentModelDocuments = async (
  modelId: string
): Promise<ComponentModelDocument[]> => {
  const model = await prisma.componentModels.findUnique({
    where: { id: modelId },
    select: { documents: true },
  })

  if (!model?.documents) {
    return []
  }

  const fileIds: string[] = JSON.parse(model.documents)

  if (fileIds.length === 0) {
    return []
  }

  // Fetch metadata from MinIO
  const metadataMap = await getBulkFileMetadata(fileIds)

  // Combine fileId with MinIO metadata
  return fileIds.map((fileId) => {
    const metadata = metadataMap.get(fileId)
    if (!metadata) {
      throw new Error(`Metadata not found for fileId: ${fileId}`)
    }
    return {
      fileId,
      originalName: metadata.originalName,
      size: metadata.size,
      mimeType: metadata.mimeType,
      uploadedAt: new Date().toISOString(),
    }
  })
}

export const addComponentModelDocument = async (
  modelId: string,
  fileId: string
): Promise<void> => {
  const model = await prisma.componentModels.findUnique({
    where: { id: modelId },
    select: { documents: true },
  })

  const currentFileIds: string[] = model?.documents
    ? JSON.parse(model.documents)
    : []

  const updatedFileIds = [...currentFileIds, fileId]

  await prisma.componentModels.update({
    where: { id: modelId },
    data: {
      documents: JSON.stringify(updatedFileIds),
    },
  })
}

export const removeComponentModelDocument = async (
  modelId: string,
  fileId: string
): Promise<void> => {
  const model = await prisma.componentModels.findUnique({
    where: { id: modelId },
    select: { documents: true },
  })

  if (!model?.documents) {
    return
  }

  const currentFileIds: string[] = JSON.parse(model.documents)
  const filteredFileIds = currentFileIds.filter((id) => id !== fileId)

  await prisma.componentModels.update({
    where: { id: modelId },
    data: {
      documents: JSON.stringify(filteredFileIds),
    },
  })
}

// ==================== COMPONENT FILES ====================

export const getComponentFiles = async (
  componentId: string
): Promise<ComponentFile[]> => {
  const component = await prisma.components.findUnique({
    where: { id: componentId },
    select: { files: true },
  })

  if (!component?.files) {
    return []
  }

  const fileIds: string[] = JSON.parse(component.files)

  if (fileIds.length === 0) {
    return []
  }

  // Fetch metadata from MinIO
  const metadataMap = await getBulkFileMetadata(fileIds)

  // Combine fileId with MinIO metadata
  return fileIds.map((fileId) => {
    const metadata = metadataMap.get(fileId)
    if (!metadata) {
      throw new Error(`Metadata not found for fileId: ${fileId}`)
    }
    return {
      fileId,
      originalName: metadata.originalName,
      size: metadata.size,
      mimeType: metadata.mimeType,
      uploadedAt: new Date().toISOString(),
    }
  })
}

export const addComponentFile = async (
  componentId: string,
  fileId: string
): Promise<void> => {
  const component = await prisma.components.findUnique({
    where: { id: componentId },
    select: { files: true },
  })

  const currentFileIds: string[] = component?.files
    ? JSON.parse(component.files)
    : []

  const updatedFileIds = [...currentFileIds, fileId]

  await prisma.components.update({
    where: { id: componentId },
    data: {
      files: JSON.stringify(updatedFileIds),
    },
  })
}

export const removeComponentFile = async (
  componentId: string,
  fileId: string
): Promise<void> => {
  const component = await prisma.components.findUnique({
    where: { id: componentId },
    select: { files: true },
  })

  if (!component?.files) {
    return
  }

  const currentFileIds: string[] = JSON.parse(component.files)
  const filteredFileIds = currentFileIds.filter((id) => id !== fileId)

  await prisma.components.update({
    where: { id: componentId },
    data: {
      files: JSON.stringify(filteredFileIds),
    },
  })
}
