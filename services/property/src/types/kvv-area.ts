import { z } from 'zod'

export const KvvAreaSummarySchema = z.object({
  code: z.string(),
})

export type KvvAreaSummary = z.infer<typeof KvvAreaSummarySchema>
