import { prisma } from './db'

export async function getParkingSpaceByRentalPropertyId(
  rentalPropertyId: string
) {
  /**
   * Example SQL query to fetch parking space information (based on query found in property-management-adapter.ts):
   *
   * SELECT
   *   babps.keycmobj,
   *   babuf.hyresid AS rentalObjectCode,
   *   babps.code AS vehiclespacecode,
   *   babps.caption AS vehiclespacecaption,
   *   babuf.cmpcode AS companycode,
   *   babuf.cmpcaption AS companycaption,
   *   babuf.fencode AS scegcode,
   *   babuf.fencaption AS scegcaption,
   *   babuf.fstcode AS estatecode,
   *   babuf.fstcaption AS estatecaption,
   *   babuf.bygcode AS blockcode,
   *   babuf.bygcaption AS blockcaption,
   *   babpt.code AS vehiclespacetypecode,
   *   babpt.caption AS vehiclespacetypecaption,
   *   babps.platsnr AS vehiclespacenumber,
   *   cmadr.adress1 AS postaladdress,
   *   cmadr.adress2 AS street,
   *   cmadr.adress3 AS zipcode,
   *   cmadr.adress4 AS city
   * FROM babps
   * INNER JOIN babuf ON babuf.keycmobj = babps.keycmobj
   * INNER JOIN babpt ON babpt.keybabpt = babps.keybabpt
   * LEFT JOIN cmadr ON cmadr.keycode = babps.keycmobj
   *   AND cmadr.keydbtbl = '_RQA11RNMA'
   *   AND cmadr.keycmtyp = 'adrpost'
   * WHERE babuf.cmpcode = '001' AND babuf.hyresid = '216-704-00-0034';
   */

  const propertyStructureResponse = await prisma.propertyStructure.findFirst({
    select: {
      rentalId: true,
      companyCode: true,
      companyName: true,
      managementUnitCode: true,
      managementUnitName: true,
      propertyCode: true,
      propertyName: true,
      buildingCode: true,
      buildingName: true,
      parkingSpace: {
        select: {
          propertyObjectId: true,
          code: true,
          name: true,
          parkingNumber: true,
          parkingSpaceType: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
    },
    where: {
      rentalId: rentalPropertyId,
      companyCode: '001', // Including this value from the original SQL query as it seems hardcoded
    },
  })

  // Don't return anything if no parking space is found in the data..
  // If for example providing a contract number that is associated with an apartment.
  if (propertyStructureResponse?.parkingSpace === null) return null

  // Fetch the address associated with the parking space
  const addressResponse = await prisma.address.findFirst({
    select: {
      streetAddress: true,
      streetAddress2: true,
      postalCode: true,
      city: true,
    },
    where: {
      code: propertyStructureResponse?.parkingSpace?.propertyObjectId,
      tableName: '_RQA11RNMA',
      addressType: 'adrpost',
    },
  })

  return {
    ...propertyStructureResponse,
    address: {
      ...addressResponse,
    },
  }
}
