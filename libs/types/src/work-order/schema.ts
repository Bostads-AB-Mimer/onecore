import { z } from 'zod'

// Odoo "Resursgrupp" (maintenance.team) — the board a work order is routed to.
export const MaintenanceTeamSchema = z.object({
  id: z.number(),
  name: z.string(),
})

// One work order per resursgrupp: the components an inspector assigned to a
// team are aggregated into `descriptionHtml` (HTML, <br>-joined).
export const CreateInspectionWorkOrderGroupSchema = z.object({
  maintenanceTeamId: z.number(),
  maintenanceTeamName: z.string(),
  descriptionHtml: z.string(),
})

// Frontend → core: the inspector groups damaged components by resursgrupp. Core
// resolves the rental property from `rentalObjectCode` before calling the
// work-order service.
export const CreateInspectionWorkOrdersRequestSchema = z.object({
  rentalObjectCode: z.string(),
  // Keys the Odoo records to the inspection so retries and re-submissions
  // upsert the existing request instead of creating duplicates. Optional for
  // clients that predate the field — without it, creation is not idempotent.
  inspectionId: z.string().optional(),
  groups: z.array(CreateInspectionWorkOrderGroupSchema).min(1),
})

// Per-group outcome — the batch is N separate Odoo commits, not a transaction,
// so each group succeeds or fails independently.
export const CreateInspectionWorkOrderResultSchema = z.object({
  maintenanceTeamId: z.number(),
  ok: z.boolean(),
  workOrderId: z.number().optional(),
  err: z.string().optional(),
})

export const CreateInspectionWorkOrdersResponseSchema = z.object({
  results: z.array(CreateInspectionWorkOrderResultSchema),
})
