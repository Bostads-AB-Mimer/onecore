import { Factory } from 'fishery'
import { Tenant } from 'onecore-types'

import { LeaseFactory } from './lease'

export const TenantFactory = Factory.define<Tenant>(() => ({
  address: undefined,
  birthDate: new Date(),
  contactCode: '123',
  contactKey: '123',
  emailAddress: 'foo@example.com',
  firstName: 'foo',
  fullName: 'foo bar',
  isTenant: true,
  lastName: 'bar',
  nationalRegistrationNumber: 'foo bar',
  queuePoints: 0,
  phoneNumbers: undefined,
  leaseIds: undefined,
  currentHousingContract: undefined,
  parkingSpaceContracts: undefined,
  upcomingHousingContract: undefined,
  housingContracts: [LeaseFactory.build()],
  isAboutToLeave: false,
}))
