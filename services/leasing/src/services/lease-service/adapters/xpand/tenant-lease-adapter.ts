import { Lease, Contact, WaitingList, WaitingListType } from '@onecore/types'
import transformFromXPandDb from './../../helpers/transformFromXPandDb'

import { logger, paginate, PaginatedResponse } from '@onecore/utilities'
import { Context } from 'koa'
import { AdapterResult } from '../types'
import { xpandDb } from './xpandDb'
import { trimRow } from '../utils'

interface GetLeasesOptions {
  includeUpcomingLeases: boolean
  includeTerminatedLeases: boolean
  includeContacts: boolean
  includeRentInfo?: boolean // defaults to true for backwards compatibility
}

type PartialLease = {
  leaseId: Lease['leaseId']
  leaseStartDate: Lease['leaseStartDate']
  lastDebitDate: Lease['lastDebitDate']
  terminationDate: Lease['terminationDate']
}

const calculateQueuePoints = (queueTime: Date): number => {
  const stripDate = (date: Date): Date => {
    return new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    )
  }

  return (
    (stripDate(new Date()).getTime() - stripDate(queueTime).getTime()) /
    (1000 * 3600 * 24)
  )
}

const getParkingSpaceWaitingList = (
  rows: Array<any>
): WaitingList | undefined => {
  const parkingSpaceQueueTime =
    rows
      .filter((r) => r.queueName == 'Bilplats (intern)')
      .map((r) => r.queueTime)
      .shift() ?? undefined

  if (parkingSpaceQueueTime)
    return {
      queueTime: parkingSpaceQueueTime,
      queuePoints: calculateQueuePoints(parkingSpaceQueueTime),
      type: WaitingListType.ParkingSpace,
    }
}

const getHousingWaitingList = (rows: Array<any>): WaitingList | undefined => {
  const housingQueueTime =
    rows
      .filter((r) => r.queueName == 'Bostad')
      .map((r) => r.queueTime)
      .shift() ?? undefined

  if (housingQueueTime)
    return {
      queueTime: housingQueueTime,
      queuePoints: calculateQueuePoints(housingQueueTime),
      type: WaitingListType.Housing,
    }
}

const getStorageWaitingList = (rows: Array<any>): WaitingList | undefined => {
  const storageQueueTime =
    rows
      .filter((r) => r.queueName == 'Förråd (intern)')
      .map((r) => r.queueTime)
      .shift() ?? undefined

  if (storageQueueTime)
    return {
      queueTime: storageQueueTime,
      queuePoints: calculateQueuePoints(storageQueueTime),
      type: WaitingListType.Storage,
    }
}

const transformFromDbContact = (
  rows: Array<any>,
  phoneNumbers: any,
  leases: any
): Contact => {
  const row = trimRow(rows[0])
  const protectedIdentity = row.protectedIdentity !== null

  const contact = {
    contactCode: row.contactCode,
    contactKey: row.contactKey,
    firstName: protectedIdentity ? undefined : row.firstName,
    lastName: protectedIdentity ? undefined : row.lastName,
    fullName: protectedIdentity ? undefined : row.fullName,
    leaseIds: leases,
    nationalRegistrationNumber: protectedIdentity
      ? undefined
      : row.nationalRegistrationNumber,
    birthDate: protectedIdentity ? undefined : row.birthDate,
    address: {
      street: row.street,
      number: '',
      postalCode: row.postalCode,
      city: row.city,
    },
    phoneNumbers: phoneNumbers,
    emailAddress:
      process.env.NODE_ENV === 'production'
        ? row.emailAddress == null || protectedIdentity
          ? undefined
          : row.emailAddress
        : 'redacted',
    isTenant: leases.length > 0,
    parkingSpaceWaitingList: getParkingSpaceWaitingList(rows),
    housingWaitingList: getHousingWaitingList(rows),
    storageWaitingList: getStorageWaitingList(rows),
    specialAttention: !!row.specialAttention,
  }

  return contact
}

const getLease = async (
  leaseId: string,
  includeContacts: string | string[] | undefined
): Promise<Lease | undefined> => {
  logger.info({ leaseId }, 'Getting lease Xpand DB')
  const rows = await getLeaseById(leaseId)
  if (rows.length > 0) {
    logger.info({ leaseId }, 'Getting lease Xpand DB complete')
    if (includeContacts) {
      const tenants = await getContactsByLeaseId(leaseId)
      return transformFromXPandDb.toLease(rows[0], [], tenants)
    } else {
      return transformFromXPandDb.toLease(rows[0], [], [])
    }
  }

  logger.info({ leaseId }, 'Getting lease Xpand DB complete - no lease found')
  return undefined
}

