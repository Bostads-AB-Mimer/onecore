import type { Prisma } from '@prisma/client'
import { trimStrings } from '@src/utils/data-conversion'
import { property } from '@onecore/types'
import { prisma } from './db'
import { serializable } from './transaction'
import type {
  CreateComponentModel,
  UpdateComponentModel,
} from '../types/component'

export const getComponentModels = async (
  filters: {
    componentTypeId?: string
    subtypeId?: string
    manufacturer?: string
    modelName?: string // Search field
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

/**
 * Find a component model by exact model name match (case-insensitive).
 * Used by the add-component process to check if a model already exists.
 * Scoped to a subtype when `subtypeId` is given.
 */
export const findModelByExactName = async (
  modelName: string,
  subtypeId?: string
) => {
  const model = await prisma.componentModels.findFirst({
    where: {
      modelName: {
        equals: modelName,
      },
      ...(subtypeId ? { componentSubtypeId: subtypeId } : {}),
    },
    orderBy: { createdAt: 'asc' },
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
  })

  return model ? trimStrings(model) : null
}

export const createComponentModel = async (
  data: CreateComponentModel,
  db: Prisma.TransactionClient = prisma
) => {
  const model = await db.componentModels.create({
    data,
  })

  return trimStrings(model)
}

// Components carry their own subtypeId, which must match their model's, so a
// model that moves takes its components with it.
export const updateComponentModel = async (
  id: string,
  data: UpdateComponentModel,
  db?: Prisma.TransactionClient
) => {
  const update = async (tx: Prisma.TransactionClient) => {
    const updated = await tx.componentModels.update({
      where: { id },
      data,
    })
    if (data.componentSubtypeId) {
      await tx.components.updateMany({
        where: { modelId: id, subtypeId: { not: data.componentSubtypeId } },
        data: { subtypeId: data.componentSubtypeId },
      })
    }
    return updated
  }
  const model = await (db ? update(db) : prisma.$transaction(update))

  return trimStrings(model)
}

export type ComponentModelSubtypeProblem =
  'subtype_not_found' | 'surface_subtype'

export const findModelSubtypeProblem = async (
  subtypeId: string,
  db: Prisma.TransactionClient = prisma
): Promise<ComponentModelSubtypeProblem | null> => {
  const subtype = await db.componentSubtypes.findUnique({
    where: { id: subtypeId },
    select: {
      componentType: { select: { category: { select: { type: true } } } },
    },
  })
  if (!subtype) return 'subtype_not_found'
  return subtype.componentType.category.type ===
    property.ComponentCategoryTypeSchema.enum.SURFACE
    ? 'surface_subtype'
    : null
}

export type ModelScope =
  { categoryId: string } | { typeId: string } | { subtypeId: string }

const modelScopeWhere = (
  scope: ModelScope
): Prisma.ComponentModelsWhereInput => {
  if ('categoryId' in scope) {
    return { subtype: { componentType: { categoryId: scope.categoryId } } }
  }
  if ('typeId' in scope) return { subtype: { typeId: scope.typeId } }
  return { componentSubtypeId: scope.subtypeId }
}

export const updateUnlessModelsUnder = async <T>(
  scope: ModelScope | null,
  update: (db: Prisma.TransactionClient) => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; models: number }> => {
  if (!scope) return { ok: true, data: await update(prisma) }

  return serializable(async (tx) => {
    const models = await tx.componentModels.count({
      where: modelScopeWhere(scope),
    })
    if (models > 0) return { ok: false, models }
    return { ok: true, data: await update(tx) }
  })
}

export const deleteComponentModel = async (id: string) => {
  await prisma.componentModels.delete({
    where: { id },
  })
}

// Returns Models under the surface-finish hierarchy with the full Subtype →
// Type → Category tree populated, sorted so the placeholder Subtype
// (`Ospecificera*`) pins to the top of each Type. Used by the inspection
// surface picker.
export const getSurfaceModels = async () => {
  const models = await prisma.componentModels.findMany({
    where: {
      subtype: {
        componentType: {
          category: {
            type: property.ComponentCategoryTypeSchema.enum.SURFACE,
          },
        },
      },
    },
    include: {
      subtype: {
        include: {
          componentType: { include: { category: true } },
        },
      },
    },
  })

  return models.sort((a, b) => {
    const aSub = a.subtype.subTypeName
    const bSub = b.subtype.subTypeName
    const aUn = aSub.startsWith('Ospecificera')
    const bUn = bSub.startsWith('Ospecificera')
    if (aUn && !bUn) return -1
    if (!aUn && bUn) return 1
    return aSub.localeCompare(bSub)
  })
}

// ==================== COMPONENT MODEL DOCUMENTS ====================

export const getComponentModelWithDocuments = async (modelId: string) => {
  return prisma.componentModels.findUnique({
    where: { id: modelId },
    include: { documents: true },
  })
}
