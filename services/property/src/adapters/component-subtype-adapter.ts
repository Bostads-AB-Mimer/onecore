import { trimStrings } from '@src/utils/data-conversion'
import { prisma } from './db'
import type {
  CreateComponentSubtype,
  UpdateComponentSubtype,
} from '../types/component'

// ==================== COMPONENT SUBTYPES ====================

export const getComponentSubtypes = async (
  filters: {
    typeId?: string
    subtypeName?: string
  },
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit

  const where: any = {}
  if (filters.typeId && filters.typeId.length > 0) where.typeId = filters.typeId

  // Search by subtype name (2-character minimum, case-insensitive via SQL Server default collation)
  if (filters.subtypeName && filters.subtypeName.trim().length >= 2) {
    where.subTypeName = {
      contains: filters.subtypeName.trim(),
      // NO mode: 'insensitive' - SQL Server uses case-insensitive collation by default
    }
  }

  const [subtypes, total] = await Promise.all([
    prisma.componentSubtypes.findMany({
      where,
      skip,
      take: limit,
      orderBy: { subTypeName: 'asc' },
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
