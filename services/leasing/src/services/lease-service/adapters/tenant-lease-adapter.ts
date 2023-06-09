import { Lease, LeaseStatus, Person } from '../../../common/types'
import knex from 'knex'
import Config from '../../../common/config'

const db = knex({
  client: 'mssql',
  connection: Config.database,
})

const transformPerson = (row: any) => {
  const person = {
    personId: row.PersonId,
    firstName: row.FirstName,
    lastName: row.LastName,
    nationalRegistrationNumber: row.NationalRegistrationNumber,
    birthDate: row.BirthDate,
    addressId: '',
    address: {
      addressId: '',
      street: row.Street,
      number: row.StreetNumber,
      postalCode: row.PostalCode,
      city: row.City,
    },
    mobilePhone: row.MobilePhone,
    phoneNumber: row.PhoneNumber,
    emailAddress: row.EmailAddress,
  }

  return person
}

const transformLease = (
  row: any,
  tenantPersonIds: string[],
  tenants: Person[]
) => {
  const lease = {
    leaseId: row.LeaseId,
    leaseNumber: row.LeaseNumber,
    leaseStartDate: row.LeaseStartDate,
    leaseEndDate: row.LeaseEndDate,
    status: row.Status,
    tenantPersonIds,
    tenants,
    apartmentId: row.apartmentId,
    apartment: undefined,
  }

  return lease
}

const getLease = async (leaseId: string): Promise<Lease> => {
  const rows = await db('Lease')
    .innerJoin('Tenant', 'Lease.LeaseId', 'Tenant.TenantLeaseId')
    .innerJoin('Person', 'Tenant.TenantPersonId', 'Person.PersonId')
    .where({ 'Lease.LeaseId': leaseId })

  const tenantPersonIds: string[] = []
  const tenants: Person[] = []

  const lease = transformLease(rows[0], tenantPersonIds, tenants)

  rows.forEach((row) => {
    lease.tenantPersonIds.push(row.TenantPersonId)
    lease.tenants.push(transformPerson(row))
  })

  return lease
}

const getLeases = async (): Promise<Lease[]> => {
  const leases: Lease[] = []

  const rows = await db('Lease')
    .innerJoin('Tenant', 'Lease.LeaseId', 'Tenant.TenantLeaseId')
    .innerJoin('Person', 'Tenant.TenantPersonId', 'Person.PersonId')

  let lastLeaseId: string | null = null
  let tenantPersonIds: string[] = []
  let tenants: Person[] = []
  let lease: Lease | null = null

  for (let i = 0; i < rows.length; i++) {
    if (!lastLeaseId || lastLeaseId != rows[i].LeaseId) {
      tenantPersonIds = []
      tenants = []
      lease = transformLease(rows[i], tenantPersonIds, tenants)
      leases.push(lease)
    }
    lease?.tenantPersonIds.push(rows[i].TenantPersonId)
    lease?.tenants?.push(transformPerson(rows[i]))

    lastLeaseId = rows[i].LeaseId
  }

  return leases
}

export { getLease, getLeases }
