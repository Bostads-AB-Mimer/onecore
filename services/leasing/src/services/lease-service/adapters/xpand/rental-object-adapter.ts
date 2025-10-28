import { logger } from '@onecore/utilities'
import { RentalObject } from '@onecore/types'
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

  // Determine if parking space is in special residential areas or properties
  const isSpecialResidentialArea = ['CEN', 'OXB', 'GRY'].includes(
    row.residentialareacode?.trim()
  )
  const isSpecialProperty = ['24104', '23001', '23002', '23003'].includes(
    row.estatecode?.trim() || ''
  )
  // Determine vacantFrom date
  const lastDebitDate = row.lastdebitdate
  const lastBlockStartDate = row.blockstartdate?.length
    ? row.blockstartdate[row.blockstartdate.length - 1]
    : row.blockstartdate
  const lastBlockEndDate = row.blockenddate?.length
    ? row.blockenddate[row.blockenddate.length - 1]
    : row.blockenddate
  let vacantFrom
  if (lastBlockEndDate && lastBlockEndDate >= new Date()) {
    //if the object is blocked to a date in the future, vacantFrom should be the day after
    vacantFrom = new Date(lastBlockEndDate)
    vacantFrom.setUTCDate(vacantFrom.getUTCDate() + 1)
    vacantFrom.setUTCHours(0, 0, 0, 0) // Set to start of the day UTC
  } else if (lastBlockStartDate && !lastBlockEndDate) {
    //if there is a block but no end date, vacantFrom should be undefined
    vacantFrom = undefined
  } else if (lastDebitDate) {
    //if there is no block but a last debit date, vacantFrom should be the day after
    vacantFrom = new Date(lastDebitDate)
    vacantFrom.setUTCDate(vacantFrom.getUTCDate() + 1)
    vacantFrom.setUTCHours(0, 0, 0, 0) // Set to start of the day UTC
  } else {
    //there is no block and no last debit date, the parking space is vacant as of today
    vacantFrom = new Date()
    vacantFrom.setUTCHours(0, 0, 0, 0) // Set to start of the day UTC
  }

  //TODO: Lägg till rentalObjectTypeCode och rentalObjectTypeCaption i transformeringen för lägenheter när vi uppdaterat modellen

  return {
    rentalObjectCode: row.rentalObjectCode,
    address: row.postaladdress,
    monthlyRent: monthlyRent,
    propertyCaption: row.estatecaption,
    propertyCode: row.estatecode,
    residentialAreaCode: row.residentialareacode,
    residentialAreaCaption: row.residentialareacaption,
    objectTypeCaption: row.vehiclespacetypecaption ?? row.apartmenttypecaption,
    objectTypeCode: row.vehiclespacetypecode ?? row.apartmenttypecode,
    vacantFrom: vacantFrom,
    districtCaption: district,
    districtCode: districtCode,
    braArea: row.braarea,
    isSpecialResidentialArea: isSpecialResidentialArea,
    isSpecialProperty: isSpecialProperty,
  }
}

