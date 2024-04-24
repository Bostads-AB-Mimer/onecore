import axios from 'axios'
import knex from 'knex'
import Config from '../../../common/config'
import {
  RentalPropertyInfo,
  ApartmentInfo,
  CommercialSpaceInfo,
  ParkingSpaceInfo,
  MaintenanceUnitInfo,
  ParkingSpace,
} from 'onecore-types'
import {
  getParkingSpaceApplicationCategory,
  getParkingSpaceType,
  getStreet,
  getStreetNumber,
} from '../../../utils/parking-spaces'

const db = knex({
  client: 'mssql',
  connection: Config.xpandDatabase,
})

function trimRow(obj: any): any {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trimEnd() : value,
    ])
  )
}

const transformFromDbRentalPropertyInfo = (row: any): RentalPropertyInfo => {
  let property: ApartmentInfo | CommercialSpaceInfo | ParkingSpaceInfo
  let rentalPropertyType: string

  row = trimRow(row[0])

  try {
    switch (row.keycmobt) {
      case 'balgh': {
        rentalPropertyType = 'Lägenhet'
        property = {
          rentalTypeCode: row.rental_type_code,
          rentalType: row.rental_type,
          address: row.address,
          code: row.apartment_code,
          number: row.apartment_number,
          type: row.apartment_type,
          entrance: row.entrance,
          floor: row.floor,
          hasElevator: row.has_elevator === 1 ? true : false,
          washSpace: row.wash_space,
          area: row.apartment_area,
          estateCode: row.estate_code,
          estate: row.estate,
          buildingCode: row.building_code,
          building: row.building,
        }
        break
      }

      case 'balok': {
        rentalPropertyType = 'Lokal'
        property = {
          rentalTypeCode: row.rental_type_code,
          rentalType: row.rental_type,
          address: row.address,
          code: row.commercial_space_code,
          type: row.commercial_space_type,
          entrance: row.entrance,
          estateCode: row.estate_code,
          estate: row.estate,
          buildingCode: row.building_code,
          building: row.building,
        }
        break
      }

      case 'babps': {
        rentalPropertyType = 'Bilplats'
        property = {
          rentalTypeCode: row.rental_type_code,
          rentalType: row.rental_type,
          address: row.address,
          code: row.parking_space_code,
        }
        break
      }
      default: {
        throw new Error(`Unknown property type: ${row.keycmobt}`)
      }
    }
  } catch (error) {
    console.error('Error transforming from db', error)
    throw error
  }

  return {
    id: row.rental_property_id,
    type: rentalPropertyType,
    property: property,
  }
}

const transformFromDbMaintenanceUnits = (rows: any): MaintenanceUnitInfo[] => {
  return rows.map((row: any) => {
    row = trimRow(row)
    return {
      id: row.keycmobj,
      rentalPropertyId: row.rental_property_id,
      code: row.code,
      caption: row.caption,
      type: row.type,
      estateCode: row.estate_code,
      estate: row.estate,
    }
  })
}

