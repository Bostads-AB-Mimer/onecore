import { Prisma } from '@prisma/client'

export type PropertyWithObject = Prisma.PropertyGetPayload<{
  include: {
    propertyObject: true
  }
}>

export type PropertyBasicInfo = Prisma.PropertyGetPayload<{
  select: {
    propertyId: true
    propertyCode: true
    tract: true
    propertyDesignation: true
  }
}>
