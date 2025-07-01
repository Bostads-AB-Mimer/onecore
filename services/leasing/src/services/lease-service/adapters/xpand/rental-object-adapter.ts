import { logger } from 'onecore-utilities'
import { RentalObject } from 'onecore-types'
import { xpandDb } from './xpandDb'
import { trimRow } from '../utils'

const districts = {
  Mitt: ['Centrum', 'Gryta', 'Skallberget', 'Nordanby', 'Vega', 'Hökåsen'],
  Norr: ['Oxbacken', 'Jakobsberg', 'Pettersberg', 'Vallby', 'Skultuna'],
  Väst: [
    'Vetterstorp',
    'Vetterslund',
    'Råby',
    'Hammarby',
    'Fredriksberg',
    'Bäckby',
    'Skälby',
  ],
  Öst: [
    'Lillåudden',
    'Gideonsberg',
    'Hemdal',
    'Haga',
    'Malmaberg',
    'Skiljebo',
    'Viksäng',
    'Öster Mälarstrand',
  ],
  Student: ['Student'],
}

export type AdapterResult<T, E> = { ok: true; data: T } | { ok: false; err: E }

function transformFromXpandRentalObject(row: any): RentalObject {
  const scegcaption = row.scegcaption?.toUpperCase() || ''
  let district = '-'
  let districtCode: string | undefined = undefined

  // Extract district code (number before ':')
  const match = scegcaption.match(/^(\d+):/)
  if (match) {
    districtCode = match[1]
  }

  // Determine district and based on scegcaption
  let matchedLocation: string | undefined = undefined
  for (const [key, locations] of Object.entries(districts)) {
    matchedLocation = locations.find((location) =>
      scegcaption.includes(location.toUpperCase())
    )
    if (matchedLocation) {
      district = key
      break
    }
  }

  // If no matchedLocation, check row.residentialareacaption
  if (!matchedLocation && row.residentialareacaption) {
    const rac = row.residentialareacaption.toUpperCase()
    for (const [key, locations] of Object.entries(districts)) {
      matchedLocation = locations.find((location) =>
        rac.includes(location.toUpperCase())
      )
      if (matchedLocation) {
        district = key
        break
      }
    }
  }

  const yearRentRows = row.yearrentrows ? JSON.parse(row.yearrentrows) : []
  // Calculate monthlyRent from yearrent if available and numeric
  let monthlyRent = 0
  if (Array.isArray(yearRentRows) && yearRentRows.length > 0) {
    const totalYearRent = yearRentRows
      .map((r: any) =>
        typeof r.yearrent === 'number' && !isNaN(r.yearrent) ? r.yearrent : 0
      )
      .reduce((sum: number, val: number) => sum + val, 0)
    monthlyRent = totalYearRent / 12
  }

  return {
    rentalObjectCode: row.rentalObjectCode,
    address: row.postaladdress,
    monthlyRent: monthlyRent,
    propertyCaption: row.estatecaption,
    propertyCode: row.estatecode,
    residentialAreaCode: row.residentialareacode,
    residentialAreaCaption: row.residentialareacaption,
    objectTypeCaption: row.vehiclespacetypecaption,
    objectTypeCode: row.vehiclespacetypecode,
    vacantFrom: row.lastdebitdate || new Date(),
    districtCaption: district,
    districtCode: districtCode,
    braArea: row.braarea,
  }
}

