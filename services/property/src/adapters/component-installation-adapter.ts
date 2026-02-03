import { trimStrings } from '@src/utils/data-conversion'
import { prisma } from './db'
import type {
  CreateComponentInstallation,
  UpdateComponentInstallation,
} from '../types/component'

// ==================== COMPONENT INSTALLATIONS ====================

export const getComponentInstallations = async (
  filters: {
    componentId?: string
    spaceId?: string
  },
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit

  const where: any = {}
  if (filters.componentId) where.componentId = filters.componentId
  if (filters.spaceId) where.spaceId = filters.spaceId

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
