import z from 'zod'

export const PhoneNumberTypeSchema = z.enum([
  'work',
  'home',
  'mobile',
  'direct-line',
  'fax',
  'pager',
  'unspecified',
])

export const PhoneNumberSchema = z.object({
  phoneNumber: z.string(),
  type: PhoneNumberTypeSchema,
  comment: z.string().optional(),
  isPrimary: z.boolean(),
})

export const EmailAddressSchema = z.object({
  emailAddress: z.string(),
  type: z.string(),
  isPrimary: z.boolean(),
})

export const ContactIdentitySchema = z.object({
  nationalId: z.string().nullable(),
  birthDate: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string(),
})

export const ContactCommunicationSchema = z.object({
  phoneNumbers: z.array(PhoneNumberSchema),
  emailAddresses: z.array(EmailAddressSchema),
  specialAttention: z.boolean(),
})

export const ContactAddressSchema = z.object({
  careOf: z.string().optional(),
  street: z.string().nullable(),
  zipCode: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
})

export const RelatedContactRoleSchema = z.enum([
  'trustee', // god man
  'administrator', // förvaltare
  'trusteeFor', // subject is god man for this contact
  'administratorFor', // subject is förvaltare for this contact
  'otherInvoiceRecipient', // annan fakturamottagare
  'otherInvoiceRecipientFor',
])

export const RelatedContactSchema = z.object({
  contactCode: z.string(),
  role: RelatedContactRoleSchema,
  fullName: z.string(),
})

export const ContactBaseSchema = z.object({
  contactCode: z.string(),
  communication: ContactCommunicationSchema,
  addresses: z.array(ContactAddressSchema),
  relatedContacts: z.optional(z.array(RelatedContactSchema)),
})

export const ContactPersonalDetailsSchema = z.object({
  nationalRegistrationNumber: z.string().nullable(),
  birthDate: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string(),
})

export const ContactOrganisationDetailsSchema = z.object({
  organisationNumber: z.string(),
  name: z.string(),
})

export const ContactIndividualSchema = ContactBaseSchema.extend({
  type: z.literal('individual'),
  personal: ContactPersonalDetailsSchema,
})

export const ContactOrganisationSchema = ContactBaseSchema.extend({
  type: z.literal('organisation'),
  organisation: ContactOrganisationDetailsSchema,
})

export const ContactSchema = z.discriminatedUnion('type', [
  ContactIndividualSchema,
  ContactOrganisationSchema,
])

export const ONECoreHateOASResponseBodySchema = z.object({
  _links: z.any(),
})

export const GetContactResponseBodySchema =
  ONECoreHateOASResponseBodySchema.extend({
    content: ContactSchema,
  })

export const GetContactsListResponseBodySchema =
  ONECoreHateOASResponseBodySchema.extend({
    content: z.array(ContactSchema),
  })
