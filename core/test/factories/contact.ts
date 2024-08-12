import { Factory } from 'fishery'
import { Contact } from 'onecore-types'

export const ContactFactory = Factory.define<Contact>(({ sequence }) => ({
  contactCode: `P${158769 + sequence}`,
  contactKey: 'ABC',
  address: {
    street: 'Gata',
    number: '2',
    postalCode: '54321',
    city: 'Västerås',
  },
  birthDate: new Date(),
  firstName: 'Test',
  lastName: 'Testsson',
  fullName: 'Test Testsson',
  nationalRegistrationNumber: '199404084924',
  phoneNumbers: [],
  emailAddress: 'test@mimer.nu',
  isTenant: true,
  leaseIds: [],
  leases: undefined,
}))
