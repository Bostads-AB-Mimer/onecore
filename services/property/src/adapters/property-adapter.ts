import {PrismaClient} from '@prisma/client'
import {map} from "lodash";

const prisma = new PrismaClient({
    log: ['query'],
});

const getPropertyById = async (propertyId: string) => {
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

const getProperties = async (tract: string | undefined) => {
    if (tract) {
        return prisma.property.findMany({
            where: {tract},
            select: {
                id: true,
                code: true,
                tract: true,
                designation: true,
            },
        })
    }
    return prisma.property.findMany({
        select: {
            id: true,
            code: true,
            tract: true,
            designation: true,
        },
    })
}

export {getPropertyById, getProperties }