const buildMainQuery = (
  parkingSpacesQuery: any,
  activeRentalBlocksQuery?: any,
  activeContractsQuery?: any
) => {
  let query = xpandDb
    .from(parkingSpacesQuery.as('ps'))
    .select(
      'ps.rentalObjectCode',
      'ps.estatecode',
      'ps.estatecaption',
      'ps.vehiclespacetypecode',
      'ps.vehiclespacetypecaption',
      'ps.postaladdress',
      'ps.zipcode',
      'ps.city',
      'ps.scegcaption',
      'ps.scegcode',
      'ps.residentialareacode',
      'ps.residentialareacaption'
    )

  if (activeRentalBlocksQuery && activeContractsQuery) {
    query = query
      .select(
        xpandDb.raw(`
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
        'ac.todate as contracttodate',
        'ac.lastdebitdate',
        'rent.yearrentrows',
        'cmvalbar.value as braarea'
      )
      .leftJoin(activeRentalBlocksQuery.as('rb'), 'rb.keycmobj', 'ps.keycmobj')
      .leftJoin(activeContractsQuery.as('ac'), 'ac.keycmobj', 'ps.keycmobj')
  }

  return query
    .leftJoin(
      xpandDb.raw(`
          (
            SELECT 
              rentalpropertyid, 
              (
                SELECT yearrent
                FROM hy_debitrowrentalproperty_xpand_api x2 
                WHERE x2.rentalpropertyid = x1.rentalpropertyid 
                FOR JSON PATH
              ) as yearrentrows
            FROM hy_debitrowrentalproperty_xpand_api x1
            GROUP BY rentalpropertyid
          ) as rent
        `),
      'rent.rentalpropertyid',
      'ps.rentalObjectCode'
    )
    .leftJoin(
      xpandDb('cmval as cmvalbar')
        .select('cmvalbar.keycode', 'cmvalbar.value')
        .where('cmvalbar.keycmvat', 'BRA')
        .as('cmvalbar'),
      'cmvalbar.keycode',
      'ps.keycmobj'
    )
}

const buildSubQueries = () => {
  const parkingSpacesQuery = xpandDb
    .from('babps')
    .select(
      'babps.keycmobj',
      'babuf.hyresid as rentalObjectCode',
      'babuf.fencode as scegcode',
      'babuf.fencaption as scegcaption',
      'babuf.fstcode as estatecode',
      'babuf.fstcaption as estatecaption',
      'babpt.code as vehiclespacetypecode',
      'babpt.caption as vehiclespacetypecaption',
      'cmadr.adress1 as postaladdress',
      'cmadr.adress2 as street',
      'cmadr.adress3 as zipcode',
      'cmadr.adress4 as city',
      'babya.code as residentialareacode',
      'babya.caption as residentialareacaption'
    )
    .innerJoin('babuf', 'babuf.keycmobj', 'babps.keycmobj')
    .innerJoin('babpt', 'babpt.keybabpt', 'babps.keybabpt')
    .leftJoin('cmadr', function () {
      this.on('cmadr.keycode', '=', 'babps.keycmobj')
        .andOn('cmadr.keydbtbl', '=', xpandDb.raw('?', ['_RQA11RNMA']))
        .andOn('cmadr.keycmtyp', '=', xpandDb.raw('?', ['adrpost']))
    })
    .leftJoin('bafst', 'bafst.keycmobj', 'babuf.keyobjfst')
    .leftJoin('babya', 'bafst.keybabya', 'babya.keybabya')
    .where('babuf.cmpcode', '=', '001')

  const activeRentalBlocksQuery = xpandDb
    .from('hyspt')
    .select(
      'hyspt.keycmobj',
      'hyspa.caption as blocktype',
      'hyspt.fdate as blockstartdate',
      'hyspt.tdate as blockenddate'
    )
    .innerJoin('hyspa', 'hyspa.keyhyspa', 'hyspt.keyhyspa')
    .where(function () {
      this.whereNull('hyspt.fdate').orWhere(
        'hyspt.fdate',
        '<=',
        xpandDb.fn.now()
      )
    })
    .andWhere(function () {
      this.whereNull('hyspt.tdate').orWhere(
        'hyspt.tdate',
        '>',
        xpandDb.fn.now()
      )
    })

  const activeContractsQuery = xpandDb
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
        xpandDb.raw('?', [1])
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
  AdapterResult<RentalObject[], 'get-all-vacant-parking-spaces-failed'>
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
          xpandDb.fn.now()
        )
      })
      .whereNull('ac.keycmobj')
      .orderBy('ps.rentalObjectCode', 'asc')

    const listings: RentalObject[] = results.map((row) =>
      trimRow(transformFromXpandRentalObject(row))
    )
    return { ok: true, data: listings }
  } catch (err) {
    logger.error(err, 'tenantLeaseAdapter.getAllAvailableParkingSpaces')
    return { ok: false, err: 'get-all-vacant-parking-spaces-failed' }
  }
}

const getParkingSpace = async (
  rentalObjectCode: string
): Promise<
  AdapterResult<RentalObject, 'unknown' | 'parking-space-not-found'>
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
      .where('ps.rentalObjectCode', '=', rentalObjectCode)
      .first()

    if (!result) {
      logger.error(
        `Parking space not found by Rental Object Code: ${rentalObjectCode}`
      )
      return { ok: false, err: 'parking-space-not-found' }
    }

    const rentalObject = trimRow(transformFromXpandRentalObject(result))
    return { ok: true, data: rentalObject }
  } catch (err) {
    logger.error(err, 'tenantLeaseAdapter.getRentalObject')
    return { ok: false, err: 'unknown' }
  }
}

const getParkingSpaces = async (
  includeRentalObjectCodes?: string[]
): Promise<
  AdapterResult<RentalObject[], 'unknown' | 'parking-spaces-not-found'>
> => {
  try {
    const {
      parkingSpacesQuery,
      activeRentalBlocksQuery,
      activeContractsQuery,
    } = buildSubQueries()

    let query = buildMainQuery(
      parkingSpacesQuery,
      activeRentalBlocksQuery,
      activeContractsQuery
    )
    if (includeRentalObjectCodes && includeRentalObjectCodes.length) {
      query = query.whereIn('ps.rentalObjectCode', includeRentalObjectCodes)
    }

    const results = await query

    if (!results || results.length === 0) {
      logger.error(
        `No parking spaces found for rental object codes: ${includeRentalObjectCodes}`
      )
      return { ok: false, err: 'parking-spaces-not-found' }
    }

    const rentalObjects = results.map((row) =>
      trimRow(transformFromXpandRentalObject(row))
    )
    return { ok: true, data: rentalObjects }
  } catch (err) {
    logger.error(err, 'tenantLeaseAdapter.getRentalObjects')
    return { ok: false, err: 'unknown' }
  }
}

export {
  getAllVacantParkingSpaces,
  getParkingSpace,
  getParkingSpaces,
  transformFromXpandRentalObject,
}
