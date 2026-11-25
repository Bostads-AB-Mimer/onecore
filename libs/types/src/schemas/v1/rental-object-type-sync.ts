import { z } from 'zod'

export const RentalObjectTypeChangeSchema = z.object({
  rentalObjectCode: z.string(),
  code: z.string().nullable(),
  label: z.string().nullable(),
  timestamp: z.coerce.date(),
})

export type RentalObjectTypeChange = z.infer<
  typeof RentalObjectTypeChangeSchema
>

export const RentalObjectTypeChangesSchema = z.object({
  changes: z.array(RentalObjectTypeChangeSchema),
  until: z.coerce.date().nullable(),
})

export type RentalObjectTypeChanges = z.infer<
  typeof RentalObjectTypeChangesSchema
>

export const SyncRentalObjectTypeRequestSchema = z.object({
  code: z.string().trim().nullable(),
})

export type SyncRentalObjectTypeRequest = z.infer<
  typeof SyncRentalObjectTypeRequestSchema
>

export const SyncRentalObjectTypeResponseSchema = z.object({
  action: z.enum(['updated', 'unchanged', 'skipped']),
  rentalObjectCode: z.string(),
})

export type SyncRentalObjectTypeResponse = z.infer<
  typeof SyncRentalObjectTypeResponseSchema
>
