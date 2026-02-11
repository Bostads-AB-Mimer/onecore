import type { Contact, ContactAddress } from '@onecore/contacts/domain'
import { Contact_APIv1, ContactAddress_APIv1 } from './types'

export const transformAddress = (
  address: ContactAddress
): ContactAddress_APIv1 => {
  return {
    street: address.street,
    zipCode: address.zipCode,
    city: address.city,
    region: address.region,
    country: address.country,
    ...(address.careOf ? { careOf: address.careOf } : {}),
  }
}

export const transformContact = (contact: Contact): Contact_APIv1 => {
  switch (contact.type) {
    case 'individual':
      return {
        type: contact.type,
        contactCode: contact.contactCode,
        personal: {
          nationalRegistrationNumber: contact.personal.nationalId,
          birthDate: contact.personal.birthDate,
          firstName: contact.personal.firstName,
          lastName: contact.personal.lastName,
          fullName: contact.personal.fullName,
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
