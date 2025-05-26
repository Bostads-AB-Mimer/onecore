import { loggedAxios as axios, logger } from 'onecore-utilities'
import knex from 'knex'
import {
  RentalPropertyInfo,
  ApartmentInfo,
  CommercialSpaceInfo,
  ParkingSpaceInfo,
  MaintenanceUnitInfo,
  ParkingSpace,
  VacantParkingSpace,
  RentalObject,
} from 'onecore-types'

import Config from '../../../common/config'
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
    logger.error(error, 'Error getting parking space')
    return undefined
  }
}

const districts = {
  'Distrikt Mitt': [
    'Centrum',
    'Gryta',
    'Skallberget',
    'Nordanby',
    'Vega',
    'Hökåsen',
  ],
  'Distrikt Norr': [
    'Oxbacken',
    'Jakobsberg',
    'Pettersberg',
    'Vallby',
    'Skultuna',
  ],
  'Distrikt Väst': [
    'Vetterstorp',
    'Vetterslund',
    'Råby',
    'Hammarby',
    'Fredriksberg',
    'Bäckby',
    'Skälby',
  ],
  'Distrikt Öst': [
    'Lillåudden',
    'Gideonsberg',
    'Hemdal',
    'Haga',
    'Malmaberg',
    'Skiljebo',
    'Viksäng',
    'Öster Mälarstrand',
  ],
  'Mimer Student': ['Student'],
}

function transformFromXpandListing(row: any): VacantParkingSpace {
  const scegcaption = row.scegcaption?.toUpperCase() || ''
  let district = '-'
  let districtCode: string | undefined = undefined
  let restidentalAreaCaption = '-'

  // Extract district code (number before ':')
  const match = scegcaption.match(/^(\d+):/)
  if (match) {
    districtCode = match[1]
  }

  // Determine district and restidentalAreaCaption based on scegcaption
  for (const [key, locations] of Object.entries(districts)) {
    const matchedLocation = locations.find((location) =>
      scegcaption.includes(location.toUpperCase())
    )
    if (matchedLocation) {
      district = key
      restidentalAreaCaption = matchedLocation
      break
    }
  }

  return {
    rentalObjectCode: row.rentalObjectCode,
    address: row.postaladdress,
    monthlyRent: row.MonthlyRent, // TODO: Add rent info if available
    blockCaption: row.blockcaption,
    blockCode: row.blockcode,
    restidentalAreaCode: row.scegcode,
    objectTypeCaption: row.vehiclespacetypecaption,
    objectTypeCode: row.vehiclespacetypecode,
    vacantFrom: row.lastdebitdate,
    vehicleSpaceCaption: row.vehiclespacecaption,
    vehicleSpaceCode: row.vehiclespacecode,
    districtCaption: district,
    districtCode,
    restidentalAreaCaption,
  }
}

const buildMainQuery = (
  parkingSpacesQuery: any,
  activeRentalBlocksQuery: any,
  activeContractsQuery: any
) => {
  return db
    .from(parkingSpacesQuery.as('ps'))
    .select(
      'ps.rentalObjectCode',
      'ps.vehiclespacecode',
      'ps.vehiclespacecaption',
      'ps.companycode',
      'ps.companycaption',
      'ps.blockcode',
      'ps.blockcaption',
      'ps.vehiclespacetypecode',
      'ps.vehiclespacetypecaption',
      'ps.vehiclespacenumber',
      'ps.postaladdress',
      'ps.zipcode',
      'ps.city',
      'ps.scegcaption',
      'ps.scegcode',
      db.raw(`
        CASE
          WHEN rb.keycmobj IS NOT NULL THEN 'Has rental block: ' + rb.blocktype
          WHEN ac.keycmobj IS NOT NULL THEN 'Has active contract: ' + ac.contractid
          ELSE 'VACANT'
        END AS status
      `),
      'rb.blocktype',
      'rb.blockstartdate',
      'rb.blockenddate',
      'ac.contractid',
      'ac.fromdate as contractfromdate',
      'ac.lastdebitdate'
    )
    .leftJoin(activeRentalBlocksQuery.as('rb'), 'rb.keycmobj', 'ps.keycmobj')
    .leftJoin(activeContractsQuery.as('ac'), 'ac.keycmobj', 'ps.keycmobj')
}

