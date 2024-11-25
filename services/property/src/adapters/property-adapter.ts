import { PrismaClient } from '@prisma/client'
import { PropertyWithObject, PropertyBasicInfo } from '../types/property-adapter'

const prisma = new PrismaClient({
    log: ['query'],
})

const getPropertyById = async (propertyId: string): Promise<PropertyWithObject | null> => {
    const response = await prisma.property.findUnique({
        where: {
            id: propertyId,
        },
        include: {
            propertyObject: true,
        },
    })
    return response
}

const getProperties = async (tract: string | undefined): Promise<PropertyBasicInfo[]> => {
    if (tract) {
        return prisma.property.findMany({
            where: {tract},
            select: {
                propertyId: true,
                propertyCode: true,
                tract: true,
                propertyDesignation: true,
            },
        })
    }
    return prisma.property.findMany({
        select: {
            propertyId: true,
            propertyCode: true,
            tract: true,
            propertyDesignation: true,
        },
    })
}

export {getPropertyById, getProperties }
