import { Factory } from 'fishery'
import type { Contact } from '@onecore/contacts/domain'

type IndividualContact = Extract<Contact, { type: 'individual' }>

export const ContactsServiceContactFactory =
  Factory.define<IndividualContact>(({ sequence }) => ({
    type: 'individual',
    contactCode: `P${158769 + sequence}`,
    contactKey: `KEY${sequence}`,
    personal: {
      nationalId: '199001011234',
      birthDate: '1990-01-01',
      firstName: 'Test',
      lastName: 'Testsson',
      fullName: 'Test Testsson',
    },
    communication: {
      phoneNumbers: [
        { phoneNumber: '0701234567', type: 'mobile', isPrimary: true },
      ],
      emailAddresses: [
        { emailAddress: 'test@example.com', type: 'private', isPrimary: true },
      ],
      specialAttention: false,
    },
    addresses: [
      {
        street: 'Testgatan 1',
        zipCode: '72345',
        city: 'Västerås',
        region: null,
        country: 'SE',
        full: 'Testgatan 1, 72345 Västerås',
      },
    ],
  }))
