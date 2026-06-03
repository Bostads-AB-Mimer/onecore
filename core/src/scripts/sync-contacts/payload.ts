import z from 'zod'
import type { Contact } from '@onecore/contacts/domain'

export const ContactSyncPayloadSchema = z.object({
  contactCode: z.string(),
  fullName: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  nationalId: z.string().nullable(),
  emailAddress: z.string().optional(),
  phoneNumber: z.string().optional(),
  street: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
})

export type ContactSyncPayload = z.infer<typeof ContactSyncPayloadSchema>

const getPrimaryEmail = (contact: Contact): string | undefined =>
  contact.communication.emailAddresses.find((e) => e.isPrimary)?.emailAddress ??
  contact.communication.emailAddresses[0]?.emailAddress

const getPrimaryPhone = (contact: Contact): string | undefined =>
  contact.communication.phoneNumbers.find((p) => p.isPrimary)?.phoneNumber ??
  contact.communication.phoneNumbers[0]?.phoneNumber

export const toSyncPayload = (contact: Contact): ContactSyncPayload => {
  const primaryAddress = contact.addresses[0]

  return {
    contactCode: contact.contactCode,
    fullName:
      contact.type === 'individual'
        ? contact.personal.fullName
        : contact.organisation.name,
    firstName:
      contact.type === 'individual' ? contact.personal.firstName : null,
    lastName: contact.type === 'individual' ? contact.personal.lastName : null,
    nationalId:
      contact.type === 'individual'
        ? contact.personal.nationalId
        : contact.organisation.organisationNumber,
    emailAddress: getPrimaryEmail(contact),
    phoneNumber: getPrimaryPhone(contact),
    street: primaryAddress?.street,
    zipCode: primaryAddress?.zipCode,
    city: primaryAddress?.city,
  }
}