const getLeasesForNationalRegistrationNumber = async (
  nationalRegistrationNumber: string,
  options: GetLeasesOptions
) => {
  logger.info('Getting leases for national registration number from Xpand DB')
  const contact = await xpandDb
    .from('cmctc')
    .select('cmctc.keycmctc as contactKey')
    .limit(1)
    .where({
      persorgnr: nationalRegistrationNumber,
    })
    .limit(1)

  if (contact != undefined && contact.length > 0) {
    let leases = await getLeasesByContactKey(contact[0].contactKey)

    logger.info(
      'Getting leases for national registration number from Xpand DB complete'
    )

    leases = filterLeasesByOptions(leases, options)

    if (options.includeContacts) {
      for (const lease of leases) {
        const tenants = await getContactsByLeaseId(lease.leaseId)
        lease.tenants = tenants
      }
    }

    return leases
  }

  logger.info(
    'Getting leases for national registration number from Xpand DB complete - no leases found'
  )
  return undefined
}

const getLeasesForContactCode = async (
  contactCode: string,
  options: GetLeasesOptions
): Promise<AdapterResult<Array<Lease>, unknown>> => {
  logger.info({ contactCode }, 'Getting leases for contact code from Xpand DB')
  try {
    const contact = await xpandDb
      .from('cmctc')
      .select('cmctc.keycmctc as contactKey')
      .limit(1)
      .where({
        cmctckod: contactCode,
      })
      .limit(1)

    //todo: assert actual string value, now undefined equals false and every other value true
    if (contact != undefined) {
      logger.info(
        { contactCode },
        'Getting leases for contact code from Xpand DB complete'
      )

      let leases = await getLeasesByContactKey(contact[0].contactKey)

      leases = filterLeasesByOptions(leases, options)

      if (options.includeContacts) {
        for (const lease of leases) {
          const tenants = await getContactsByLeaseId(lease.leaseId)
          lease.tenants = tenants
        }
      }

      return { ok: true, data: leases }
    }

    logger.info(
      { contactCode },
      'Getting leases for contact code from Xpand DB complete - no leases found'
    )

    return { ok: true, data: [] }
  } catch (err) {
    logger.error(err, 'tenantLeaseAdapter.getLeasesForContactCode')
    return { ok: false, err }
  }
}

const getLeasesForPropertyId = async (
  propertyId: string,
  options: GetLeasesOptions
) => {
  let leases: Lease[] = []
  const includeRentInfo = options.includeRentInfo !== false

  const baseColumns = [
    'hyobj.hyobjben as leaseId',
    'hyhav.hyhavben as leaseType',
    'hyobj.uppsagtav as noticeGivenBy',
    'hyobj.avtalsdat as contractDate',
    'hyobj.sistadeb as lastDebitDate',
    'hyobj.godkdatum as approvalDate',
    'hyobj.uppsdatum as noticeDate',
    'hyobj.fdate as fromDate',
    'hyobj.tdate as toDate',
    'hyobj.uppstidg as noticeTimeTenant',
    'hyobj.onskflytt AS preferredMoveOutDate',
    'hyobj.makuldatum AS terminationDate',
  ]

  let query = xpandDb
    .from('hyobj')
    .select(
      includeRentInfo ? [...baseColumns, 'rent.totalYearRent'] : baseColumns
    )
    .innerJoin('hyhav', 'hyhav.keyhyhav', 'hyobj.keyhyhav')

  if (includeRentInfo) {
    query = query.leftJoin(
      xpandDb.raw(`
        (
          SELECT rentalpropertyid, SUM(yearrent) as totalYearRent
          FROM hy_debitrowrentalproperty_xpand_api
          GROUP BY rentalpropertyid
        ) as rent
      `),
      'rent.rentalpropertyid',
      xpandDb.raw(`
        CASE
          WHEN CHARINDEX('/', hyobj.hyobjben) > 0
          THEN SUBSTRING(hyobj.hyobjben, 1, CHARINDEX('/', hyobj.hyobjben) - 1)
          ELSE hyobj.hyobjben
        END
      `)
    )
  }

  const rows = await query
    .where('hyobj.hyobjben', 'like', `%${propertyId}%`)
    .whereNotNull('hyobj.fdate')

  for (const row of rows) {
    const lease = transformFromXPandDb.toLease(row, [], [])
    leases.push(lease)
  }

  leases = filterLeasesByOptions(leases, options)

  if (options.includeContacts) {
    if (leases.length === 1) {
      // Sequential is faster for single lease (~120ms vs ~200ms)
      leases[0].tenants = await getContactsByLeaseId(leases[0].leaseId)
    } else {
      // Batched is faster for multiple leases (~300ms vs ~600ms for 5 leases)
      const leaseIds = leases.map((l) => l.leaseId)
      const contactsByLeaseId = await getContactsForLeaseIds(leaseIds)
      leases.forEach((lease) => {
        lease.tenants = contactsByLeaseId.get(lease.leaseId) ?? []
      })
    }
  }

  return leases
}

