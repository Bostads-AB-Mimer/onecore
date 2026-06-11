import { z } from 'zod'

export const RelatedContactRoleSchema = z.enum([
  'trustee', // god man
  'administrator', // förvaltare
  'ward', // huvudman (inverse of trustee/administrator)
  'subtenant', // andrahandshyresgäst
  'occupant', // nyttjare
  'tenant', // innehavare (inverse of lease relations)
  'alternateInvoiceRecipient', // annan fakturamottagare
  'alternateAutogiroPayer', // annan autogirobetalare
])

export type RelatedContactRole = z.infer<typeof RelatedContactRoleSchema>

export const RelatedContactSchema = z.object({
  contactCode: z.string(),
  role: RelatedContactRoleSchema,
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string(),
  nationalRegistrationNumber: z.string().nullable(),
  address: z.string().nullable(),
  zipCode: z.string().nullable(),
  city: z.string().nullable(),
  email: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  leaseId: z.string().optional(),
  relationFrom: z.string().nullable().optional(),
  relationTo: z.string().nullable().optional(),
})

export type RelatedContact = z.infer<typeof RelatedContactSchema>
