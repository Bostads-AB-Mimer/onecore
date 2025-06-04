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
