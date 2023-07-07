import { Lease, LeaseStatus, Contact } from '../../../common/types'
import knex from 'knex'
import Config from '../../../common/config'

const db = knex({
  client: 'mssql',
  connection: Config.database,
})

const transformFromDbContact = (row: any): Contact => {
  const contact = {
    contactId: row.ContactId,
    firstName: row.FirstName,
    lastName: row.LastName,
    fullName: row.FullName,
    type: row.ContactType,
    leaseId: row.ContactLeaseId,
    lease: undefined,
    nationalRegistrationNumber: row.NationalRegistrationNumber,
    birthDate: row.BirthDate,
    address: {
      street: row.Street,
      number: row.StreetNumber,
      postalCode: row.PostalCode,
      city: row.City,
    },
    mobilePhone: row.MobilePhone,
    phoneNumber: row.PhoneNumber,
    emailAddress: row.EmailAddress,
    lastUpdated: row.ContactLastUpdated,
  }

  return contact
}

const transformFromDbLease = (
  row: any,
  tenantContactIds: string[] | undefined,
  tenants: Contact[] | undefined
): Lease => {
  const lease = {
    leaseId: row.LeaseLeaseId,
    leaseNumber: row.LeaseNumber,
    leaseStartDate: row.LeaseStartDate,
    leaseEndDate: row.LeaseEndDate,
    status: row.Status,
    tenantContactIds,
    tenants,
    rentalPropertyId: row.RentalPropertyId,
    type: row.LeaseType,
    rentalProperty: undefined,
    lastUpdated: row.LeaseLastUpdated,
    rentInfo: undefined,
  }

  return lease
}

const transformToDbLease = (lease: Lease) => {
  const dbLease = {
    LeaseId: lease.leaseId,
    LeaseNumber: lease.leaseNumber,
    LeaseStartDate: lease.leaseStartDate,
    LeaseEndDate: lease.leaseEndDate,
    RentalPropertyId: lease.rentalPropertyId,
    Status: lease.status,
    Type: lease.type,
    LastUpdated: lease.lastUpdated,
  }

  return dbLease
}

const transformToDbContact = (contact: Contact) => {
  const dbContact = {
    ContactId: contact.contactId,
    FirstName: contact.firstName,
    LastName: contact.lastName,
    FullName: contact.fullName,
    Type: contact.type,
    LeaseId: contact.leaseId,
    NationalRegistrationNumber: contact.nationalRegistrationNumber,
    BirthDate: contact.birthDate,
    Street: contact.address?.street,
    StreetNumber: contact.address?.number,
    PostalCode: contact.address?.postalCode,
    City: contact.address?.city,
    MobilePhone: contact.mobilePhone,
    PhoneNumber: contact.phoneNumber,
    EmailAddress: contact.emailAddress,
    LastUpdated: contact.lastUpdated,
  }

  return dbContact
}

const getLease = async (leaseId: string): Promise<Lease | undefined> => {
  const rows = await db('Lease')
    .select(
      '*',
      'Contact.LeaseId as ContactLeaseId',
      'Lease.LeaseId as LeaseLeaseId',
      'Contact.Type as ContactType',
      'Lease.Type as LeaseType',
      'Lease.LastUpdated as LeaseLastUpdated',
      'Contact.LastUpdated as ContactLastUpdated'
    )
    .innerJoin('Contact', 'Lease.LeaseId', 'Contact.LeaseId')
    .where({ 'Lease.LeaseId': leaseId })

  if (rows && rows.length > 0) {
    const tenantPersonIds: string[] = []
    const tenants: Contact[] = []

    const lease = transformFromDbLease(rows[0], tenantPersonIds, tenants)

    rows.forEach((row) => {
      lease.tenantContactIds?.push(row.ContactId)
      lease.tenants?.push(transformFromDbContact(row))
    })

    return lease
  }

  return undefined
}

