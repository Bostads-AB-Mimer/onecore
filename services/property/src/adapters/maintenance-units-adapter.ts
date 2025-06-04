import { trimStrings } from '@src/utils/data-conversion'
import { prisma } from './db'

export const getMaintenanceUnitsByRentalPropertyId = async (
  rentalPropertyId: string
) => {
  /*
    Based on SQL Query to fetch maintenance units by rental property ID

    SELECT 
    baxyk.keycmobj,
    prop_babuf.hyresid AS rental_property_id,
    mu_babuf.code AS code,
    mu_babuf.caption AS caption,
    bauht.caption AS type,
    mu_babuf.fstcode AS estate_code,
    mu_babuf.fstcaption AS estate
    
    FROM baxyk
    
    INNER JOIN babuf AS mu_babuf ON baxyk.keycmobj = mu_babuf.keycmobj
    INNER JOIN babuf AS prop_babuf ON baxyk.keycmobj2 = prop_babuf.keycmobj
    INNER JOIN bauhe ON mu_babuf.keycmobj = bauhe.keycmobj
    INNER JOIN bauht ON bauhe.keybauht = bauht.keybauht
    
    WHERE prop_babuf.hyresid = '206-007-01-0102
  */

  const response = await prisma.propertyStructureRelation.findMany({
    select: {
      // Assuming this includes maintenance unit details (mu_babuf)
      propertyStructure1: {
        select: {
          maintenanceUnitName: true,
          maintenanceUnitId: true,
          maintenanceUnit: {
            select: {
              code: true,
              maintenanceUnitType: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      // Assuming this includes rental property details (prop_babuf)
      propertyStructure2: {
        select: {
          rentalId: true,
          propertyCode: true,
          propertyName: true,
        },
      },
    },
    where: {
      propertyStructure2: {
        rentalId: rentalPropertyId,
      },
    },
  })

  const maintenanceUnitsMapped = trimStrings(response).map((item) => {
    return {
      id: item.propertyStructure1.maintenanceUnitId,
      rentalPropertyId: item.propertyStructure2.rentalId,
      code: item.propertyStructure1.maintenanceUnit?.code,
      caption: item.propertyStructure1.maintenanceUnitName,
      type: item.propertyStructure1.maintenanceUnit?.maintenanceUnitType?.name,
      estateCode: item.propertyStructure2.propertyCode,
      estate: item.propertyStructure2.propertyName,
    }
  })

  return maintenanceUnitsMapped
}
