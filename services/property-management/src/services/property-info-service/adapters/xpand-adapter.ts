import { loggedAxios as axios, logger } from '@onecore/utilities'
import knex from 'knex'
import {
  RentalPropertyInfo,
  ApartmentInfo,
  CommercialSpaceInfo,
  ParkingSpaceInfo,
  MaintenanceUnitInfo,
} from '@onecore/types'

import Config from '../../../common/config'

const db = knex({
  client: 'mssql',
  connection: Config.xpandDatabase,
  pool: {
    max: 20,
    min: 0,
    idleTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
  },
})

export type AdapterResult<T, E> = { ok: true; data: T } | { ok: false; err: E }

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
          roomTypeCode: row.apartment_type_code,
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
    logger.error(error, 'Error transforming rental property from db')
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
      caption: row.caption.replace(/\b(TVÄTTSTUGA|Miljöbod)\b/g, '').trim(),
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

const getApartmentRentalPropertyInfo = async (
  rentalPropertyId: string
): Promise<AdapterResult<ApartmentInfo, 'not-found' | 'unknown'>> => {
  try {
    const [row] = await db('cmobj')
      .select(
        'hyint.code as rental_type_code',
        'hyint.caption as rental_type',
        'hyinf.lmnr as apartment_number',
        'babuf.caption as address',
        'babuf.lghcode as apartment_code',
        'babuf.vancode as entrance',
        'babuf.fstcode as estate_code',
        'babuf.fstcaption as estate',
        'babuf.bygcode as building_code',
        'babuf.bygcaption as building',
        'babuf.hyresid as rental_property_id',
        'babuf.lokcode as commercial_space_code',
        'babuf.bpscode as parking_space_code',
        'balgh.uppgang as floor',
        'balgh.hiss as has_elevator',
        'balgh.hygienutr as wash_space',
        'balgt.caption as apartment_type',
        'balgt.code as apartment_type_code',
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
      .where('hyinf.hyresid', rentalPropertyId)
      .andWhere('cmobt.keycmobt', 'balgh')

    if (!row) {
      return { ok: false, err: 'not-found' }
    }

    const trimmed = trimRow(row)
    return {
      ok: true,
      data: {
        rentalTypeCode: trimmed.rental_type_code,
        rentalType: trimmed.rental_type,
        address: trimmed.address,
        code: trimmed.apartment_code,
        number: trimmed.apartment_number,
        type: trimmed.apartment_type,
        roomTypeCode: trimmed.apartment_type_code,
        entrance: trimmed.entrance,
        floor: trimmed.floor,
        hasElevator: trimmed.has_elevator === 1 ? true : false,
        washSpace: trimmed.wash_space,
        area: trimmed.apartment_area,
        estateCode: trimmed.estate_code,
        estate: trimmed.estate,
        buildingCode: trimmed.building_code,
        building: trimmed.building,
      },
    }
  } catch (err) {
    logger.error(err, 'Error getting apartment rental property info')
    return { ok: false, err: 'unknown' }
  }
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

export {
  getRentalPropertyInfo,
  getMaintenanceUnits,
  getApartmentRentalPropertyInfo,
  db,
}