const buildMainQuery = (queries: {
  rentalObjectQuery: {
    query: any
    columns?: string[]
  }
  activeRentalBlocksQuery?: any
  activeContractsQuery?: any
  rentalBlockDatesQuery?: any
  contractsWithLastDebitDate?: any
}) => {
  const baseColumns = [
    'ps.rentalObjectCode',
    'ps.estatecode',
    'ps.estatecaption',
    'ps.postaladdress',
    'ps.zipcode',
    'ps.city',
    'ps.scegcaption',
    'ps.residentialareacode',
    'ps.residentialareacaption',
  ]
  const rentalObjectColumns = [
    ...baseColumns,
    ...(queries.rentalObjectQuery.columns || []),
  ]

  let query = xpandDb
    .from(queries.rentalObjectQuery.query.as('ps'))
    .select(rentalObjectColumns)

  if (queries.activeContractsQuery) {
    query = query
      .select(
        'ac.lastdebitdate',
        'rent.yearrentrows',
        'cmvalbar.value as braarea'
      )
      .leftJoin(
        queries.activeContractsQuery.as('ac'),
        'ac.keycmobj',
        'ps.keycmobj'
      )
  } else if (queries.contractsWithLastDebitDate) {
    query = query
      .select(
        'ac.lastdebitdate',
        'rent.yearrentrows',
        'cmvalbar.value as braarea'
      )
      .leftJoin(
        queries.contractsWithLastDebitDate,
        'ac.keycmobj',
        'ps.keycmobj'
      )
  }

  if (queries.rentalBlockDatesQuery) {
    query = query
      .select('orb.blockstartdate', 'orb.blockenddate')
      .leftJoin(queries.rentalBlockDatesQuery, 'orb.keycmobj', 'ps.keycmobj')
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
      //flytta ev denna till mainQuery istället om bra bara ska hämtas för parkeringar eller om vi ska hämta andra värden för lägenheter också
      xpandDb('cmval as cmvalbar')
        .select('cmvalbar.keycode', 'cmvalbar.value')
        .where('cmvalbar.keycmvat', 'BRA')
        .as('cmvalbar'),
      'cmvalbar.keycode',
      'ps.keycmobj'
    )
}

