import { z } from 'zod'

export const SyncContactToLeasingSchema = z.object({
  contactCode: z.string(),
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
