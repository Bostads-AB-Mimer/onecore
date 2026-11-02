import { Prisma } from '@prisma/client'
import { logger } from '@onecore/utilities'
import { property } from '@onecore/types'
import { trimStrings } from '@src/utils/data-conversion'
import { openJsonList } from '@src/utils/sql'
import { prisma } from './db'
import {
  componentCountSql,
  componentPageSql,
  type ComponentListFilters,
  type ComponentListSort,
} from './component-list-query'
import type { CreateComponent, UpdateComponent } from '../types/component'

type PropertyStructure = {
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
}

type SpaceWithStructures = {
  id: string
  propertyStructures: PropertyStructure[]
}

type SpaceRow = Omit<PropertyStructure, 'residence'> & {
  id: string
  structureId: string | null
  residenceRowId: string | null
}

// SQL Server compares these keys case-insensitively; the Map must too.
const spaceKey = (id: string) => id.trim().toUpperCase()

const getSpacesWithStructures = async (
  spaceIds: string[]
): Promise<Map<string, SpaceWithStructures>> => {
  const spaces = new Map<string, SpaceWithStructures>()
  if (spaceIds.length === 0) return spaces

  try {
    const rows = await prisma.$queryRaw<SpaceRow[]>(Prisma.sql`
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
      FROM dbo.cmobj o
      OUTER APPLY (
        SELECT TOP 1
          keybabuf, keyobjrum, rumcode, rumcaption, keyobjlgh, lghcode,
          lghcaption, hyresid, bygcode, bygcaption
        FROM dbo.babuf
        WHERE keycmobj = o.keycmobj
        ORDER BY deletemark, keybabuf
      ) b
      LEFT JOIN dbo.balgh l ON l.keycmobj = b.keyobjlgh
      WHERE o.keycmobj IN ${openJsonList(spaceIds)}
    `)

    for (const { id, structureId, residenceRowId, ...structure } of trimStrings(
      rows
    )) {
      spaces.set(spaceKey(id), {
        id,
        propertyStructures:
          structureId === null
            ? []
            : [
                {
                  ...structure,
                  residence: residenceRowId ? { id: residenceRowId } : null,
                },
              ],
      })
    }

    return spaces
  } catch (err) {
    logger.error({ err }, 'component-instance-adapter.getSpacesWithStructures')
    throw err
  }
}

/** Trims the components and gives each installation its `propertyObject`. */
const attachSpaces = async <
  C extends { componentInstallations: { spaceId: string | null }[] },
>(
  components: C[]
) => {
  const trimmed = components.map(trimStrings)
  const spaceIds = new Set<string>()
  for (const { componentInstallations } of trimmed) {
    for (const { spaceId } of componentInstallations) {
      if (spaceId) spaceIds.add(spaceId)
    }
  }
  const spaces = await getSpacesWithStructures([...spaceIds])

  return trimmed.map((component) => ({
    ...component,
    componentInstallations: component.componentInstallations.map(
      (installation) => ({
        ...installation,
        propertyObject: installation.spaceId
          ? (spaces.get(spaceKey(installation.spaceId)) ?? null)
          : null,
      })
    ),
  }))
}

const componentHierarchyInclude = {
  subtype: {
    include: { componentType: { include: { category: true } } },
  },
  model: true,
} as const

// ==================== COMPONENTS (INSTANCES) ====================

/** Loads the components with these ids, in the order of the ids. */
const getComponentsInOrder = async (ids: string[]) => {
  if (ids.length === 0) return []

  const components = await prisma.components.findMany({
    where: { id: { in: ids } },
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
  })

  const position = new Map(ids.map((id, index) => [id.toLowerCase(), index]))
  return components.sort(
    (a, b) =>
      (position.get(a.id.toLowerCase()) ?? 0) -
      (position.get(b.id.toLowerCase()) ?? 0)
  )
}

export const getComponents = async (
  filters: ComponentListFilters,
  page: number = 1,
  limit: number = 20,
  sort?: ComponentListSort
) => {
  const skip = (page - 1) * limit

  const [components, total] = await Promise.all([
    prisma
      .$queryRaw<{ id: string }[]>(componentPageSql(filters, sort, skip, limit))
      .then((rows) => getComponentsInOrder(rows.map(({ id }) => id)))
      .then(attachSpaces),
    prisma
      .$queryRaw<{ total: number }[]>(componentCountSql(filters))
      .then(([row]) => Number(row?.total ?? 0)),
  ])

  return {
    components,
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
      componentInstallations: true,
    },
  })
  if (!component) return null

  const [withSpaces] = await attachSpaces([component])
  return withSpaces
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
  let installed: { componentId: string }[]
  try {
    installed = await prisma.$queryRaw<{ componentId: string }[]>(Prisma.sql`
      SELECT componentId
      FROM dbo.component_installations
      WHERE spaceId = CAST(${roomId} AS CHAR(15))
        AND deinstallationDate IS NULL
    `)
  } catch (err) {
    logger.error({ err }, 'component-instance-adapter.getComponentsByRoomId')
    throw err
  }
  if (installed.length === 0) return []

  // A component has at most one active installation (UX_component_installations_active).
  const components = await prisma.components.findMany({
    where: { id: { in: installed.map(({ componentId }) => componentId) } },
    include: {
      ...componentHierarchyInclude,
      componentInstallations: { where: { deinstallationDate: null } },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return attachSpaces(components)
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