const getContactsForLeaseIds = async (
  leaseIds: string[]
): Promise<Map<string, Contact[]>> => {
  if (leaseIds.length === 0) {
    return new Map()
  }

  const leaseContactRows = await xpandDb
    .from('hyavk')
    .select('hyavk.keycmctc as contactKey', 'hyobj.hyobjben as leaseId')
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .whereIn('hyobj.hyobjben', leaseIds)

  const contactKeys = [
    ...new Set(leaseContactRows.map((r) => r.contactKey as string)),
  ]

  if (contactKeys.length === 0) {
    return new Map()
  }

  const contactRows = await getContactQuery().whereIn(
    'cmctc.keycmctc',
    contactKeys
  )

  const keycmobjs = [...new Set(contactRows.map((r) => r.keycmobj as string))]
  const phoneRows = await xpandDb
    .from('cmtel')
    .select(
      'keycmobj',
      'cmtelben as phoneNumber',
      'keycmtet as type',
      'main as isMainNumber'
    )
    .whereIn('keycmobj', keycmobjs)

  // Build lookup maps
  const phonesByKeycmobj = new Map<string, typeof phoneRows>()
  for (const row of phoneRows) {
    const key = row.keycmobj as string
    if (!phonesByKeycmobj.has(key)) {
      phonesByKeycmobj.set(key, [])
    }
    phonesByKeycmobj.get(key)!.push(trimRow(row))
  }

  // Group contact rows by contactKey (may have duplicates from joins)
  const contactRowsByKey = new Map<string, (typeof contactRows)[0]>()
  for (const row of contactRows) {
    const key = row.contactKey as string
    if (!contactRowsByKey.has(key)) {
      contactRowsByKey.set(key, row)
    }
  }

  // Build contacts by contactKey
  const contactsByKey = new Map<string, Contact>()
  for (const [contactKey, row] of contactRowsByKey) {
    const phoneNumbers = phonesByKeycmobj.get(row.keycmobj as string) ?? []
    contactsByKey.set(
      contactKey,
      transformFromDbContact([row], phoneNumbers, [])
    )
  }

  // Map contacts to leases
  const result = new Map<string, Contact[]>()
  for (const leaseId of leaseIds) {
    result.set(leaseId, [])
  }
  for (const { leaseId, contactKey } of leaseContactRows) {
    const contact = contactsByKey.get(contactKey as string)
    if (contact) {
      result.get(leaseId as string)!.push(contact)
    }
  }

  return result
}

const getResidentialAreaByRentalPropertyId = async (
  rentalPropertyId: string
): Promise<AdapterResult<{ code: any; caption: any } | undefined, unknown>> => {
  try {
    const rows = await xpandDb
      .from('babya')
      .select('babya.code', 'babya.caption')
      .innerJoin('bafst', 'bafst.keybabya', 'babya.keybabya')
      .innerJoin('babuf', 'bafst.keycmobj', 'babuf.keyobjfst')
      .where('babuf.hyresid', rentalPropertyId)
      .limit(1)

    if (!rows?.length) {
      return { ok: true, data: undefined }
    }
    //remove whitespaces from xpand and return
    return {
      ok: true,
      data: {
        code: rows[0].code.replace(/\s/g, ''),
        caption: rows[0].caption.replace(/\s/g, ''),
      },
    }
  } catch (err) {
    logger.error(err, 'tenantLeaseAdapter.getResidentialAreaByRentalPropertyId')
    return { ok: false, err }
  }
}

const getContactsDataBySearchQuery = async (
  q: string
): Promise<
  AdapterResult<
    Array<{ contactCode: string; fullName: string }>,
    'internal-error'
  >
