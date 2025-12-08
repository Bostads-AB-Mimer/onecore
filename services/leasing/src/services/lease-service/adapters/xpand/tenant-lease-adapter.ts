import { Lease, Contact, WaitingList, WaitingListType } from '@onecore/types'
import transformFromXPandDb from './../../helpers/transformFromXPandDb'

import { logger } from '@onecore/utilities'
import { AdapterResult } from '../types'
import { xpandDb } from './xpandDb'
import { trimRow } from '../utils'

interface GetLeasesOptions {
  includeUpcomingLeases: boolean
  includeTerminatedLeases: boolean
  includeContacts: boolean
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
    .where('hyobj.hyobjben', 'like', `%${propertyId}%`)

  for (const row of rows) {
    const lease = transformFromXPandDb.toLease(row, [], [])
    leases.push(lease)
  }

  leases = filterLeasesByOptions(leases, options)

  if (options.includeContacts) {
    for (const lease of leases) {
      const tenants = await getContactsByLeaseId(lease.leaseId)
      lease.tenants = tenants
    }
  }

  return leases
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
    const rows = await xpandDb
      .from('cmctc')
      .select('cmctc.cmctckod as contactCode', 'cmctc.cmctcben as fullName')
      .where('cmctc.cmctckod', 'like', `%${q}%`)
      .orWhere('cmctc.persorgnr', 'like', `%${q}%`)
      .limit(5)

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
  const contacts: Contact[] = []
  const rows = await xpandDb
    .from('hyavk')
    .select('hyavk.keycmctc as contactKey')
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .where({ hyobjben: leaseId })

  for (let row of rows) {
    row = await getContactQuery().where({ 'cmctc.keycmctc': row.contactKey })

    if (row && row.length > 0) {
      const phoneNumbers = await getPhoneNumbersForContact(row[0].keycmobj)
      contacts.push(transformFromDbContact(row, phoneNumbers, []))
    }
  }

  return contacts
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
      //only get valid addresses
      .where(function () {
        this.whereNull('cmadr.fdate').orWhere('cmadr.fdate', '<=', new Date())
      })
      .where(function () {
        this.whereNull('cmadr.tdate').orWhere('cmadr.tdate', '>=', new Date())
      })
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
  transformFromDbContact,
}
