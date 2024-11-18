import {PrismaClient} from '@prisma/client'
import {map} from "lodash";

const prisma = new PrismaClient({
    log: ['query'],
});

const getPropertyById = async (propertyId: string) => {
    const response = await prisma.property.findUnique({
        where: {
            propertyId: propertyId,
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

const getBuildings = async (propertyCode: string) => {
    const result = await prisma.property.findMany({
        where: {
            propertyCode: propertyCode,
        },
        include: {
            freeTable3: { //todo: rename connection table in schema
                select: {
                    buildings: true,
                },
            },
            freeTable2: { //todo: rename connection table in schema
                select: {
                    code: true,
                    caption: true,
                },
            }
        },
    })

    if(!result[0]){
        return []
    }

    return map(result[0].freeTable3?.buildings, (building) => {
        return {
            ...building,
            ...result[0].freeTable2,
        }
    })
}

const getBuildingParts = async (propertyId: string) => {
    return prisma.propertyStructure.findMany({
        where: {
            propertyId: propertyId,
        },
    })
}


export {getPropertyById, getProperties, getBuildings, getBuildingParts}
