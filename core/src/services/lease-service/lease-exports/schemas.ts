import { z } from 'zod'

export const LeaseExportSchema = z.object({
  id: z.string(),
  status: z.enum(['running', 'done', 'failed']),
  phase: z
    .enum([
      'fetching-leases',
      'fetching-contacts',
      'building-file',
      'saving-file',
    ])
    .nullable(),
  statusFilter: z.array(z.string()),
  leaseCount: z.number().int().nullable(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  fileName: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  expiresAt: z.string().datetime().nullable(),
  failureReason: z
    .enum(['lease-service-warming-up', 'export-failed'])
    .nullable(),
})

export type LeaseExport = z.infer<typeof LeaseExportSchema>