const buildSubQueries = () => {
  const parkingSpaceColumns = [
    'ps.vehiclespacetypecode',
    'ps.vehiclespacetypecaption',
  ]
  const parkingSpacesQuery = xpandDb
    .from('babps')
    .select(
      'babps.keycmobj',
      'babuf.hyresid as rentalObjectCode',
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
    .where('babuf.cmpcode', '=', '001') //only gets parking spaces with company code 001

  const apartmentColumns = [
    'ps.apartmenttypecode',
    'ps.apartmenttypecaption',
    'ps.rentalobjecttypecode',
    'ps.rentalobjecttypecaption',
  ]
  const apartmentQuery = xpandDb
    .from('balgh')
    .select(
      'balgh.keycmobj',
      'babuf.hyresid as rentalObjectCode',
      'babuf.fencaption as scegcaption', //used for district extraction
      'babuf.fstcode as estatecode',
      'babuf.fstcaption as estatecaption',
      'balgt.code as apartmenttypecode',
      'balgt.caption as apartmenttypecaption',
      'cmadr.adress1 as postaladdress',
      'cmadr.adress2 as street',
      'cmadr.adress3 as zipcode',
      'cmadr.adress4 as city',
      'babya.code as residentialareacode',
      'babya.caption as residentialareacaption',
      'hyint.code as rentalobjecttypecode',
      'hyint.caption as rentalobjecttypecaption'
    )
    .innerJoin('babuf', 'babuf.keycmobj', 'balgh.keycmobj')
    .innerJoin('balgt', 'balgt.keybalgt', 'balgh.keybalgt')
    .innerJoin('hyinf', 'hyinf.keycmobj', 'balgh.keycmobj')
    .innerJoin('hyint', 'hyint.keyhyint', 'hyinf.keyhyint')
    .leftJoin('cmadr', function () {
      this.on('cmadr.keycode', '=', 'balgh.keycmobj')
        .andOn('cmadr.keydbtbl', '=', xpandDb.raw('?', ['_RQA11RNMA']))
        .andOn('cmadr.keycmtyp', '=', xpandDb.raw('?', ['adrpost']))
    })
    .leftJoin('bafst', 'bafst.keycmobj', 'babuf.keyobjfst')
    .leftJoin('babya', 'bafst.keybabya', 'babya.keybabya')
    .where('babuf.cmpcode', '=', '001') //only gets apartments with company code 001
    .whereNotIn('hyint.code', ['STUD', 'NATT', 'BLOCK', 'AVS']) //only get apartments that are not student, night, BLOCK or AVS

  const apartmentDetailsColumns = [
    ...apartmentColumns,
    'ps.shortstay',
    'ps.floor',
    'ps.elevator',
    'ps.nonsmoking',
    'ps.yearofconstruction',
    'ps.apartmentattribute',
  ]
  const apartmentDetailsQuery = xpandDb
    .from('balgh')
    .select(
      'balgh.keycmobj',
      'babuf.hyresid as rentalObjectCode',
      'babuf.fencaption as scegcaption', //used for district extraction
      'babuf.fstcode as estatecode',
      'babuf.fstcaption as estatecaption',
      'balgt.code as apartmenttypecode',
      'balgt.caption as apartmenttypecaption',
      'cmadr.adress1 as postaladdress',
      'cmadr.adress2 as street',
      'cmadr.adress3 as zipcode',
      'cmadr.adress4 as city',
      'babya.code as residentialareacode',
      'babya.caption as residentialareacaption',
      'hyint.code as rentalobjecttypecode',
      'hyint.caption as rentalobjecttypecaption',
      'balgh.uppgang as floor',
      'balgh.hiss as elevator',
      'balgh.smokefree as nonsmoking',
      'hyinf.shortstay as shortstay', // how to get info on "korttidsboende" when it's not in rentalobjecttypecode
      'babyg.byggnadsar as yearofconstruction',
      'hyegn.caption as apartmentattribute'
    )
    .innerJoin('babuf', 'babuf.keycmobj', 'balgh.keycmobj')
    .innerJoin('balgt', 'balgt.keybalgt', 'balgh.keybalgt')
    .innerJoin('babyg', 'babyg.keycmobj', 'babuf.keyobjbyg')
    .innerJoin('hyinf', 'hyinf.keycmobj', 'balgh.keycmobj')
    .innerJoin('hyint', 'hyint.keyhyint', 'hyinf.keyhyint')
    .leftJoin('hyegk', 'hyegk.keycode', 'balgh.keycmobj')
    .leftJoin('hyegn', 'hyegn.keyhyegn', 'hyegk.keyhyegn')
    .leftJoin('cmadr', function () {
      this.on('cmadr.keycode', '=', 'balgh.keycmobj')
        .andOn('cmadr.keydbtbl', '=', xpandDb.raw('?', ['_RQA11RNMA']))
        .andOn('cmadr.keycmtyp', '=', xpandDb.raw('?', ['adrpost']))
    })
    .leftJoin('bafst', 'bafst.keycmobj', 'babuf.keyobjfst')
    .leftJoin('babya', 'bafst.keybabya', 'babya.keybabya')
    .where('babuf.cmpcode', '=', '001') //only gets apartments with company code 001
    .whereNotIn('hyint.code', ['STUD', 'NATT', 'BLOCK', 'AVS']) //only get apartments that are not student, night, BLOCK or AVS

  //query that gets active contracts
  const activeContractsQuery = xpandDb
    .from('hyobj')
    .select(
      'hyinf.keycmobj',
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
    //contract types to include
    .whereIn('hyobj.keyhyobt', ['3', '5', '_1WP0JXVK8', '_1WP0KDMOO'])
    .whereNull('hyobj.makuldatum')
    .andWhere('hyobj.deletemark', '=', 0)
    .whereNull('hyobj.sistadeb')

  //query that gets contracts with lastdebitdate
  const contractsWithLastDebitDate = xpandDb.raw(`
  (
    SELECT sub.keycmobj, sub.contractdate, sub.fromdate, sub.todate, sub.lastdebitdate
    FROM (
      SELECT
        hyinf.keycmobj,
        hyobj.avtalsdat as contractdate,
        hyobj.fdate as fromdate,
        hyobj.tdate as todate,
        hyobj.sistadeb as lastdebitdate,
        ROW_NUMBER() OVER (
          PARTITION BY hyinf.keycmobj
          ORDER BY hyobj.sistadeb DESC
        ) as rn
      FROM hyobj
      INNER JOIN hykop ON hykop.keyhyobj = hyobj.keyhyobj AND hykop.ordning = 1
      INNER JOIN hyinf ON hyinf.keycmobj = hykop.keycmobj
      WHERE hyobj.keyhyobt IN ('3', '5', '_1WP0JXVK8', '_1WP0KDMOO')
        AND hyobj.makuldatum IS NULL
        AND hyobj.deletemark = 0
        AND hyobj.sistadeb IS NOT NULL
    ) AS sub
    WHERE sub.rn = 1
  ) AS ac
`)

  //query that gets the block with the last block date. If there is a block without blockenddate, it will return NULL for blockenddate
  const rentalBlockDatesQuery = xpandDb.raw(`
    (
      SELECT sub.keycmobj, sub.fdate AS blockstartdate, sub.tdate AS blockenddate
      FROM (
        SELECT
          hyspt.keycmobj,
          hyspt.fdate,
          hyspt.tdate,
          ROW_NUMBER() OVER (
            PARTITION BY hyspt.keycmobj
            ORDER BY CASE WHEN hyspt.tdate IS NULL THEN 1 ELSE 0 END DESC, hyspt.tdate DESC
          ) AS rn
        FROM hyspt
        INNER JOIN hyspa ON hyspa.keyhyspa = hyspt.keyhyspa
      ) AS sub
      WHERE sub.rn = 1
    ) AS orb
  `)

  return {
    parkingSpaceQuery: {
      query: parkingSpacesQuery,
      column: parkingSpaceColumns,
    },
    apartmentQuery: {
      query: apartmentQuery,
      columns: apartmentColumns,
    },
    apartmentDetailsQuery: {
      query: apartmentDetailsQuery,
      columns: apartmentDetailsColumns,
    },
    activeContractsQuery,
    contractsWithLastDebitDate,
    rentalBlockDatesQuery,
  }
}

const getAllVacantApartments = async (): Promise<
  AdapterResult<RentalObject[], 'get-all-vacant-apartments-failed'>
> => {
  try {
    const { apartmentQuery, activeContractsQuery, rentalBlockDatesQuery } =
      buildSubQueries()

    const query = buildMainQuery({
      rentalObjectQuery: apartmentQuery,
      activeContractsQuery,
      rentalBlockDatesQuery,
    })
      //exclude parking spaces with a blocks that has no end date
      .where(function () {
        this.whereNull('orb.keycmobj').orWhereNotNull('orb.blockenddate')
      })
      //exclude parking spaces with active contracts
      .whereNull('ac.keycmobj')
      .orderBy('ps.rentalObjectCode', 'asc')

    const results = await query

    //todo: transform to apartment instead of rentalObject
    const listings: RentalObject[] = results.map((row) =>
      trimRow(transformFromXpandRentalObject(row))
    )

    return { ok: true, data: listings }
  } catch (err) {
    logger.error(err, 'tenantLeaseAdapter.getAllAvailableParkingSpaces')
    return { ok: false, err: 'get-all-vacant-apartments-failed' }
  }
}

const getAllVacantParkingSpaces = async (): Promise<
  AdapterResult<RentalObject[], 'get-all-vacant-parking-spaces-failed'>
> => {
  try {
    const { parkingSpaceQuery, activeContractsQuery, rentalBlockDatesQuery } =
      buildSubQueries()

    const query = buildMainQuery({
      rentalObjectQuery: parkingSpaceQuery,
      activeContractsQuery,
      rentalBlockDatesQuery,
    })
      //exclude parking spaces with a blocks that has no end date
      .where(function () {
        this.whereNull('orb.keycmobj').orWhereNotNull('orb.blockenddate')
      })
      //exclude parking spaces with active contracts
      .whereNull('ac.keycmobj')
      .orderBy('ps.rentalObjectCode', 'asc')

    const results = await query
    //todo: transform to parkingSpace instead of rentalObject
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
      parkingSpaceQuery,
      contractsWithLastDebitDate,
      rentalBlockDatesQuery,
    } = buildSubQueries()

    const mainQuery = buildMainQuery({
      rentalObjectQuery: parkingSpaceQuery,
      contractsWithLastDebitDate,
      rentalBlockDatesQuery,
    })
      .where('ps.rentalObjectCode', '=', rentalObjectCode)
      .first()

    const result = await mainQuery

    if (!result) {
      logger.error(
        { rentalObjectCode },
        'Parking space not found by Rental Object Code'
      )
      return { ok: false, err: 'parking-space-not-found' }
    }

    //todo: transform to parkingSpace instead of rentalObject
    const rentalObject = trimRow(transformFromXpandRentalObject(result))
    return { ok: true, data: rentalObject }
  } catch (err) {
    logger.error(
      { err, rentalObjectCode },
      'Unknown error in rentalObjectAdapter.getRentalObject'
    )
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
      parkingSpaceQuery,
      contractsWithLastDebitDate,
      rentalBlockDatesQuery,
    } = buildSubQueries()

    let query = buildMainQuery({
      rentalObjectQuery: parkingSpaceQuery,
      contractsWithLastDebitDate,
      rentalBlockDatesQuery,
    })
    if (includeRentalObjectCodes && includeRentalObjectCodes.length) {
      query = query.whereIn('ps.rentalObjectCode', includeRentalObjectCodes)
    }

    const results = await query

    if (!results || results.length === 0) {
      logger.error(
        { includeRentalObjectCodes: includeRentalObjectCodes },
        `No parking spaces found for rental object codes`
      )
      return { ok: false, err: 'parking-spaces-not-found' }
    }

    // Calculate if any codes were not found and write an error log
    if (includeRentalObjectCodes && includeRentalObjectCodes.length) {
      const uniqueIncludeCodes = [...new Set(includeRentalObjectCodes)]
      const foundCodes = results.map((row) => row.rentalObjectCode)

      if (foundCodes.length < uniqueIncludeCodes.length) {
        const missingCodes = uniqueIncludeCodes.filter(
          (code) => !foundCodes.includes(code)
        )
        if (missingCodes.length > 0) {
          logger.error(
            { includeRentalObjectCodes: missingCodes },
            `${missingCodes.length} rental object codes could not be found (the rest will be returned)`
          )
        }
      }
    }

    //todo: transform to parkingSpace instead of rentalObject
    const rentalObjects = results.map((row) =>
      trimRow(transformFromXpandRentalObject(row))
    )
    return { ok: true, data: rentalObjects }
  } catch (err) {
    logger.error(
      { err, includeRentalObjectCodes },
      'Unknown error in rentalObjectAdapter.getRentalObjects'
    )
    return { ok: false, err: 'unknown' }
  }
}

