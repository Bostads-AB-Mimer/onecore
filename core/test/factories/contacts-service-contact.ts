import { Factory } from 'fishery'
import type { Contact } from '@onecore/contacts/domain'

type IndividualContact = Extract<Contact, { type: 'individual' }>
type OrganisationContact = Extract<Contact, { type: 'organisation' }>

export const ContactsServiceOrganisationFactory =
  Factory.define<OrganisationContact>(({ sequence }) => ({
    type: 'organisation',
    contactCode: `F${100000 + sequence}`,
    contactKey: `ORGKEY${sequence}`,
    protectedIdentity: false,
    organisation: {
      organisationNumber: '5560000000',
      name: 'Bolaget AB',
    },
    communication: {
      phoneNumbers: [],
      emailAddresses: [],
      specialAttention: false,
    },
    addresses: [],
  }))

/**
 * An organisation as the contacts service returns it when Xpand has no
 * organisation number for it (persorgnr NULL).
 */
export const contactsServiceOrganisationWithoutNumber = (
  contactCode: string
): OrganisationContact => ({
  ...ContactsServiceOrganisationFactory.build({ contactCode }),
  organisation: {
    // @ts-expect-error The contacts service types the number as a string but sends null for these organisations.
    organisationNumber: null,
    name: 'Bolaget AB',
  },
})

export const ContactsServiceContactFactory = Factory.define<IndividualContact>(
  ({ sequence }) => ({
    type: 'individual',
    contactCode: `P${158769 + sequence}`,
    contactKey: `KEY${sequence}`,
    protectedIdentity: false,
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
  })
)
