import { Prisma } from '@prisma/client'

export type PropertyWithObject = Prisma.PropertyGetPayload<{
  include: {
    propertyObject: true
  }
}>

export type PropertyBasicInfo = Prisma.PropertyGetPayload<{
  select: {
    id: true
    code: true
    tract: true
    propertyDesignation: true
  }
}>
