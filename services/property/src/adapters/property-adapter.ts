import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient({
    log: ['query'],
});


// Building -> PropertyObject -> property -> staircase ?

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
                propertyObjectId: true //todo: for dev purposes
            },
        })
    }
    return prisma.property.findMany({
        select: {
            propertyId: true,
            propertyCode: true,
            tract: true,
            propertyDesignation: true,
            propertyObjectId: true //todo: for dev purposes
        },
    })
}

const getBuildings = async (propertyCode: string) => {
    const result = await  prisma.property.findMany({
        where: {
            propertyCode: propertyCode,
        },
        include: {
            freeTable3: { //todo: rename to connection table to PropertyBuilding?
                select: {
                    buildings: true,
                },
            },
        },
    })

    return result[0].freeTable3?.buildings
}

const getPropertyStructure = async (propertyId: string) => {
    return prisma.propertyStructure.findMany({
        where: {
            propertyId: propertyId,
        },
    })
}


export {getPropertyById, getProperties, getBuildings, getPropertyStructure}