> => {
  try {
    const isEmailSearch = q.includes('@')

    if (isEmailSearch) {
      // Email search only
      const rows = await xpandDb
        .from('cmctc')
        .select('cmctc.cmctckod as contactCode', 'cmctc.cmctcben as fullName')
        .where(
          'cmctc.keycmobj',
          'in',
          xpandDb
            .select('keycmobj')
            .from('cmeml')
            .where('cmemlben', 'like', `${q}%`)
        )
        .limit(10)

      return {
        ok: true,
        data: rows,
      }
    }

    // Name/code/PNR search
    const searchTerms = q
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .map((word) => `"${word}*"`)
      .join(' AND ')

    const rows = await xpandDb
      .from('cmctc')
      .select('cmctc.cmctckod as contactCode', 'cmctc.cmctcben as fullName')
      .where('cmctc.deletemark', '=', '0')
      .where((builder) => {
        builder.where('cmctc.cmctckod', 'like', `${q}%`)
        builder.orWhere('cmctc.persorgnr', 'like', `${q}%`)
        if (searchTerms) {
          builder.orWhereRaw('CONTAINS(cmctc.cmctcben, ?)', [searchTerms])
        }
      })
      .limit(10)

    return {
      ok: true,
      data: rows,
    }
  } catch (err) {
    logger.error({ err }, 'tenant-lease-adapter.getContactsDataBySearchQuery')
    return {
      ok: false,
      err: 'internal-error',
    }
  }
}

/**
 * Paginated contact search
 * @param q - Search query string
 * @param ctx - Koa context for pagination params
 * @returns Paginated response with contacts
 */
const searchContactsPaginated = async (
  q: string,
  ctx: Context
): Promise<PaginatedResponse<{ contactCode: string; fullName: string }>> => {
  const isEmailSearch = q.includes('@')

  if (isEmailSearch) {
    const query = xpandDb
      .from('cmctc')
      .select('cmctc.cmctckod as contactCode', 'cmctc.cmctcben as fullName')
      .where(
        'cmctc.keycmobj',
        'in',
        xpandDb
          .select('keycmobj')
          .from('cmeml')
          .where('cmemlben', 'like', `${q}%`)
      )

    return paginate(query, ctx)
  }

  // Split into terms - all must match name (AND), or match contactCode/persorgnr
  const searchTerms = q
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)

  const query = xpandDb
    .from('cmctc')
    .select('cmctc.cmctckod as contactCode', 'cmctc.cmctcben as fullName')
    .where('cmctc.deletemark', '=', '0')
    .where((builder) => {
      builder.where('cmctc.cmctckod', 'like', `${q}%`)
      builder.orWhere('cmctc.persorgnr', 'like', `${q}%`)
      // Name search - all terms must match
      builder.orWhere((builder) => {
        for (const term of searchTerms) {
          builder.where('cmctc.cmctcben', 'like', `%${term}%`)
        }
      })
    })
    .orderBy('cmctc.cmctcben', 'asc')

  return paginate(query, ctx)
}

const getContactByNationalRegistrationNumber = async (
  nationalRegistrationNumber: string,
  includeTerminatedLeases: boolean
) => {
  const rows = await getContactQuery().where({
    persorgnr: nationalRegistrationNumber,
  })

  if (rows && rows.length > 0) {
    const phoneNumbers = await getPhoneNumbersForContact(rows[0].keycmobj)
    const leases = await getLeaseIds(
      rows[0].contactKey,
      includeTerminatedLeases
    )
    return transformFromDbContact(rows, phoneNumbers, leases)
  }

  return null
}

const getContactByContactCode = async (
  contactKey: string,
  includeTerminatedLeases: boolean
): Promise<AdapterResult<Contact | null, unknown>> => {
  try {
    const rows = await getContactQuery().where({ cmctckod: contactKey })
    if (!rows?.length) {
      return { ok: true, data: null }
    }

    const phoneNumbers = await getPhoneNumbersForContact(rows[0].keycmobj)
    const leases = await getLeaseIds(
      rows[0].contactKey,
      includeTerminatedLeases
    )

    const contact = transformFromDbContact(rows, phoneNumbers, leases)

    return {
      ok: true,
      data: contact,
    }
  } catch (err) {
    logger.error(err, 'tenantLeaseAdapter.getContactByContactCode')
    return { ok: false, err }
  }
}

