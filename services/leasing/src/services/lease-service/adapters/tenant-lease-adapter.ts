import axios from 'axios'
import { Lease, LeaseStatus, Person } from '../../../common/types'
import RandExp from 'randexp'

const birthDateGenerator = new RandExp(
  /(19|20)[0-9]{2}0[0-9]{1}[0-2]{1}[0-9]{1}/
)
const lastDigits = new RandExp(/[0-9]{4}/)
const phoneGenerator = new RandExp(/\+46[0-9]{10}/)
const zipGenerator = new RandExp(/72[2-5]{1}[0-9]{2}/)

const getPerson = async (personId: string): Promise<Person> => {
  const names = await axios('https://api.namnapi.se/v2/names.json?limit=1')
  const birthDate = birthDateGenerator.gen()

  return {
    personId: personId,
    firstName: names.data.names[0].firstname,
    lastName: names.data.names[0].surname,
    nationalRegistrationNumber: `${birthDate}-${lastDigits.gen()}`,
    birthDate: birthDate,
    addressId: '1337',
    address: undefined,
    mobilePhone: phoneGenerator.gen(),
    phoneNumber: phoneGenerator.gen(),
    emailAddress: 'test@test.se',
  }
}

const getAddress = async () => {
  return {
    addressId: Math.round(Math.random() * 100000).toString(),
    street: 'Gatvägen',
    number: Math.round(Math.random() * 100).toString(),
    postalCode: zipGenerator.gen(),
    city: 'Västerås',
  }
}

const getLease = async (leaseId: string): Promise<Lease> => {
  const person1 = await getPerson(Math.round(Math.random() * 10000).toString())
  const person2 = await getPerson(Math.round(Math.random() * 10000).toString())

  const address = await getAddress()

  person1.addressId = address.addressId
  person1.address = address
  person2.addressId = address.addressId
  person2.address = address

  const lease = {
    leaseId: leaseId,
    leaseNumber: Math.round(Math.random() * 10000).toString(),
    leaseStartDate: new Date(),
    leaseEndDate: new Date(),
    status: LeaseStatus.Active,
    tenantPersonIds: [person1.personId, person2.personId],
    tenants: [person1, person2],
    apartmentId: Math.round(Math.random() * 1000).toString(),
    apartment: undefined,
  }

  return lease
}

export { getLease }
