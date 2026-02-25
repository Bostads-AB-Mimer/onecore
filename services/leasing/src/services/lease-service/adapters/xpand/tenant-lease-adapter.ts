import { Lease, Contact, WaitingList, WaitingListType } from '@onecore/types'

import { logger, paginateKnex, PaginatedResponse } from '@onecore/utilities'
import { Context } from 'koa'
import { AdapterResult } from '../types'
import { xpandDb } from './xpandDb'
import { trimRow } from '../utils'

interface GetLeasesOptions {
  includeUpcomingLeases: boolean
  includeTerminatedLeases: boolean
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

    return paginateKnex(query, ctx)
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

  return paginateKnex(query, ctx)
}

/**
 * Get contacts eligible for deceased/protected identity checks (paginated)
 * Returns person contacts that:
 * - Are not deleted
 * - Have contact code starting with 'P' (persons, not organizations)
 * - Have valid national registration numbers (not organizations, not test numbers, no letters)
 * - Are not already marked as deceased
 *
 * @param ctx - Koa context for pagination params
 * @returns Paginated response with identity check contacts
 */
const getContactsForIdentityCheck = async (
  ctx: Context
): Promise<
  PaginatedResponse<{ contactCode: string; nationalRegistrationNumber: string }>
> => {
  const query = xpandDb
    .from('cmctc')
    .select(
      'cmctc.cmctckod as contactCode',
      'cmctc.persorgnr as nationalRegistrationNumber'
    )
    .where('cmctc.deletemark', '=', 0)
    .where('cmctc.cmctckod', 'like', 'P%')
    .whereNot('cmctc.persorgnr', 'like', '55%')
    .whereNot('cmctc.persorgnr', 'like', '1900%')
    .whereRaw("cmctc.persorgnr NOT LIKE '%[A-Za-z]%'")
    .whereNull('cmctc.avliden')
    .orderBy('cmctc.cmctckod', 'asc')

  return paginateKnex(query, ctx)
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

const filterLeasesByOptions = (
  leases: Array<Lease>,
  options: GetLeasesOptions
) => {
  return leases
    .filter((lease) => !lease.leaseId.includes('M'))
    .filter((lease) => {
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
  getContactsForIdentityCheck,
  transformFromDbContact,
  getContactsByLeaseId,
}
