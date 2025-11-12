import z from 'zod'

export const PhoneNumberSchema = z.object({
  phoneNumber: z.string(),
  type: z.string(),
  isMain: z.boolean(),
})

export const EmailAddressSchema = z.object({
  emailAddress: z.string(),
  type: z.string(),
  isMain: z.boolean(),
})

export const ContactIdentitySchema = z.object({
  nationalRegistrationNumber: z.string(),
  birthDate: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
})

export const ContactCommunicationSchema = z.object({
  phoneNumbers: z.array(PhoneNumberSchema),
  emailAddresses: z.array(EmailAddressSchema),
  specialAttention: z.boolean(),
})

export const ContactAddressSchema = z.object({
  street: z.string(),
  number: z.string(),
  zipCode: z.string(),
  city: z.string(),
})

export const ContactSchema = z.object({
  contactCode: z.string(),
  contactKey: z.string(),
  identity: ContactIdentitySchema,
  communication: ContactCommunicationSchema,
  addresses: z.array(ContactAddressSchema),
})
