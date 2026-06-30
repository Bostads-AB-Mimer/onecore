import { z } from 'zod'

export const RelatedContactSchema = z.object({
  name: z.string().nullable(),
  nationalRegistrationNumber: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  zipCode: z.string().nullable(),
})

export const SyncContactToLeasingSchema = z.object({
  contactCode: z.string(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  nationalRegistrationNumber: z.string().nullable().optional(),
  emailAddress: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  trustee: RelatedContactSchema.optional(),
  administrator: RelatedContactSchema.optional(),
  invoiceRecipient: RelatedContactSchema.optional(),
})

export type SyncContactToLeasingPayload = z.infer<
  typeof SyncContactToLeasingSchema
>

export const SyncContactToEconomySchema = z.object({
  contactCode: z.string(),
  fullName: z.string(),
  street: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  emailAddress: z.string().nullable().optional(),
})

export type SyncContactToEconomyPayload = z.infer<
  typeof SyncContactToEconomySchema
>

export const SyncContactToWorkOrderSchema = z.object({
  contactCode: z.string(),
  fullName: z.string(),
  emailAddress: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
})

export type SyncContactToWorkOrderPayload = z.infer<
  typeof SyncContactToWorkOrderSchema
>

export type RelatedContact = z.infer<typeof RelatedContactSchema>
