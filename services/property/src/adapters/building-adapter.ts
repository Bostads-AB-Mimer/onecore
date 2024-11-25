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
            propertyObject: {
                include: {
                    building: true
                }
            }
        }
    })

    if (!result[0]?.propertyObject?.building) {
        return []
    }

    return [{
        ...result[0].propertyObject.building,
        code: result[0].code || '',
        caption: result[0].designation || ''
    }]
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
            propertyObject: {
                include: {
                    property: true
                }
            }
        }
    })
}


export {getBuildings, getBuildingByCode}
