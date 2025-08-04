import { Factory } from 'fishery'
import { Contact } from 'onecore-types'

export const ContactFactory = Factory.define<Contact>(() => ({
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
}))
