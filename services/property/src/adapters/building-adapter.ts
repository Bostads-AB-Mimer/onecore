import {map} from "lodash"
import {PrismaClient} from "@prisma/client"

const prisma = new PrismaClient({
    log: ['query'],
})

const getBuildings = async (propertyCode: string) => {
    const result = await prisma.property.findMany({
        where: {
            propertyCode: propertyCode,
        },
        include: {
            building: true,
            district: true
        }
    })

    if (!result[0]) {
        return []
    }

    return result[0].building ? [{
        ...result[0].building,
        code: result[0].district?.code || '',
        caption: result[0].district?.caption || ''
    }] : []
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
            district: true
        }
    })
}


export {getBuildings, getBuildingByCode}
