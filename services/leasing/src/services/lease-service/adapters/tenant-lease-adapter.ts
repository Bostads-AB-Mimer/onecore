import { Lease, Contact } from 'onecore-types'

import knex from 'knex'
import Config from '../../../common/config'

const db = knex({
  client: 'mssql',
  connection: Config.database,
})

const transformFromDbContact = (row: any, phoneNumbers: any, leases: any): Contact => {
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
    emailAddress: row.emailAddress,
    isTenant: leases.length > 0,
  }

  return contact
}

const transformFromDbLease = (
  row: any,
  tenantContactIds: string[] | undefined,
  tenants: Contact[] | undefined,
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

//todo: include contact/tentant info
const getLease = async (leaseId: string): Promise<Lease | undefined> => {
  let rows = await getLeaseById(leaseId)
  if(rows.length > 0) {
    return transformFromDbLease(rows[0], [], [])
  }
  return undefined
}

const getLeases = async (leaseIds: string[] | undefined): Promise<Lease[]> => {
  const leases: Lease[] = []

  const rows = await db('Lease')
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
      'hyobj.makuldatum AS terminationDate',
    )
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .innerJoin('hyhav', 'hyhav.keyhyhav', 'hyobj.keyhyhav')
    .modify((queryBuilder) => {
      if (leaseIds) {
        queryBuilder.whereIn('hyobjben', leaseIds)
      }
    })
    .limit(100)

  for (const row of rows) {
    const lease = await transformFromDbLease(row, [], [])
    leases.push(lease)
  }

  return leases
}

//todo: include contact/tentant info
const getLeasesForNationRegistrationNumber = async (nationalRegistrationNumber: string) => {
  const contact = await db('cmctc').select(
    'cmctc.keycmctc as contactKey',
  ).limit(1)
    .where({
      persorgnr: nationalRegistrationNumber })
    .limit(1)

  if (contact != undefined) {
    return await getLeasesByContactKey(contact[0].contactKey)
  }

  return undefined
}

const getLeasesForContactCode = async (contactCode: string) => {
  const contact = await db('cmctc').select(
    'cmctc.keycmctc as contactKey',
  ).limit(1)
    .where({
      cmctckod: contactCode })
    .limit(1)

  if (contact != undefined) {
    return await getLeasesByContactKey(contact[0].contactKey)
  }
}

const getContactByNationalRegistrationNumber = async (nationalRegistrationNumber: string) => {
  const rows = await
    getContactQuery().where({ persorgnr: nationalRegistrationNumber })
    .limit(1)
  if (rows && rows.length > 0) {
    var phoneNumbers = await getPhoneNumbersForContact(rows[0].keycmobj)
    var leases = await getLeaseIds(rows[0].contactKey)
    return transformFromDbContact(rows[0], phoneNumbers, leases)
  }

  return null
}

const getContactByContactCode = async (contactKey: string) => {
  const rows = await
    getContactQuery()
      .where({ cmctckod: contactKey })
      .limit(1)
  if (rows && rows.length > 0) {
    var phoneNumbers = await getPhoneNumbersForContact(rows[0].keycmobj)
    var leases = await getLeaseIds(rows[0].contactKey)
    return transformFromDbContact(rows[0], phoneNumbers, leases)
  }

  return null
}

const getContactQuery = () => {
  return db('cmctc').select(
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
    'cmctc.keycmctc as contactKey',
  ).innerJoin('cmobj', 'cmobj.keycmobj', 'cmctc.keycmobj')
    .innerJoin('cmadr', 'cmadr.keycode', 'cmobj.keycmobj')
    .innerJoin('cmeml', 'cmeml.keycmobj', 'cmobj.keycmobj')
}

const getPhoneNumbersForContact = async (keycmobj: string) => {
  var rows = await db('cmtel').select(
    'cmtelben as phoneNumber',
    'keycmtet as type',
    'main as isMainNumber',
  ).where({ keycmobj: keycmobj })
  return rows
}

//todo: extend with type of lease? the type is found in hyhav.hyhavben
//todo: be able to filter on active contracts
const getLeaseIds = async (keycmctc: string) => {
  var rows = await db('hyavk').select(
    'hyobj.hyobjben as leaseId',
  ).innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .where({ keycmctc: keycmctc })
  return rows.map(x => x.leaseId)
}

const getLeasesByContactKey = async (keycmctc: string) => {
  var rows = await db('hyavk')
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
      'hyobj.makuldatum AS terminationDate',
    )
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .innerJoin('hyhav', 'hyhav.keyhyhav', 'hyobj.keyhyhav')
    .where({ keycmctc: keycmctc })

  var leases: any[] = []
  for (const row of rows) {
    const lease = await transformFromDbLease(row, [], [])
    leases.push(lease)
  }

  return leases
}

const getLeaseById = async (hyobjben: string) => {
  var rows = await db('hyavk')
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
      'hyobj.makuldatum AS terminationDate',
    )
    .innerJoin('hyobj', 'hyobj.keyhyobj', 'hyavk.keyhyobj')
    .innerJoin('hyhav', 'hyhav.keyhyhav', 'hyobj.keyhyhav')
    .where({ hyobjben: hyobjben })
  return rows
}

export {
  getLease,
  getLeases,
  getLeasesForContactCode,
  getLeasesForNationRegistrationNumber,
  getContactByNationalRegistrationNumber,
  getContactByContactCode,
}