const getContactByPhoneNumber = async (
  phoneNumber: string,
  includeTerminatedLeases: boolean
) => {
  const keycmobj = await getContactForPhoneNumber(phoneNumber)
  if (keycmobj && keycmobj.length > 0) {
    const rows = await getContactQuery().where({
      'cmctc.keycmobj': keycmobj[0].keycmobj,
    })

    if (rows && rows.length > 0) {
      const phoneNumbers = await getPhoneNumbersForContact(rows[0].keycmobj)
      const leases = await getLeaseIds(
        rows[0].contactKey,
        includeTerminatedLeases
      )
      return transformFromDbContact(rows, phoneNumbers, leases)
    }
  }
}

const getContactsByLeaseId = async (leaseId: string) => {
  const rows = await xpandDb
    .from('hyavk')
    .select('hyavk.keycmctc as contactKey')
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .where({ hyobjben: leaseId })

  const contacts = await Promise.all(
    rows.map(async (row) => {
      const contactRows = await getContactQuery().where({
        'cmctc.keycmctc': row.contactKey,
      })

      if (contactRows && contactRows.length > 0) {
        const phoneNumbers = await getPhoneNumbersForContact(
          contactRows[0].keycmobj
        )
        return transformFromDbContact(contactRows, phoneNumbers, [])
      }
      return null
    })
  )

  return contacts.filter((c): c is Contact => c !== null)
}

const getContactQuery = () => {
  return (
    xpandDb
      .from('cmctc')
      .select(
        'cmctc.cmctckod as contactCode',
        'cmctc.fnamn as firstName',
        'cmctc.enamn as lastName',
        'cmctc.cmctcben as fullName',
        'cmctc.persorgnr as nationalRegistrationNumber',
        'cmctc.birthdate as birthDate',
        'cmadr.adress1 as street',
        'cmadr.adress3 as postalCode',
        'cmadr.adress4 as city',
        'cmeml.cmemlben as emailAddress',
        'cmctc.keycmobj as keycmobj',
        'cmctc.keycmctc as contactKey',
        'bkkty.bkktyben as queueName',
        'bkqte.quetime as queueTime',
        'cmctc.lagsokt as protectedIdentity',
        'cmctc.utslag as specialAttention'
      )
      .leftJoin('cmadr', 'cmadr.keycode', 'cmctc.keycmobj')
      .leftJoin('cmeml', 'cmeml.keycmobj', 'cmctc.keycmobj')
      .leftJoin('bkqte', 'bkqte.keycmctc', 'cmctc.keycmctc')
      .leftJoin('bkkty', 'bkkty.keybkkty', 'bkqte.keybkkty')
      // Only include addresses where fdate is null or in the past, and tdate is null or in the future (i.e. currently valid)
      .where(function () {
        this.whereNull('cmadr.fdate').orWhere('cmadr.fdate', '<=', new Date())
      })
      .where(function () {
        this.whereNull('cmadr.tdate').orWhere('cmadr.tdate', '>=', new Date())
      })
      .where('cmctc.deletemark', '=', '0')
      // Sort addresses so that those with a non-null fdate come first (ordered by fdate ascending), and addresses with fdate = null come last.
      // This is to prioritize addresses with a defined start date.
      .orderByRaw(
        'CASE WHEN cmadr.fdate IS NULL THEN 1 ELSE 0 END, cmadr.fdate ASC'
      )
  )
}

const getPhoneNumbersForContact = async (keycmobj: string) => {
  let rows = await xpandDb
    .from('cmtel')
    .select(
      'cmtelben as phoneNumber',
      'keycmtet as type',
      'main as isMainNumber'
    )
    .where({ keycmobj: keycmobj })

  rows = rows.map((row) => {
    return trimRow(row)
  })

  return rows
}

const getContactForPhoneNumber = async (phoneNumber: string) => {
  const rows = await xpandDb
    .from('cmtel')
    .select('keycmobj as keycmobj')
    .where({ cmtelben: phoneNumber })
  return rows
}

//todo: extend with type of lease? the type is found in hyhav.hyhavben
//todo: be able to filter on active contracts
const getLeaseIds = async (
  keycmctc: string,
  includeTerminatedLeases: boolean
) => {
  const rows = await xpandDb
    .from('hyavk')
    .select(
      'hyobj.hyobjben as leaseId',
      'hyobj.fdate as leaseStartDate',
      'hyobj.sistadeb as lastDebitDate'
    )
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .where({ keycmctc: keycmctc })

  if (!includeTerminatedLeases) {
    return rows.filter(isLeaseActive).map((x) => x.leaseId)
  }
  return rows.map((x) => x.leaseId)
}