const buildSubQueries = () => {
  const parkingSpacesQuery = db
    .from('babps')
    .select(
      'babps.keycmobj',
      'babuf.hyresid as rentalObjectCode',
      'babps.code as vehiclespacecode',
      'babps.caption as vehiclespacecaption',
      'babuf.cmpcode as companycode',
      'babuf.cmpcaption as companycaption',
      'babuf.fencode as scegcode',
      'babuf.fencaption as scegcaption',
      'babuf.fstcode as estatecode',
      'babuf.fstcaption as estatecaption',
      'babuf.bygcode as blockcode',
      'babuf.bygcaption as blockcaption',
      'babpt.code as vehiclespacetypecode',
      'babpt.caption as vehiclespacetypecaption',
      'babps.platsnr as vehiclespacenumber',
      'cmadr.adress1 as postaladdress',
      'cmadr.adress2 as street',
      'cmadr.adress3 as zipcode',
      'cmadr.adress4 as city'
    )
    .innerJoin('babuf', 'babuf.keycmobj', 'babps.keycmobj')
    .innerJoin('babpt', 'babpt.keybabpt', 'babps.keybabpt')
    .leftJoin('cmadr', function () {
      this.on('cmadr.keycode', '=', 'babps.keycmobj')
        .andOn('cmadr.keydbtbl', '=', db.raw('?', ['_RQA11RNMA']))
        .andOn('cmadr.keycmtyp', '=', db.raw('?', ['adrpost']))
    })
    .where('babuf.cmpcode', '=', '001')

  const activeRentalBlocksQuery = db
    .from('hyspt')
    .select(
      'hyspt.keycmobj',
      'hyspa.caption as blocktype',
      'hyspt.fdate as blockstartdate',
      'hyspt.tdate as blockenddate'
    )
    .innerJoin('hyspa', 'hyspa.keyhyspa', 'hyspt.keyhyspa')
    .where(function () {
      this.whereNull('hyspt.fdate').orWhere('hyspt.fdate', '<=', db.fn.now())
    })
    .andWhere(function () {
      this.whereNull('hyspt.tdate').orWhere('hyspt.tdate', '>', db.fn.now())
    })

  const activeContractsQuery = db
    .from('hyobj')
    .select(
      'hyinf.keycmobj',
      'hyobj.hyobjben as contractid',
      'hyobj.avtalsdat as contractdate',
      'hyobj.fdate as fromdate',
      'hyobj.tdate as todate',
      'hyobj.sistadeb as lastdebitdate'
    )
    .innerJoin('hykop', function () {
      this.on('hykop.keyhyobj', '=', 'hyobj.keyhyobj').andOn(
        'hykop.ordning',
        '=',
        db.raw('?', [1])
      )
    })
    .innerJoin('hyinf', 'hyinf.keycmobj', 'hykop.keycmobj')
    .whereIn('hyobj.keyhyobt', ['3', '5', '_1WP0JXVK8', '_1WP0KDMOO'])
    .whereNull('hyobj.makuldatum')
    .andWhere('hyobj.deletemark', '=', 0)
    .whereNull('hyobj.sistadeb')

  return { parkingSpacesQuery, activeRentalBlocksQuery, activeContractsQuery }
}

const getAllVacantParkingSpaces = async (): Promise<
  AdapterResult<VacantParkingSpace[], 'get-all-vacant-parking-spaces-failed'>
> => {
  try {
    const {
      parkingSpacesQuery,
      activeRentalBlocksQuery,
      activeContractsQuery,
    } = buildSubQueries()

    const results = await buildMainQuery(
      parkingSpacesQuery,
      activeRentalBlocksQuery,
      activeContractsQuery
    )
      .where(function () {
        this.whereNull('rb.keycmobj').orWhere(
          'rb.blockenddate',
          '<=',
          db.fn.now()
        )
      })
      .whereNull('ac.keycmobj')
      .orderBy('ps.blockcode', 'ps.vehiclespacenumber')

    const listings: VacantParkingSpace[] = results.map((row) =>
      trimRow(transformFromXpandListing(row))
    )
    return { ok: true, data: listings }
  } catch (err) {
    logger.error(err, 'tenantLeaseAdapter.getAllAvailableParkingSpaces')
    return { ok: false, err: 'get-all-vacant-parking-spaces-failed' }
  }
}

//todo: behöver också hämta parking space type (ex. varmgarage, carport osv). Då behöver vi göra en ny typ "ParkingSpace" som ärver RentalObject? I så fall byta namn på funktionen till getParkingSpace istället och returnera parking spaces....
//todo: behöver också hämta hyra
const getRentalObject = async (
  rentalObjectCode: string
): Promise<
  AdapterResult<
    RentalObject,
    'get-rental-object-failed' | 'rental-object-not-found'
  >
> => {
  try {
    const {
      parkingSpacesQuery,
      activeRentalBlocksQuery,
      activeContractsQuery,
    } = buildSubQueries()

    const result = await buildMainQuery(
      parkingSpacesQuery,
      activeRentalBlocksQuery,
      activeContractsQuery
    )
      .where('ps.rentalObjectCode', '=', rentalObjectCode) // Filter by rentalObjectCode
      .first()

    if (!result) {
      return { ok: false, err: 'rental-object-not-found' }
    }

    const rentalObject = trimRow(transformFromXpandListing(result))
    return { ok: true, data: rentalObject }
  } catch (err) {
    logger.error(err, 'tenantLeaseAdapter.getRentalObject')
    return { ok: false, err: 'get-rental-object-failed' }
  }
}

export {
  getRentalPropertyInfo,
  getMaintenanceUnits,
  getParkingSpace,
  getApartmentRentalPropertyInfo,
  getAllVacantParkingSpaces,
  getRentalObject,
  transformFromXpandListing,
  db,
}
