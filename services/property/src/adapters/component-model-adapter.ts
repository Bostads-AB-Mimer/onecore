import { trimStrings } from '@src/utils/data-conversion'
import { prisma } from './db'
import { getBulkFileMetadata } from './minio-adapter'
import type {
  CreateComponentModel,
  UpdateComponentModel,
} from '../types/component'

// File metadata types
type ComponentModelDocument = {
  fileId: string
  originalName: string
  size: number
  mimeType: string
  uploadedAt: string
}

// ==================== COMPONENT MODELS ====================

export const getComponentModels = async (
  filters: {
    componentTypeId?: string
    subtypeId?: string
    manufacturer?: string
    modelName?: string  // Search field
  },
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit

  const where: any = {}
  if (filters.subtypeId && filters.subtypeId.length > 0)
    where.componentSubtypeId = filters.subtypeId

  // Only apply standalone manufacturer filter when NOT using search
  if (filters.manufacturer && !filters.modelName) {
    where.manufacturer = { contains: filters.manufacturer }
  }

  // Case-insensitive search across modelName and manufacturer
  if (filters.modelName && filters.modelName.trim().length >= 2) {
    const trimmedSearch = filters.modelName.trim()
    where.OR = [
      { modelName: { contains: trimmedSearch } },
      { manufacturer: { contains: trimmedSearch } },
    ]
  }

  const [models, total] = await Promise.all([
    prisma.componentModels.findMany({
      where,
      skip,
      take: limit,
      orderBy: { modelName: 'asc' },
      include: {
        subtype: {
          include: {
            componentType: {
              include: {
                category: true,
              },
            },
          },
        },
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

// ==================== COMPONENT MODEL DOCUMENTS ====================

export const getComponentModelWithDocuments = async (modelId: string) => {
  return prisma.componentModels.findUnique({
    where: { id: modelId },
    include: { documents: true }
  })
}