const getLeases = async (leaseIds?: string[] | undefined): Promise<Lease[]> => {
  const leases: Lease[] = []

  const rows = await db('Lease')
    .select(
      '*',
      'Contact.LeaseId as ContactLeaseId',
      'Lease.LeaseId as LeaseLeaseId',
      'Contact.Type as ContactType',
      'Lease.Type as LeaseType',
      'Lease.LastUpdated as LeaseLastUpdated',
      'Contact.LastUpdated as ContactLastUpdated'
    )
    .innerJoin('Contact', 'Lease.LeaseId', 'Contact.LeaseId')
    .modify((queryBuilder) => {
      if (leaseIds) {
        queryBuilder.whereIn('Lease.LeaseId', leaseIds)
      }
    })
    .limit(100)

  let lastLeaseId: string | null = null
  let tenantContactIds: string[] = []
  let tenants: Contact[] = []
  let lease: Lease | null = null

  for (let i = 0; i < rows.length; i++) {
    if (!lastLeaseId || lastLeaseId != rows[i].LeaseId) {
      tenantContactIds = []
      tenants = []
      lease = transformFromDbLease(rows[i], tenantContactIds, tenants)
      leases.push(lease)
    }
    lease?.tenantContactIds?.push(rows[i].ContactId)
    lease?.tenants?.push(transformFromDbContact(rows[i]))

    lastLeaseId = rows[i].LeaseId
  }

  return leases
}

const getLeasesFor = async (nationalRegistrationNumber: string) => {
  const rows = await db('Contact').where({
    NationalRegistrationNumber: nationalRegistrationNumber,
  })

  if (rows && rows.length > 0) {
    const leaseIds = rows.map((row) => {
      return row.LeaseId
    })

    const uniqueLeaseIds = Array.from(new Set(leaseIds))
    const leases: Lease[] = []

    for (const leaseId of uniqueLeaseIds) {
      const lease = await getLease(leaseId)
      if (lease) {
        leases.push(lease)
      }
    }

    return leases
  }

  return null
}

const updateLease = async (lease: Lease) => {
  const rows = await db('lease').where({
    LeaseId: lease.leaseId,
  })

  let inserted = 0
  let updated = 0
  let dbLease = transformToDbLease(lease)

  if (rows && rows.length > 0) {
    process.stdout.write('.')
    const existingDbLease = rows[0]
    if (
      !lease.lastUpdated ||
      !existingDbLease.LastUpdated ||
      lease.lastUpdated.getDate() > existingDbLease.LastUpdated.getDate()
    ) {
      dbLease.LastUpdated = new Date()
      const updatedLease = await db('lease')
        .update(dbLease)
        .returning('*')
        .where({ LeaseId: dbLease.LeaseId })
      dbLease = updatedLease[0]
      updated++
    }
  } else {
    process.stdout.write('*')
    dbLease.LastUpdated = new Date()
    const insertedPerson = await db('lease').insert(dbLease).returning('*')
    dbLease = insertedPerson[0]
    inserted++
  }

  return {
    lease: transformFromDbLease(dbLease, undefined, undefined),
    meta: {
      updated,
      inserted,
    },
  }
}

const updateLeases = async (leases: Lease[]) => {
  for (const lease of leases) {
    await updateLease(lease)
  }
}

const updateContact = async (contact: Contact) => {
  const rows = await db('contact').where({
    ContactId: contact.contactId,
    LeaseId: contact.leaseId,
  })

  let inserted = 0
  let updated = 0
  let dbContact = transformToDbContact(contact)

  if (rows && rows.length > 0) {
    const existingDbContact = rows[0]
    process.stdout.write('.')

    if (
      !contact.lastUpdated ||
      !existingDbContact.LastUpdated ||
      contact.lastUpdated.getDate() > existingDbContact.LastUpdated.getDate()
    ) {
      dbContact.LastUpdated = new Date()
      const updatedPerson = await db('contact')
        .update(dbContact)
        .returning('*')
        .where({ ContactId: dbContact.ContactId, LeaseId: dbContact.LeaseId })
      dbContact = updatedPerson[0]
      updated++
    }
  } else {
    process.stdout.write('*')
    dbContact.LastUpdated = new Date()
    const insertedPerson = await db('contact').insert(dbContact).returning('*')
    dbContact = insertedPerson[0]
    inserted++
  }

  return {
    person: transformFromDbContact(dbContact),
    meta: {
      updated,
      inserted,
    },
  }
}

const updateContacts = async (contacts: Contact[]) => {
  for (const contact of contacts) {
    await updateContact(contact)
  }
}

export {
  getLease,
  getLeases,
  getLeasesFor,
  updateLease,
  updateLeases,
  updateContact,
  updateContacts,
}
