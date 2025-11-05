import { logger } from '@onecore/utilities'
import { RentalObject } from '@onecore/types'
import { xpandDb } from './xpandDb'
import { trimRow } from '../utils'
import { calculateMonthlyRent } from '../../helpers/rent-calculation'

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

  // Calculate monthlyRent from yearrent using shared utility
  const monthlyRent = calculateMonthlyRent(row.yearrentrows)

  // Determine vacantFrom date
  const lastDebitDate = row.lastdebitdate
  const lastBlockStartDate = row.blockstartdate
  const lastBlockEndDate = row.blockenddate
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
    vacantFrom: vacantFrom,
    districtCaption: district,
    districtCode: districtCode,
    braArea: row.braarea,
  }
}

const buildMainQuery = (queries: {
  parkingSpacesQuery: any
  activeRentalBlocksQuery?: any
  activeContractsQuery?: any
  rentalBlockDatesQuery?: any
  contractsWithLastDebitDate?: any
}) => {
  let query = xpandDb
    .from(queries.parkingSpacesQuery.as('ps'))
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

  if (queries.activeRentalBlocksQuery && queries.activeContractsQuery) {
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
      .leftJoin(
        queries.activeRentalBlocksQuery.as('rb'),
        'rb.keycmobj',
        'ps.keycmobj'
      )
      .leftJoin(
        queries.activeContractsQuery.as('ac'),
        'ac.keycmobj',
        'ps.keycmobj'
      )
  }

  if (queries.rentalBlockDatesQuery) {
    query = query
      .select('orb.blockstartdate', 'orb.blockenddate')
      .leftJoin(queries.rentalBlockDatesQuery, 'orb.keycmobj', 'ps.keycmobj')
  }

  if (queries.contractsWithLastDebitDate) {
    query = query
      .select(
        'ac.contractid',
        'ac.fromdate as contractfromdate',
        'ac.todate as contracttodate',
        'ac.lastdebitdate',
        'rent.yearrentrows',
        'cmvalbar.value as braarea'
      )
      .leftJoin(
        queries.contractsWithLastDebitDate.as('ac'),
        'ac.keycmobj',
        'ps.keycmobj'
      )
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
    .where('babuf.cmpcode', '=', '001') //only gets parking spaces with company code 001

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

  //query that gets active contracts
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
    //contract types to include
    .whereIn('hyobj.keyhyobt', ['3', '5', '_1WP0JXVK8', '_1WP0KDMOO'])
    .whereNull('hyobj.makuldatum')
    .andWhere('hyobj.deletemark', '=', 0)
    .whereNull('hyobj.sistadeb')

  //query that gets contracts with lastdebitdate
  const contractsWithLastDebitDate = xpandDb
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
    //contract types to include
    .whereIn('hyobj.keyhyobt', ['3', '5', '_1WP0JXVK8', '_1WP0KDMOO'])
    .whereNull('hyobj.makuldatum')
    .andWhere('hyobj.deletemark', '=', 0)
    //pick the last debit date from the contracts
    .whereRaw(
      `hyobj.sistadeb = (
    SELECT MAX(h2.sistadeb)
    FROM hyobj h2
    INNER JOIN hykop h2kop ON h2kop.keyhyobj = h2.keyhyobj AND h2kop.ordning = ?
    INNER JOIN hyinf h2inf ON h2inf.keycmobj = h2kop.keycmobj
    WHERE h2inf.keycmobj = hyinf.keycmobj
      AND h2.keyhyobt IN (?, ?, ?, ?)
      AND h2.makuldatum IS NULL
      AND h2.deletemark = 0
  )`,
      [1, '3', '5', '_1WP0JXVK8', '_1WP0KDMOO']
    )

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
    parkingSpacesQuery,
    activeRentalBlocksQuery,
    activeContractsQuery,
    contractsWithLastDebitDate,
    rentalBlockDatesQuery,
  }
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

    const results = await buildMainQuery({
      parkingSpacesQuery,
      activeRentalBlocksQuery,
      activeContractsQuery,
    })
      .where(function () {
        this.whereNull('rb.keycmobj').orWhere(
          'rb.blockenddate',
          '<=',
          xpandDb.fn.now()
        )
      })
      //exclude parking spaces with active contracts
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
      contractsWithLastDebitDate,
      rentalBlockDatesQuery,
    } = buildSubQueries()

    const mainQuery = buildMainQuery({
      parkingSpacesQuery,
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
      parkingSpacesQuery,
      contractsWithLastDebitDate,
      rentalBlockDatesQuery,
    } = buildSubQueries()

    let query = buildMainQuery({
      parkingSpacesQuery,
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

    if (
      includeRentalObjectCodes &&
      results.length < includeRentalObjectCodes.length
    ) {
      logger.error(
        {
          includeRentalObjectCodes: includeRentalObjectCodes.filter(
            (code) => !results.some((row) => row.rentalObjectCode === code)
          ),
        },
        `Some rental object codes could not be found (the rest will be returned)`
      )
    }

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

export {
  getAllVacantParkingSpaces,
  getParkingSpace,
  getParkingSpaces,
  transformFromXpandRentalObject,
}
