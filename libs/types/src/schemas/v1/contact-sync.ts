import { z } from 'zod'

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

export const SyncContactToEconomyUndoSchema = z.object({
  previous: SyncContactToEconomySchema.omit({ contactCode: true }),
})

export type SyncContactToEconomyUndo = z.infer<
  typeof SyncContactToEconomyUndoSchema
>

export const SyncContactToWorkOrderUndoSchema = z.object({
  tenants: z.array(
    z.object({
      id: z.number(),
      fullName: z.string(),
      emailAddress: z.string().nullable(),
      phoneNumber: z.string().nullable(),
    })
  ),
})

export type SyncContactToWorkOrderUndo = z.infer<
  typeof SyncContactToWorkOrderUndoSchema
>
