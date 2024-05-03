import { Lease, Contact, Listing, Applicant } from 'onecore-types'

import knex from 'knex'
import Config from '../../../../common/config'

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

const transformFromDbContact = (
  row: any,
  phoneNumbers: any,
  leases: any
): Contact => {
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
      process.env.NODE_ENV === 'prodution' ? row.emailAddress : 'redacted',
    isTenant: leases.length > 0,
  }

  return contact
}

const transformFromDbLease = (
  row: any,
  tenantContactIds: string[] | undefined,
  tenants: Contact[] | undefined
): Lease => {
  const parsedLeaseId = row.leaseId.split('/')
  const rentalPropertyId = parsedLeaseId[0]
  const leaseNumber = parsedLeaseId[1]

  const lease = {
    leaseId: row.leaseId,
    leaseNumber: leaseNumber,
    rentalPropertyId: rentalPropertyId,
    type: row.leaseType,
    leaseStartDate: row.fromDate,
    leaseEndDate: row.toDate,
    status: row.Status, //todo: support status
    tenantContactIds,
    tenants,
    rentalProperty: undefined,
    rentInfo: undefined,
    address: undefined,
    noticeGivenBy: row.noticeGivenBy,
    noticeDate: row.noticeDate,
    noticeTimeTenant: row.noticeTimeTenant,
    preferredMoveOutDate: row.preferredMoveOutDate,
    terminationDate: row.terminationDate,
    contractDate: row.contractDate,
    lastDebitDate: row.lastDebitDate,
    approvalDate: row.approvalDate,
  }

  return lease
}

const getLease = async (
  leaseId: string,
  includeContacts: string | string[] | undefined
): Promise<Lease | undefined> => {
  const rows = await getLeaseById(leaseId)
  if (rows.length > 0) {
    if (includeContacts) {
      const tenants = await getContactsByLeaseId(leaseId)
      return transformFromDbLease(rows[0], [], tenants)
    } else {
      return transformFromDbLease(rows[0], [], [])
    }
  }
  return undefined
}

const getLeasesForNationalRegistrationNumber = async (
  nationalRegistrationNumber: string,
  includeTerminatedLeases: string | string[] | undefined,
  includeContacts: string | string[] | undefined
) => {
  const contact = await db('cmctc')
    .select('cmctc.keycmctc as contactKey')
    .limit(1)
    .where({
      persorgnr: nationalRegistrationNumber,
    })
    .limit(1)

  if (contact != undefined) {
    const leases = await getLeasesByContactKey(contact[0].contactKey)

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

  return undefined
}

const getLeasesForContactCode = async (
  contactCode: string,
  includeTerminatedLeases: string | string[] | undefined,
  includeContacts: string | string[] | undefined
) => {
  const contact = await db('cmctc')
    .select('cmctc.keycmctc as contactKey')
    .limit(1)
    .where({
      cmctckod: contactCode,
    })
    .limit(1)

  //todo: assert actual string value, now undefined equals false and every other value true
  if (contact != undefined) {
    const leases = await getLeasesByContactKey(contact[0].contactKey)
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
}

const getLeasesForPropertyId = async (
  propertyId: string,
  includeTerminatedLeases: string | string[] | undefined,
  includeContacts: string | string[] | undefined
) => {
  const leases: Lease[] = []
  const rows = await db('hyavk')
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
      leases.push(transformFromDbLease(row, [], tenants))
    } else {
      leases.push(transformFromDbLease(row, [], []))
    }
  }
  if (shouldIncludeTerminatedLeases(includeTerminatedLeases)) {
    return leases
  }

  return leases.filter(isLeaseActive)
}

const getResidentialAreaByRentalPropertyId = async (
  rentalPropertyId: string
) => {
  const rows = await db('babya')
    .select('babya.code', 'babya.caption')
    .innerJoin('bafst', 'bafst.keybabya', 'babya.keybabya')
    .innerJoin('babuf', 'bafst.keycmobj', 'babuf.keyobjfst')
    .where('babuf.hyresid', rentalPropertyId)
    .limit(1)

  if (!rows?.length) {
    return undefined
  }
  //remove whitespaces from xpand and return
  return {
    code: rows[0].code.replace(/\s/g, ''),
    caption: rows[0].caption.replace(/\s/g, ''),
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
) => {
  const rows = await getContactQuery().where({ cmctckod: contactKey }).limit(1)
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
  const rows = await db('hyavk')
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
  return db('cmctc')
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
    .innerJoin('cmadr', 'cmadr.keycode', 'cmobj.keycmobj')
    .innerJoin('cmeml', 'cmeml.keycmobj', 'cmobj.keycmobj')
}

const getPhoneNumbersForContact = async (keycmobj: string) => {
  const rows = await db('cmtel')
    .select(
      'cmtelben as phoneNumber',
      'keycmtet as type',
      'main as isMainNumber'
    )
    .where({ keycmobj: keycmobj })
  return rows
}

const getContactForPhoneNumber = async (phoneNumber: string) => {
  const rows = await db('cmtel')
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
  const rows = await db('hyavk')
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
  const rows = await db('hyavk')
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
    const lease = await transformFromDbLease(row, [], [])
    leases.push(lease)
  }

  return leases
}

const getLeaseById = async (hyobjben: string) => {
  const rows = await db('hyavk')
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
}
