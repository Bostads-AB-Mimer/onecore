import {map} from "lodash"
import {PrismaClient} from "@prisma/client"

const prisma = new PrismaClient({
    log: ['query'],
})

const getBuildings = async (propertyCode: string) => {
    const result = await prisma.property.findMany({
        where: {
            code: propertyCode,
        },

        include: {
            propertyDesignation: {
                select: {
                    buildings: true,
                },
            },
            district: {
                select: {
                    code: true,
                    caption: true,
                },
            },
        },
    })

    if (!result[0]) {
        return []
    }

    return map(result[0].propertyDesignation?.buildings, (building) => {
        return {
            ...building,
            ...result[0].district,
        }
    })
}

const getBuildingByCode = async (buildingCode: string) => {
    console.log("buildingCode: ", buildingCode)
    return prisma.building.findFirst({
        where: {
            buildingCode: {
                contains: buildingCode,
            }
        },
        include: {
            buildingType: true,
            marketArea: true,
            propertyDesignation: true,
            district: true,
        }
    })
}


export {getBuildings, getBuildingByCode}