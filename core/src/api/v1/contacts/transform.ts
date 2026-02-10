import type { Contact, ContactAddress } from '@onecore/contacts/domain'
import { Contact_APIv1, ContactAddress_APIv1 } from './types'

export const transformAddress = (
  address: ContactAddress
): ContactAddress_APIv1 => {
  return {
    careOf: address.careOf ?? null,
    street: address.street,
    zipCode: address.zipCode,
    city: address.city,
    region: address.region,
    country: address.country,
  }
}

export const transformContact = (contact: Contact): Contact_APIv1 => {
  switch (contact.type) {
    case 'individual':
      return {
        type: contact.type,
        contactCode: contact.contactCode,
        personal: {
          nationalRegistrationNumber:
            contact.personal.nationalId ?? 'this-is-null',
          birthDate: contact.personal.birthDate ?? 'this-is-null',
          firstName: contact.personal.firstName ?? 'this-is-null',
          lastName: contact.personal.lastName ?? 'this-is-null',
          fullName: contact.personal.fullName ?? 'this-is-null',
        },
        ...(contact.trustee ? { trustee: contact.trustee } : {}),
        communication: contact.communication,
        addresses: contact.addresses.map(transformAddress),
      }
    case 'organisation':
      return {
        type: contact.type,
        contactCode: contact.contactCode,
        organisation: contact.organisation,
        communication: contact.communication,
        addresses: contact.addresses.map(transformAddress),
      }
  }
}

export const transformContacts = (contacts: Contact[]): Contact_APIv1[] => {
  return contacts.map(transformContact)
}
