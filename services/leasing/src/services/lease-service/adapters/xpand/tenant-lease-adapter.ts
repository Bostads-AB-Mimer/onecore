import { Lease, Contact } from 'onecore-types'
import transformFromXPandDb from './../../helpers/transformFromXPandDb'

import knex from 'knex'
import Config from '../../../../common/config'
import { logger } from 'onecore-utilities'
import { AdapterResult } from '../types'

const db = knex({
  client: 'mssql',
  connection: Config.xpandDatabase,
})

type PartialLease = {
  leaseId: Lease['leaseId']
  leaseStartDate: Lease['leaseStartDate']
  lastDebitDate: Lease['lastDebitDate']
  terminationDate: Lease['terminationDate']
}

function trimRow(obj: any): any {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trimEnd() : value,
    ])
  )
}

const transformFromDbContact = (
  row: any,
  phoneNumbers: any,
  leases: any
): Contact => {
  row = trimRow(row)

  const contact = {
    contactCode: row.contactCode,
    contactKey: row.contactKey,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    leaseIds: leases,
    nationalRegistrationNumber: row.nationalRegistrationNumber,
    birthDate: row.birthDate,
    address: {
      street: row.street,
      number: '',
      postalCode: row.postalCode,
      city: row.city,
    },
    phoneNumbers: phoneNumbers,
    emailAddress:
      process.env.NODE_ENV === 'production' ? row.emailAddress : 'redacted',
    isTenant: leases.length > 0,
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
  includeTerminatedLeases: string | string[] | undefined,
  includeContacts: string | string[] | undefined
) => {
  logger.info('Getting leases for national registration number from Xpand DB')
  const contact = await db
    .from('cmctc')
    .select('cmctc.keycmctc as contactKey')
    .limit(1)
    .where({
      persorgnr: nationalRegistrationNumber,
    })
    .limit(1)

  if (contact != undefined) {
    const leases = await getLeasesByContactKey(contact[0].contactKey)

    logger.info(
      'Getting leases for national registration number from Xpand DB complete'
    )

    if (shouldIncludeTerminatedLeases(includeTerminatedLeases)) {
      return leases
    }

    if (includeContacts) {
      for (const lease of leases) {
        const tenants = await getContactsByLeaseId(lease.leaseId)
        lease.tenants = tenants
      }
    }

    return leases.filter(isLeaseActive)
  }

  logger.info(
    'Getting leases for national registration number from Xpand DB complete - no leases found'
  )
  return undefined
}

const getLeasesForContactCode = async (
  contactCode: string,
  includeTerminatedLeases: string | string[] | undefined,
  includeContacts: string | string[] | undefined
): Promise<AdapterResult<Array<Lease>, unknown>> => {
  logger.info({ contactCode }, 'Getting leases for contact code from Xpand DB')
  try {
    const contact = await db
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

      const leases = await getLeasesByContactKey(contact[0].contactKey)
      if (shouldIncludeTerminatedLeases(includeTerminatedLeases)) {
        return { ok: true, data: leases }
      }

      if (includeContacts) {
        for (const lease of leases) {
          const tenants = await getContactsByLeaseId(lease.leaseId)
          lease.tenants = tenants
        }
      }

      return { ok: true, data: leases.filter(isLeaseActive) }
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
  includeTerminatedLeases: string | string[] | undefined,
  includeContacts: string | string[] | undefined
) => {
  const leases: Lease[] = []
  const rows = await db
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
    if (includeContacts) {
      const tenants = await getContactsByLeaseId(row.leaseId)
      leases.push(transformFromXPandDb.toLease(row, [], tenants))
    } else {
      leases.push(transformFromXPandDb.toLease(row, [], []))
    }
  }
  if (shouldIncludeTerminatedLeases(includeTerminatedLeases)) {
    return leases
  }

  return leases.filter(isLeaseActive)
}

const getResidentialAreaByRentalPropertyId = async (
  rentalPropertyId: string
): Promise<AdapterResult<{ code: any; caption: any } | undefined, unknown>> => {
  try {
    const rows = await db
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
    const rows = await db
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
  includeTerminatedLeases: string | string[] | undefined
) => {
  const rows = await getContactQuery()
    .where({ persorgnr: nationalRegistrationNumber })
    .limit(1)
  if (rows && rows.length > 0) {
    const phoneNumbers = await getPhoneNumbersForContact(rows[0].keycmobj)
    const leases = await getLeaseIds(
      rows[0].contactKey,
      includeTerminatedLeases
    )
    return transformFromDbContact(rows[0], phoneNumbers, leases)
  }

  return null
}

const getContactByContactCode = async (
  contactKey: string,
  includeTerminatedLeases: string | string[] | undefined
): Promise<AdapterResult<Contact | null, unknown>> => {
  try {
    const rows = await getContactQuery()
      .where({ cmctckod: contactKey })
      .limit(1)

    if (!rows?.length) {
      return { ok: true, data: null }
    }

    const phoneNumbers = await getPhoneNumbersForContact(rows[0].keycmobj)
    const leases = await getLeaseIds(
      rows[0].contactKey,
      includeTerminatedLeases
    )

    return {
      ok: true,
      data: transformFromDbContact(rows[0], phoneNumbers, leases),
    }
  } catch (err) {
    logger.error(err, 'tenantLeaseAdapter.getContactByContactCode')
    return { ok: false, err }
  }
}

const getContactByPhoneNumber = async (
  phoneNumber: string,
  includeTerminatedLeases: string | string[] | undefined
) => {
  const keycmobj = await getContactForPhoneNumber(phoneNumber)
  if (keycmobj && keycmobj.length > 0) {
    const rows = await getContactQuery()
      .where({ 'cmobj.keycmobj': keycmobj[0].keycmobj })
      .limit(1)
    if (rows && rows.length > 0) {
      const phoneNumbers = await getPhoneNumbersForContact(rows[0].keycmobj)
      const leases = await getLeaseIds(
        rows[0].contactKey,
        includeTerminatedLeases
      )
      return transformFromDbContact(rows[0], phoneNumbers, leases)
    }
  }
}

const getContactsByLeaseId = async (leaseId: string) => {
  const contacts: Contact[] = []
  const rows = await db
    .from('hyavk')
    .select('hyavk.keycmctc as contactKey')
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .where({ hyobjben: leaseId })

  for (let row of rows) {
    row = await getContactQuery()
      .where({ 'cmctc.keycmctc': row.contactKey })
      .limit(1)

    if (row && row.length > 0) {
      const phoneNumbers = await getPhoneNumbersForContact(row[0].keycmobj)
      contacts.push(transformFromDbContact(row[0], phoneNumbers, []))
    }
  }

  return contacts
}

const getContactQuery = () => {
  return db
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
      'cmobj.keycmobj as keycmobj',
      'cmctc.keycmctc as contactKey'
    )
    .innerJoin('cmobj', 'cmobj.keycmobj', 'cmctc.keycmobj')
    .leftJoin('cmadr', 'cmadr.keycode', 'cmobj.keycmobj')
    .innerJoin('cmeml', 'cmeml.keycmobj', 'cmobj.keycmobj')
}

const getPhoneNumbersForContact = async (keycmobj: string) => {
  let rows = await db
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
  const rows = await db
    .from('cmtel')
    .select('keycmobj as keycmobj')
    .where({ cmtelben: phoneNumber })
  return rows
}

//todo: extend with type of lease? the type is found in hyhav.hyhavben
//todo: be able to filter on active contracts
const getLeaseIds = async (
  keycmctc: string,
  includeTerminatedLeases: string | string[] | undefined
) => {
  includeTerminatedLeases = Array.isArray(includeTerminatedLeases)
    ? includeTerminatedLeases[0]
    : includeTerminatedLeases
  const rows = await db
    .from('hyavk')
    .select(
      'hyobj.hyobjben as leaseId',
      'hyobj.fdate as leaseStartDate',
      'hyobj.sistadeb as lastDebitDate'
    )
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .where({ keycmctc: keycmctc })

  if (!includeTerminatedLeases || includeTerminatedLeases === 'false') {
    return rows.filter(isLeaseActive).map((x) => x.leaseId)
  }
  return rows.map((x) => x.leaseId)
}

const getLeasesByContactKey = async (keycmctc: string) => {
  const rows = await db
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
  const rows = await db
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

const shouldIncludeTerminatedLeases = (
  includeTerminatedLeases: string | string[] | undefined
) => {
  const queryParamResult = Array.isArray(includeTerminatedLeases)
    ? includeTerminatedLeases[0]
    : includeTerminatedLeases

  return !(!queryParamResult || queryParamResult === 'false')
}

const isLeaseActive = (lease: Lease | PartialLease): boolean => {
  const currentDate = new Date()
  const leaseStartDate = new Date(lease.leaseStartDate)
  const lastDebitDate = lease.lastDebitDate
    ? new Date(lease.lastDebitDate)
    : null

  return (
    leaseStartDate < currentDate &&
    (!lastDebitDate || currentDate < lastDebitDate)
  )
}

export {
  getLease,
  getLeasesForContactCode,
  getLeasesForNationalRegistrationNumber,
  getLeasesForPropertyId,
  getContactByNationalRegistrationNumber,
  getContactByContactCode,
  getContactForPhoneNumber,
  isLeaseActive,
  getResidentialAreaByRentalPropertyId,
  getContactsDataBySearchQuery,
}
