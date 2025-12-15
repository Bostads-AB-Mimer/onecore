import { trimStrings } from '@src/utils/data-conversion'
import { prisma } from './db'
import type {
  CreateComponentCategory,
  UpdateComponentCategory,
} from '../types/component'

// ==================== COMPONENT CATEGORIES ====================

export const getComponentCategories = async (
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit

  const [categories, total] = await Promise.all([
    prisma.componentCategories.findMany({
      skip,
      take: limit,
      orderBy: { categoryName: 'asc' },
    }),
    prisma.componentCategories.count(),
  ])

  return {
    categories: categories.map(trimStrings),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export const getComponentCategoryById = async (id: string) => {
  const category = await prisma.componentCategories.findUnique({
    where: { id },
    include: {
      componentTypes: true,
    },
  })

  return category ? trimStrings(category) : null
}

export const createComponentCategory = async (
  data: CreateComponentCategory
) => {
  const category = await prisma.componentCategories.create({
    data,
  })

  return trimStrings(category)
}

export const updateComponentCategory = async (
  id: string,
  data: UpdateComponentCategory
) => {
  const category = await prisma.componentCategories.update({
    where: { id },
    data,
  })

  return trimStrings(category)
}

export const deleteComponentCategory = async (id: string) => {
  await prisma.componentCategories.delete({
    where: { id },
  })
}
