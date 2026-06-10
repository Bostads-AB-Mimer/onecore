import { z } from 'zod'

export const CoreWorkOrderMessageSchema = z.object({
  id: z.number(),
  body: z.string(),
  messageType: z.string(),
  author: z.string(),
  createDate: z.coerce.date(),
})

export const CoreWorkOrderSchema = z.object({
  accessCaption: z.string(),
  caption: z.string(),
  code: z.string(),
  contactCode: z.string(),
  description: z.string(),
  detailsCaption: z.string(),
  externalResource: z.boolean(),
  id: z.string(),
  lastChanged: z.coerce.date(),
  priority: z.string(),
  registered: z.coerce.date(),
  dueDate: z.union([z.null(), z.coerce.date()]),
  rentalObjectCode: z.string(),
  status: z.string(),
  hiddenFromMyPages: z.boolean().optional(),
  workOrderRows: z.array(
    z.object({
      description: z.string().nullable(),
      locationCode: z.string().nullable(),
      equipmentCode: z.string().nullable(),
    })
  ),
  messages: z.array(CoreWorkOrderMessageSchema).optional(),
  url: z.string().optional(),
})

export const CoreXpandWorkOrderSchema = z.object({
  accessCaption: z.string(),
  caption: z.string().nullable(),
  code: z.string(),
  contactCode: z.string().nullable(),
  id: z.string(),
  lastChanged: z.coerce.date(),
  priority: z.string().nullable(),
  registered: z.coerce.date(),
  dueDate: z.union([z.null(), z.coerce.date()]),
  rentalObjectCode: z.string(),
  status: z.string(),
})

export const CoreXpandWorkOrderDetailsSchema = z.object({
  accessCaption: z.string(),
  caption: z.string().nullable(),
  code: z.string(),
  contactCode: z.string().nullable(),
  description: z.string(),
  id: z.string(),
  lastChanged: z.coerce.date(),
  priority: z.string().nullable(),
  registered: z.coerce.date(),
  dueDate: z.union([z.null(), z.coerce.date()]),
  rentalObjectCode: z.string(),
  status: z.string(),
  workOrderRows: z.array(
    z.object({
      description: z.string().nullable(),
      locationCode: z.string().nullable(),
      equipmentCode: z.string().nullable(),
    })
  ),
})

export const CreateWorkOrderResponseSchema = z.object({
  newWorkOrderId: z.number(),
})

// Odoo "Resursgrupp" (maintenance team) shown in the inspection picker.
export const MaintenanceTeamSchema = z.object({
  id: z.number(),
  name: z.string(),
})

// Frontend → core: the inspector groups damaged components by resursgrupp. Core
// resolves the rental property from `rentalObjectCode` before calling the service.
const CreateInspectionWorkOrdersGroupSchema = z.object({
  maintenanceTeamId: z.number(),
  maintenanceTeamName: z.string(),
  descriptionHtml: z.string(),
})

export const CreateInspectionWorkOrdersRequestSchema = z.object({
  rentalObjectCode: z.string(),
  groups: z.array(CreateInspectionWorkOrdersGroupSchema).min(1),
})

const CreateInspectionWorkOrderResultSchema = z.object({
  maintenanceTeamId: z.number(),
  ok: z.boolean(),
  workOrderId: z.number().optional(),
  err: z.string().optional(),
})

export const CreateInspectionWorkOrdersResponseSchema = z.object({
  results: z.array(CreateInspectionWorkOrderResultSchema),
})

export const GetWorkOrdersFromXpandQuerySchema = z.object({
  skip: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sortAscending: z
    .string()
    .transform((s) => (s === 'true' ? true : false))
    .optional(),
})

export type CoreWorkOrderMessage = z.infer<typeof CoreWorkOrderMessageSchema>
export type CoreWorkOrder = z.infer<typeof CoreWorkOrderSchema>
export type CoreXpandWorkOrder = z.infer<typeof CoreXpandWorkOrderSchema>
export type CoreXpandWorkOrderDetails = z.infer<
  typeof CoreXpandWorkOrderDetailsSchema
>
export type CreateWorkOrderResponse = z.infer<
  typeof CreateWorkOrderResponseSchema
>
export type MaintenanceTeam = z.infer<typeof MaintenanceTeamSchema>
export type CreateInspectionWorkOrdersResponse = z.infer<
  typeof CreateInspectionWorkOrdersResponseSchema
>