function aggregateApartmentAttributes(rows: any[]): any {
  if (!Array.isArray(rows) || rows.length === 0) return rows
  const firstRow = { ...rows[0] }
  firstRow.apartmentattribute = rows
    .map((row) => row.apartmentattribute?.trim())
    .filter((attr) => !!attr)
  return firstRow
}

const getApartment = async (
  rentalObjectCode: string
): Promise<AdapterResult<RentalObject, 'unknown' | 'apartment-not-found'>> => {
  try {
    const {
      apartmentDetailsQuery,
      contractsWithLastDebitDate,
      rentalBlockDatesQuery,
    } = buildSubQueries()

    const mainQuery = buildMainQuery({
      rentalObjectQuery: apartmentDetailsQuery,
      contractsWithLastDebitDate,
      rentalBlockDatesQuery,
    }).where('ps.rentalObjectCode', '=', rentalObjectCode)

    let result = await mainQuery

    if (!result) {
      logger.error(
        { rentalObjectCode },
        'Apartment not found by Rental Object Code'
      )
      return { ok: false, err: 'apartment-not-found' }
    }

    if (Array.isArray(result)) {
      result = aggregateApartmentAttributes(result)
    }

    //todo: transform to apartmentDetails instead of rentalObject
    const rentalObject = trimRow(transformFromXpandRentalObject(result))
    return { ok: true, data: rentalObject }
  } catch (err) {
    logger.error(
      { err, rentalObjectCode },
      'Unknown error in rentalObjectAdapter.getRentalObject'
    )
    return { ok: false, err: 'unknown' }
  }
}

export {
  getAllVacantParkingSpaces,
  getAllVacantApartments,
  getParkingSpace,
  getParkingSpaces,
  getApartment,
  transformFromXpandRentalObject,
}
