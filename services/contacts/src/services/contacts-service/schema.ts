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

export const EmailTypeSchema = z.enum(['private', 'work', 'unspecified'])

export const PhoneNumberSchema = z.object({
  phoneNumber: z.string(),
  type: PhoneNumberTypeSchema,
  comment: z.string().optional(),
  isPrimary: z.boolean(),
})

export const TrusteeSchema = z.object({
  contactCode: z.string(),
  fullName: z.optional(z.string()),
})

export const EmailAddressSchema = z.object({
  emailAddress: z.string(),
  type: EmailTypeSchema,
  isPrimary: z.boolean(),
})

export const ContactPersonalDetailsSchema = z.object({
  nationalId: z.string().nullable(),
  birthDate: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string(),
})

export const ContactOrganisationDetailsSchema = z.object({
  organisationNumber: z.string(),
  name: z.string(),
})

export const ContactCommunicationSchema = z.object({
  phoneNumbers: z.array(PhoneNumberSchema),
  emailAddresses: z.array(EmailAddressSchema),
  specialAttention: z.boolean(),
})

export const ContactAddressSchema = z.object({
  careOf: z.string().nullable(),
  street: z.string().nullable(),
  zipCode: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  full: z.string().nullable(),
})

export const ContactBaseSchema = z.object({
  contactCode: z.string(),
  contactKey: z.string(),
  communication: ContactCommunicationSchema,
  addresses: z.array(ContactAddressSchema),
})

export const ContactIndividualSchema = ContactBaseSchema.extend({
  type: z.literal('individual'),
  personal: ContactPersonalDetailsSchema,
  trustee: z.optional(TrusteeSchema),
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

export const GetContactsResponseBodySchema =
  ONECoreHateOASResponseBodySchema.extend({
    content: z.object({
      contacts: z.array(ContactSchema),
    }),
  })
