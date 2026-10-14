import { Prisma } from '@prisma/client'
import { logger } from '@onecore/utilities'
import { property } from '@onecore/types'
import { trimStrings } from '@src/utils/data-conversion'
import { openJsonList } from '@src/utils/sql'
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

type SpaceStructureRow = {
  id: string
  structureId: string | null
  roomId: string | null
  roomCode: string | null
  roomName: string | null
  residenceId: string | null
  residenceCode: string | null
  residenceName: string | null
  rentalId: string | null
  buildingCode: string | null
  buildingName: string | null
  residenceRowId: string | null
}

type SpaceWithStructures = {
  id: string
  propertyStructures: {
    roomId: string | null
    roomCode: string | null
    roomName: string | null
    residenceId: string | null
    residenceCode: string | null
    residenceName: string | null
    rentalId: string | null
    buildingCode: string | null
    buildingName: string | null
    residence: { id: string } | null
  }[]
}

/** Same shape as `propertyObjectWithStructuresSelect`, for many spaces at once.
 * Prisma binds ids as nvarchar, which scans these char(15) keys; see sql.ts. */
const getSpacesWithStructures = async (
  spaceIds: string[]
): Promise<Map<string, SpaceWithStructures>> => {
  const spaces = new Map<string, SpaceWithStructures>()
  if (spaceIds.length === 0) return spaces

  const rows = await prisma.$queryRaw<SpaceStructureRow[]>(Prisma.sql`
    SELECT
      o.keycmobj AS id,
      b.keybabuf AS structureId,
      b.keyobjrum AS roomId,
      b.rumcode AS roomCode,
      b.rumcaption AS roomName,
      b.keyobjlgh AS residenceId,
      b.lghcode AS residenceCode,
      b.lghcaption AS residenceName,
      b.hyresid AS rentalId,
      b.bygcode AS buildingCode,
      b.bygcaption AS buildingName,
      l.keybalgh AS residenceRowId
    FROM cmobj o
    LEFT JOIN babuf b ON b.keycmobj = o.keycmobj
    LEFT JOIN balgh l ON l.keycmobj = b.keyobjlgh
    WHERE o.keycmobj IN ${openJsonList(spaceIds)}
  `)

  for (const row of rows) {
    const key = row.id.trim()
    const space = spaces.get(key) ?? { id: row.id, propertyStructures: [] }
    if (row.structureId !== null) {
      space.propertyStructures.push({
        roomId: row.roomId,
        roomCode: row.roomCode,
        roomName: row.roomName,
        residenceId: row.residenceId,
        residenceCode: row.residenceCode,
        residenceName: row.residenceName,
        rentalId: row.rentalId,
        buildingCode: row.buildingCode,
        buildingName: row.buildingName,
        residence: row.residenceRowId ? { id: row.residenceRowId } : null,
      })
    }
    spaces.set(key, space)
  }

  return spaces
}

const componentHierarchyInclude = {
  subtype: {
    include: { componentType: { include: { category: true } } },
  },
  model: true,
} as const

// ==================== COMPONENTS (INSTANCES) ====================

export const getComponents = async (
  filters: {
    modelId?: string
    withoutModel?: boolean
    notInstalled?: boolean
    subtypeId?: string
    status?: string
    serialNumber?: string
  },
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit

  const where: any = {}
  if (filters.modelId) where.modelId = filters.modelId
  if (filters.withoutModel) where.modelId = null
  if (filters.notInstalled) {
    where.componentInstallations = { none: { deinstallationDate: null } }
  }
  if (filters.subtypeId) where.subtypeId = filters.subtypeId
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
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: {
        ...componentHierarchyInclude,
        componentInstallations: {
          where: {
            deinstallationDate: null, // Only active installations
          },
          orderBy: {
            installationDate: 'desc',
          },
        },
      },
    }),
    prisma.components.count({ where }),
  ])

  const spaceIds = new Map<string, string>()
  for (const { componentInstallations } of components) {
    for (const { spaceId } of componentInstallations) {
      if (spaceId) spaceIds.set(spaceId.trim(), spaceId)
    }
  }
  const spaces = await getSpacesWithStructures([...spaceIds.values()])

  const withSpaces = components.map((component) => ({
    ...component,
    componentInstallations: component.componentInstallations.map(
      (installation) => ({
        ...installation,
        propertyObject: installation.spaceId
          ? (spaces.get(installation.spaceId.trim()) ?? null)
          : null,
      })
    ),
  }))

  return {
    components: withSpaces.map(trimStrings),
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
      ...componentHierarchyInclude,
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
      ...componentHierarchyInclude,
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
