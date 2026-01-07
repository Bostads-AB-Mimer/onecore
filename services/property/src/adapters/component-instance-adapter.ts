import { trimStrings } from '@src/utils/data-conversion'
import { prisma } from './db'
import { getFileMetadataFromMinio } from './minio-adapter'
import type { CreateComponentNew, UpdateComponentNew } from '../types/component'

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
              select: {
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
              },
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
            select: {
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
            },
          },
        },
      },
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
            select: {
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
            },
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

export const getComponentInstanceWithDocuments = async (
  componentId: string
) => {
  return prisma.components.findUnique({
    where: { id: componentId },
    include: { documents: true },
  })
}

export const getComponentInstanceFiles = async (componentId: string) => {
  const documents = await prisma.documents.findMany({
    where: { componentInstanceId: componentId },
    orderBy: { createdAt: 'desc' },
  })

  return Promise.all(
    documents.map(async (doc) => {
      const metadata = await getFileMetadataFromMinio(doc.fileId)
      return {
        id: doc.id,
        fileId: doc.fileId,
        originalName: metadata.originalName,
        size: metadata.size,
        mimeType: metadata.mimeType,
        uploadedAt: doc.createdAt.toISOString(),
      }
    })
  )
}
