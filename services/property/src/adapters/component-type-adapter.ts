import { trimStrings } from '@src/utils/data-conversion'
import { prisma } from './db'
import type {
  CreateComponentType,
  UpdateComponentType,
} from '../types/component'

// ==================== COMPONENT TYPES ====================

export const getComponentTypes = async (
  categoryId?: string,
  page: number = 1,
  limit: number = 20
) => {
  console.log('[component-type-adapter] getComponentTypes called with categoryId:', categoryId, 'type:', typeof categoryId, 'length:', categoryId?.length)
  const skip = (page - 1) * limit

  const where = categoryId && categoryId.length > 0 ? { categoryId } : {}
  console.log('[component-type-adapter] WHERE clause:', JSON.stringify(where))

  const [types, total] = await Promise.all([
    prisma.componentTypes.findMany({
      where,
      skip,
      take: limit,
      orderBy: { typeName: 'asc' },
      include: {
        category: true,
      },
    }),
    prisma.componentTypes.count({ where }),
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
      category: true,
      componentSubtypes: true,
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
