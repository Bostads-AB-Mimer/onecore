import { logger } from '@onecore/utilities'
import { property } from '@onecore/types'
import { trimStrings } from '@src/utils/data-conversion'
import { prisma } from './db'
import type { CreateComponent, UpdateComponent } from '../types/component'

// Reusable Prisma select for propertyObject with room/residence structure info
const propertyObjectWithStructuresSelect = {
  id: true,
  propertyStructures: {
    select: {
      roomId: true,
      roomCode: true,
      roomName: true,
      residenceId: true,
      residenceCode: true,
      residenceName: true,
      rentalId: true,
      buildingCode: true,
      buildingName: true,
      residence: {
        select: {
          id: true,
        },
      },
    },
  },
} as const

// ==================== COMPONENTS (INSTANCES) ====================

export const getComponents = async (
  filters: {
    modelId?: string
    status?: string
    serialNumber?: string
  },
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit

  const where: any = {}
  if (filters.modelId) where.modelId = filters.modelId
  if (filters.status) where.status = filters.status

  // Only apply search with minimum 2 characters (consistent with model search)
  if (filters.serialNumber && filters.serialNumber.trim().length >= 2) {
    where.serialNumber = {
      contains: filters.serialNumber.trim(),
      // mode: 'insensitive' removed - SQL Server uses case-insensitive collation by default
    }
  }

  const [components, total] = await Promise.all([
    prisma.components.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        model: {
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
        },
        componentInstallations: {
          where: {
            deinstallationDate: null, // Only active installations
          },
          orderBy: {
            installationDate: 'desc',
          },
          include: {
            propertyObject: {
              select: propertyObjectWithStructuresSelect,
            },
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
          subtype: true,
        },
      },
      componentInstallations: {
        include: {
          propertyObject: {
            select: propertyObjectWithStructuresSelect,
          },
        },
      },
    },
  })

  return component ? trimStrings(component) : null
}

export const createComponent = async (data: CreateComponent) => {
  const component = await prisma.components.create({
    data,
  })

  return trimStrings(component)
}

export const updateComponent = async (id: string, data: UpdateComponent) => {
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

export type ComponentModelProblem =
  | 'subtype_not_found'
  | 'model_not_found'
  | 'model_subtype_mismatch'
  | 'surface_has_model'

export const findComponentModelProblem = async (params: {
  subtypeId: string
  modelId: string | null | undefined
}): Promise<ComponentModelProblem | null> => {
  const subtype = await prisma.componentSubtypes.findUnique({
    where: { id: params.subtypeId },
    select: {
      id: true,
      componentType: { select: { category: { select: { type: true } } } },
    },
  })
  if (!subtype) return 'subtype_not_found'
  if (!params.modelId) return null

  const isSurface =
    subtype.componentType.category.type ===
    property.ComponentCategoryTypeSchema.enum.SURFACE
  if (isSurface) return 'surface_has_model'

  const model = await prisma.componentModels.findUnique({
    where: { id: params.modelId },
    select: { id: true, componentSubtypeId: true },
  })
  if (!model) return 'model_not_found'
  if (model.componentSubtypeId !== params.subtypeId) {
    return 'model_subtype_mismatch'
  }
  return null
}

export const updateComponentInspectionState = async (
  id: string,
  data: { condition: string; lastInspectionDate: string }
) => {
  try {
    const component = await prisma.components.update({
      where: { id },
      data: {
        condition: data.condition,
        lastInspectionDate: new Date(data.lastInspectionDate),
      },
    })
    return trimStrings(component)
  } catch (err) {
    logger.error(
      { err },
      'component-instance-adapter.updateComponentInspectionState'
    )
    throw err
  }
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
        include: {
          propertyObject: {
            select: propertyObjectWithStructuresSelect,
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return components.map(trimStrings)
}

// ==================== COMPONENT FILES ====================

export const getComponentWithDocuments = async (componentId: string) => {
  return prisma.components.findUnique({
    where: { id: componentId },
    include: { documents: true },
  })
}

export const getComponentFiles = async (componentId: string) => {
  return prisma.documents.findMany({
    where: { componentInstanceId: componentId },
    orderBy: { createdAt: 'desc' },
  })
}
