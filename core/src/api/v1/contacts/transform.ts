import { Contact } from '@onecore/contacts/domain'
import { Contact_APIv1 } from './types'

export const transformContact = (contact: Contact): Contact_APIv1 => {
  return {
    type: contact.type,
    contactCode: contact.contactCode,
    ...(contact.type === 'individual'
      ? { personal: contact.personal }
      : { organisation: contact.organisation }),
    communication: contact.communication,
    addresses: contact.addresses,
  }
}

export const transformContacts = (contacts: Contact[]): Contact_APIv1[] => {
  return contacts.map(transformContact)
}