const getLeasesByContactKey = async (keycmctc: string) => {
  const rows = await xpandDb
    .from('hyavk')
    .select(
      'hyobj.hyobjben as leaseId',
      'hyhav.hyhavben as leaseType',
      'hyobj.uppsagtav as noticeGivenBy',
      'hyobj.avtalsdat as contractDate',
      'hyobj.sistadeb as lastDebitDate',
      'hyobj.godkdatum as approvalDate',
      'hyobj.uppsdatum as noticeDate',
      'hyobj.fdate as fromDate',
      'hyobj.tdate as toDate',
      'hyobj.uppstidg as noticeTimeTenant',
      'hyobj.onskflytt AS preferredMoveOutDate',
      'hyobj.makuldatum AS terminationDate'
    )
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .innerJoin('hyhav', 'hyhav.keyhyhav', 'hyobj.keyhyhav')
    .where({ keycmctc: keycmctc })

  const leases: any[] = []
  for (const row of rows) {
    const lease = transformFromXPandDb.toLease(row, [], [])
    leases.push(lease)
  }

  return leases
}

const getLeaseById = async (hyobjben: string) => {
  const rows = await xpandDb
    .from('hyavk')
    .select(
      'hyobj.hyobjben as leaseId',
      'hyhav.hyhavben as leaseType',
      'hyobj.uppsagtav as noticeGivenBy',
      'hyobj.avtalsdat as contractDate',
      'hyobj.sistadeb as lastDebitDate',
      'hyobj.godkdatum as approvalDate',
      'hyobj.uppsdatum as noticeDate',
      'hyobj.fdate as fromDate',
      'hyobj.tdate as toDate',
      'hyobj.uppstidg as noticeTimeTenant',
      'hyobj.onskflytt AS preferredMoveOutDate',
      'hyobj.makuldatum AS terminationDate'
    )
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .innerJoin('hyhav', 'hyhav.keyhyhav', 'hyobj.keyhyhav')
    .where({ hyobjben: hyobjben })
  return rows
}

// const isLeaseActive = (lease: Lease | PartialLease): boolean => {
//   const { leaseStartDate } = lease
//   const currentDate = new Date()

//   return leaseStartDate < currentDate
// }

// const isLeaseActiveOrUpcoming = (lease: Lease | PartialLease): boolean => {
//   const { lastDebitDate, terminationDate } = lease
//   const currentDate = new Date()

//   return (
//     (!lastDebitDate || currentDate <= lastDebitDate) &&
//     (!terminationDate || currentDate < terminationDate)
//   )
// }

const filterLeasesByOptions = (
  leases: Array<Lease>,
  options: GetLeasesOptions
) => {
  return leases.filter((lease) => {
    if (options.includeTerminatedLeases && options.includeUpcomingLeases) {
      return true
    }

    if (!options.includeTerminatedLeases && !options.includeUpcomingLeases) {
      return isLeaseActive(lease)
    }

    if (options.includeTerminatedLeases && !options.includeUpcomingLeases) {
      return isLeaseActive(lease) || isLeaseTerminated(lease)
    }

    if (!options.includeTerminatedLeases && options.includeUpcomingLeases) {
      return isLeaseActive(lease) || isLeaseUpcoming(lease)
    }

    return false
  })
}

const isLeaseActive = (lease: Lease | PartialLease): boolean => {
  return !isLeaseUpcoming(lease) && !isLeaseTerminated(lease)
}

const isLeaseUpcoming = (lease: Lease | PartialLease): boolean => {
  const { leaseStartDate } = lease
  const currentDate = formatDate(new Date())

  return currentDate < formatDate(leaseStartDate)
}

const isLeaseTerminated = (lease: Lease | PartialLease): boolean => {
  const { lastDebitDate, terminationDate } = lease
  const currentDate = formatDate(new Date())

  const isLastDebitDatePassed = lastDebitDate
    ? currentDate > formatDate(lastDebitDate)
    : false
  const isTerminationDatePassed = terminationDate
    ? currentDate > formatDate(terminationDate)
    : false

  return isLastDebitDatePassed || isTerminationDatePassed
}

const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0]
}

export {
  getLease,
  getLeasesForContactCode,
  getLeasesForNationalRegistrationNumber,
  getLeasesForPropertyId,
  getContactByNationalRegistrationNumber,
  getContactByContactCode,
  getContactByPhoneNumber,
  getContactForPhoneNumber,
  filterLeasesByOptions,
  isLeaseActive,
  isLeaseUpcoming,
  isLeaseTerminated,
  getResidentialAreaByRentalPropertyId,
  getContactsDataBySearchQuery,
  searchContactsPaginated,
  transformFromDbContact,
}
