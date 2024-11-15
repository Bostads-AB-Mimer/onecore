import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient({
    log: ['query'],
});


// Building -> PropertyObject -> property -> staircase ?

const getPropertyById = async (propertyId: string) => {
    console.log('propertyId', propertyId)
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
    //todo: freetable keys seem to point towards different tables?
    //todo: Xpand workspace also renders the company that owns the property
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
            //todo: db contains different object type ids
            //todo: currenty we only support bafst as a relation
            // propertyObject: {
            //     select: {objectTypeId: true},
            // },
        },
    })
}

const getBuildings = async (propertyId: string) => {

    //todo: relationship to property seems broken? Is it the query or the relation?
    //todo: property will always come back as null
    //todo: update - database does not have an explicit relationship on cmobj between these tables
    // return prisma.building.findMany({
    //     take: 15,
    //     include: {
    //         propertyObject: {
    //             include: {
    //                 property: true,
    //             },
    //         },
    //     },
    // });

    //todo: goal query
    // return prisma.building.findMany({
    //     where: {
    //         propertyObject: {
    //             property: {
    //                 propertyId: propertyId,
    //             },
    //         },
    //     },
    //     include: {
    //         propertyObject: {
    //             include: {
    //                 property: true,
    //             },
    //         },
    //     },
    // });

    //todo: test query with cmobj:
    // return prisma.building.findMany({
    //     where: {
    //         propertyObject: {
    //             propertyObjectId: propertyId,
    //         },
    //     },
    //     include: {
    //         propertyObject: {
    //             include: {
    //                 property: true,
    //             },
    //         },
    //     },
    // });
    return []
}

const getBuildingsBasedOnPropertyCode = async (buildingCode: string) => {
    return prisma.building.findMany({
        where: {
            buildingCode: buildingCode,
            // propertyObject: {
            //     property: {
            //         propertyCode: propertyCode,
            //     },
            // },
        },
        include: {
            propertyObject: {
                include: {
                    property: true,
                },
            },
        },
    })

    //todo: no results from below query
    // const buildingWithProperty = await prisma.building.findMany({
    //     take: 15,
    //     select: {
    //         buildingCode: true,
    //         Property: true
    //     }
    // });

    //return buildingWithProperty
}

const getPropertyStructure = async (propertyId: string) => {
    return prisma.propertyStructure.findMany({
        where: {
            propertyId: propertyId,
        },
    })
}


export {getPropertyById, getProperties, getBuildings, getBuildingsBasedOnPropertyCode, getPropertyStructure}