const getRentalPropertyInfo = async (
  rentalPropertyId: string
): Promise<RentalPropertyInfo | undefined> => {
  const row = await db('cmobj')
    .select(
      'cmobt.keycmobt',
      'babuf.hyresid as rental_property_id',
      'babuf.caption as address',
      'babuf.vancode as entrance',
      'babuf.fstcode as estate_code',
      'babuf.fstcaption as estate',
      'babuf.bygcode as building_code',
      'babuf.bygcaption as building',
      'hyint.code as rental_type_code',
      'hyint.caption as rental_type',
      'babuf.lokcode as commercial_space_code',
      'balot.code as commercial_space_type',
      'babuf.bpscode as parking_space_code',
      'babuf.lghcode as apartment_code',
      'hyinf.lmnr as apartment_number',
      'balgt.code as apartment_type_code',
      'balgt.caption as apartment_type',
      'balgh.uppgang as floor',
      'balgh.hiss as has_elevator',
      'balgh.hygienutr as wash_space',
      'cmvalboa.value as apartment_area'
    )
    .innerJoin('cmobt', 'cmobj.keycmobt', 'cmobt.keycmobt')
    .innerJoin('hyinf', 'cmobj.keycmobj', 'hyinf.keycmobj')
    .innerJoin('hyint', 'hyinf.keyhyint', 'hyint.keyhyint')
    .innerJoin('babuf', 'cmobj.keycmobj', 'babuf.keycmobj')
    .leftJoin('balgh', 'cmobj.keycmobj', 'balgh.keycmobj')
    .leftJoin('balgt', 'balgh.keybalgt', 'balgt.keybalgt')
    .leftJoin('cmval as cmvalboa', function () {
      this.on('cmvalboa.keycode', '=', 'cmobj.keycmobj').andOn(
        'cmvalboa.keycmvat',
        '=',
        db.raw('?', ['BOA'])
      )
    })
    .leftJoin('balok', 'cmobj.keycmobj', 'balok.keycmobj')
    .leftJoin('balot', 'balok.keybalot', 'balot.keybalot')
    .where('hyinf.hyresid', rentalPropertyId)

  if (!row || row.length === 0) {
    return undefined
  }

  const rentalPropertyInfo = transformFromDbRentalPropertyInfo(row)

  const maintenanceUnits = await getMaintenanceUnits(rentalPropertyId)
  if (maintenanceUnits) {
    rentalPropertyInfo.maintenanceUnits = maintenanceUnits
  }

  return rentalPropertyInfo
}

const getMaintenanceUnits = async (
  rentalPropertyId: string
): Promise<MaintenanceUnitInfo[] | undefined> => {
  const rows = await db('baxyk')
    .select(
      'baxyk.keycmobj',
      'prop_babuf.hyresid as rental_property_id',
      'mu_babuf.code as code',
      'mu_babuf.caption as caption',
      'bauht.caption as type',
      'mu_babuf.fstcode as estate_code',
      'mu_babuf.fstcaption as estate'
    )
    .innerJoin('babuf as mu_babuf', 'baxyk.keycmobj', 'mu_babuf.keycmobj')
    .innerJoin('babuf as prop_babuf', 'baxyk.keycmobj2', 'prop_babuf.keycmobj')
    .innerJoin('bauhe', 'mu_babuf.keycmobj', 'bauhe.keycmobj')
    .innerJoin('bauht', 'bauhe.keybauht', 'bauht.keybauht')
    .where('prop_babuf.hyresid', rentalPropertyId)

  if (!rows || rows.length === 0) {
    return undefined
  }

  return transformFromDbMaintenanceUnits(rows)
}

const getParkingSpace = async (
  parkingSpaceId: string
): Promise<ParkingSpace | undefined> => {
  try {
    const url = `${Config.xpandService.url}/publishedrentalobjects/parkings/${parkingSpaceId}`

    const response = await axios({
      method: 'get',
      url: url,
    })

    const parkingSpace: ParkingSpace = {
      parkingSpaceId: response.data.rentalObjectCode,
      address: {
        street: getStreet(response.data.postalAddress),
        number: getStreetNumber(response.data.postalAddress),
        postalCode: response.data.zipCode,
        city: response.data.city,
      },
      vacantFrom: response.data.vacantFrom,
      rent: {
        currentRent: {
          leaseId: undefined,
          rentId: undefined,
          currentRent: response.data.monthRent,
          vat: response.data.vatIncluded ?? 0,
          additionalChargeAmount: undefined,
          additionalChargeDescription: undefined,
          rentStartDate: undefined,
          rentEndDate: undefined,
        },
        futureRents: [],
      },
      type: getParkingSpaceType(response.data.objectTypeCode),
      applicationCategory: getParkingSpaceApplicationCategory(
        response.data.waitingListType
      ),
    }

    return parkingSpace
  } catch (error) {
    console.error('Error getting parking space', error)
    return undefined
  }
}

export { getRentalPropertyInfo, getMaintenanceUnits, getParkingSpace }
