import z from 'zod'
import {
  ContactCategorySchema,
  ContactSchema,
  ContactAddressSchema,
  ContactCommunicationSchema,
  ContactIndividualSchema,
  ContactOrganisationSchema,
  ContactPersonalDetailsSchema,
  ContactOrganisationDetailsSchema,
  EmailAddressSchema,
  PhoneNumberSchema,
  PhoneNumberTypeSchema,
  RelatedContactSchema,
  RelatedContactRoleSchema,
} from '@src/services/contacts-service/schema'

export type PhoneNumberType = z.infer<typeof PhoneNumberTypeSchema>

export type ContactType = 'individual' | 'organisation'
export type ContactTypeFilter = 'any' | ContactType

/**
 * Xpand's contact categories for organisations. Every one of them is a legal
 * person; only `P` (a natural person, not listed here) differs structurally.
 * The letter doubles as the prefix of the contact code.
 */
export type ContactCategory = z.infer<typeof ContactCategorySchema>

export type ContactCode = string
export type ObjectKey = string
export type PhoneNumber = string
export type NationalIdNumber = string

export type ContactCommunication = z.infer<typeof ContactCommunicationSchema>
export type PhoneNumberDetails = z.infer<typeof PhoneNumberSchema>
export type EmailAddress = z.infer<typeof EmailAddressSchema>
export type ContactAddress = z.infer<typeof ContactAddressSchema>

export type PersonalDetails = z.infer<typeof ContactPersonalDetailsSchema>
export type OrganisationDetails = z.infer<
  typeof ContactOrganisationDetailsSchema
>

export type ContactIndividual = z.infer<typeof ContactIndividualSchema>
export type ContactOrganisation = z.infer<typeof ContactOrganisationSchema>
export type Contact = z.infer<typeof ContactSchema>
export type RelatedContactRole = z.infer<typeof RelatedContactRoleSchema>
export type RelatedContact = z.infer<typeof RelatedContactSchema>
