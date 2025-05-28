import { trimStrings } from '@src/utils/data-conversion'
import { prisma } from './db'

export const getMaintenanceUnitsByRentalPropertyId = async (
  rentalPropertyId: string
) => {
  /*

    SQL Query to fetch maintenance units by rental property ID

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

  const result = await prisma.$queryRaw`
    SELECT 
        baxyk.keycmobj AS id,
        prop_babuf.hyresid AS rentalPropertyId,
        mu_babuf.code AS code,
        mu_babuf.caption AS caption,
        bauht.caption AS type,
        mu_babuf.fstcode AS estateCode,
        mu_babuf.fstcaption AS estate
    FROM baxyk
    INNER JOIN babuf AS mu_babuf ON baxyk.keycmobj = mu_babuf.keycmobj
    INNER JOIN babuf AS prop_babuf ON baxyk.keycmobj2 = prop_babuf.keycmobj
    INNER JOIN bauhe ON mu_babuf.keycmobj = bauhe.keycmobj
    INNER JOIN bauht ON bauhe.keybauht = bauht.keybauht
    WHERE prop_babuf.hyresid = ${rentalPropertyId}
    `

  return trimStrings(result)
}
